import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { jenisGambar } from "@/lib/services/absen-hp/aturan";

/**
 * Lampiran pengajuan izin (foto surat dokter / PDF) — pola sama dengan foto jurnal magang
 * (lib/services/magang/foto.ts): DI LUAR public/, nama acak dari server, mode 0600, isi berkas
 * diperiksa dari bita (bukan dari tipe kiriman peramban), hanya tersaji lewat rute ber-PIN
 * (pemiliknya) / ber-login (manajemen). Folder storage/izin ikut cadangan tar storage/ saat deploy.
 */
export function folderLampiran(): string {
  return process.env.LEAVE_LAMPIRAN_DIR || path.join(process.cwd(), "storage", "izin");
}

export const LAMPIRAN_MAKS_BITA = 5 * 1024 * 1024;
export const LAMPIRAN_MAKS_JUMLAH = 3;
/** Medan multipart untuk berkas lampiran (boleh berulang). */
export const MEDAN_LAMPIRAN = "lampiran";

export type TipeLampiran = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
const EKSTENSI: Record<TipeLampiran, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Jenis berkas dari bita awalnya (magic bytes). Selain foto JPG/PNG/WebP dan PDF → null. */
export function jenisLampiran(b: Uint8Array): TipeLampiran | null {
  const g = jenisGambar(b);
  if (g) return g === "jpg" ? "image/jpeg" : `image/${g}`;
  // "%PDF-"
  if (b.length > 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return "application/pdf";
  }
  return null;
}

/** Foto HEIC/HEIF (galeri iPhone): kotak "ftyp" + merek heic/heix/mif1/… — hanya untuk pesan yang tepat. */
function tampakHeic(b: Uint8Array): boolean {
  if (b.length < 12) return false;
  const kotak = String.fromCharCode(...b.slice(4, 8));
  const merek = String.fromCharCode(...b.slice(8, 12));
  return kotak === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(merek);
}

/**
 * Nama berkas asli yang aman untuk DITAMPILKAN (tidak pernah dipakai sebagai jalur): buang
 * folder, karakter kendali & karakter yang merusak header, potong ≤150 karakter, dan ekstensinya
 * diganti sesuai isi berkas yang sebenarnya.
 */
export function namaAman(asli: string | null | undefined, tipe: TipeLampiran): string {
  const ext = EKSTENSI[tipe];
  let n = String(asli ?? "").split(/[\\/]/).pop() ?? "";
  n = n
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f"<>:|?*;\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const dasar = n.replace(/\.[^.]{0,10}$/, "").trim();
  const potong = Array.from(dasar).slice(0, 150 - ext.length - 1).join("").trim();
  return `${potong || "lampiran"}.${ext}`;
}

/** Header Content-Disposition: foto dibuka di tab (inline), PDF diunduh (attachment). */
export function disposisiLampiran(tipe: string, nama: string): string {
  const jenis = tipe.startsWith("image/") ? "inline" : "attachment";
  const bersih = String(nama).replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  const ascii = bersih.replace(/[^\x20-\x7e]/g, "_").replace(/["\\;]/g, "_") || "lampiran";
  const utf8 = encodeURIComponent(bersih).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${jenis}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

export type BerkasMasuk = { nama: string; ukuran: number; bita: Uint8Array };
export type BerkasSiap = { bita: Uint8Array; nama: string; tipe: TipeLampiran; ukuran: number };

/**
 * Periksa SEMUA berkas dulu (jumlah, ukuran, isi) — belum ada yang ditulis ke disk.
 * `sudahAda` = lampiran yang sudah tersimpan pada pengajuan itu.
 */
export function periksaLampiran(
  daftar: readonly BerkasMasuk[],
  sudahAda = 0,
): { ok: true; berkas: BerkasSiap[] } | { ok: false; error: string } {
  const galatJumlah = periksaJumlah(daftar.length, sudahAda);
  if (galatJumlah) return { ok: false, error: galatJumlah };
  const berkas: BerkasSiap[] = [];
  for (const f of daftar) {
    const label = labelBerkas(f.nama);
    const ukuran = f.bita.length;
    if (ukuran === 0 || f.ukuran === 0) return { ok: false, error: `${label} kosong. Pilih ulang berkasnya.` };
    const galatUkuran = periksaUkuran(f.nama, Math.max(ukuran, f.ukuran));
    if (galatUkuran) return { ok: false, error: galatUkuran };
    const tipe = jenisLampiran(f.bita);
    if (!tipe) {
      if (tampakHeic(f.bita)) {
        return {
          ok: false,
          error: `${label} berformat HEIC dan belum bisa dipakai. Di iPhone pilih "Paling kompatibel" (Pengaturan → Kamera → Format), atau kirim tangkapan layarnya.`,
        };
      }
      return { ok: false, error: `${label} tidak bisa dipakai. Kirim foto (JPG, PNG, WebP) atau PDF.` };
    }
    berkas.push({ bita: f.bita, nama: namaAman(f.nama, tipe), tipe, ukuran });
  }
  return { ok: true, berkas };
}

function labelBerkas(n: string): string {
  const s = (String(n ?? "").split(/[\\/]/).pop() ?? "").replace(/[^\p{L}\p{N} ._()-]/gu, "").trim();
  const pendek = Array.from(s).slice(0, 60).join("");
  return pendek ? `"${pendek}"` : "Berkas";
}

function periksaJumlah(jumlah: number, sudahAda: number): string | null {
  const sisa = Math.max(0, LAMPIRAN_MAKS_JUMLAH - sudahAda);
  if (jumlah <= sisa) return null;
  return sudahAda > 0
    ? `Lampiran maksimal ${LAMPIRAN_MAKS_JUMLAH} berkas per pengajuan — tinggal ${sisa} lagi.`
    : `Lampiran maksimal ${LAMPIRAN_MAKS_JUMLAH} berkas per pengajuan.`;
}

function periksaUkuran(nama: string, ukuran: number): string | null {
  return ukuran > LAMPIRAN_MAKS_BITA ? `${labelBerkas(nama)} terlalu besar (maks. 5 MB per berkas).` : null;
}

/**
 * Ambil berkas lampiran dari multipart. Jumlah & ukuran dicek SEBELUM isi dibaca supaya kiriman
 * besar tidak sempat dimuat ke memori; isi baru diperiksa di periksaLampiran().
 */
export async function lampiranDariForm(
  form: FormData,
  sudahAda = 0,
): Promise<{ ok: true; berkas: BerkasSiap[] } | { ok: false; error: string }> {
  const files = form.getAll(MEDAN_LAMPIRAN).filter((f): f is File => f instanceof File);
  const galatJumlah = periksaJumlah(files.length, sudahAda);
  if (galatJumlah) return { ok: false, error: galatJumlah };
  const galatUkuran = files.map((f) => periksaUkuran(f.name, f.size)).find(Boolean);
  if (galatUkuran) return { ok: false, error: galatUkuran };
  const masuk: BerkasMasuk[] = [];
  for (const f of files) {
    masuk.push({ nama: f.name, ukuran: f.size, bita: new Uint8Array(await f.arrayBuffer()) });
  }
  return periksaLampiran(masuk, sudahAda);
}

/** Jalur penuh HANYA bila tetap di dalam folder lampiran (menahan "../" dan jalur mutlak). */
export function jalurAman(relatif: string, akarFolder: string = folderLampiran()): string | null {
  if (!relatif || relatif.includes("\0")) return null;
  const akar = path.resolve(akarFolder);
  const penuh = path.resolve(akar, relatif);
  return penuh.startsWith(akar + path.sep) ? penuh : null;
}

export type LampiranTersimpan = { path: string; nama: string; tipe: TipeLampiran; ukuran: number };

/**
 * Tulis berkas yang SUDAH lolos periksa. Bila salah satu gagal ditulis, yang sudah tertulis
 * dihapus lagi lalu galatnya diteruskan.
 */
export async function simpanLampiran(berkas: readonly BerkasSiap[]): Promise<LampiranTersimpan[]> {
  const hasil: LampiranTersimpan[] = [];
  try {
    for (const b of berkas) {
      const relatif = path.posix.join(new Date().toISOString().slice(0, 7), `${randomUUID()}.${EKSTENSI[b.tipe]}`);
      const tujuan = jalurAman(relatif);
      if (!tujuan) throw new Error("jalur_lampiran");
      await mkdir(path.dirname(tujuan), { recursive: true });
      await writeFile(tujuan, b.bita, { mode: 0o600 });
      hasil.push({ path: relatif, nama: b.nama, tipe: b.tipe, ukuran: b.ukuran });
    }
    return hasil;
  } catch (e) {
    await hapusLampiran(hasil.map((h) => h.path));
    throw e;
  }
}

export async function hapusLampiran(daftar: readonly (string | null | undefined)[]): Promise<void> {
  for (const relatif of daftar) {
    if (!relatif) continue;
    const penuh = jalurAman(relatif);
    if (penuh) await unlink(penuh).catch(() => undefined);
  }
}

/** Baca berkas + periksa ulang isinya; jenis yang dikirim = jenis isi sebenarnya. */
export async function bacaLampiran(relatif: string): Promise<{ bita: Buffer; tipe: TipeLampiran } | null> {
  const penuh = jalurAman(relatif);
  if (!penuh) return null;
  try {
    const bita = await readFile(penuh);
    const tipe = jenisLampiran(bita);
    return tipe ? { bita, tipe } : null;
  } catch {
    return null;
  }
}

/** Respons berkas lampiran — tidak pernah di-cache publik, tidak boleh ditebak jenisnya. */
export function responsLampiran(f: { bita: Buffer; tipe: string }, nama: string): Response {
  return new Response(new Uint8Array(f.bita), {
    headers: {
      "Content-Type": f.tipe,
      "Content-Disposition": disposisiLampiran(f.tipe, nama),
      "Content-Length": String(f.bita.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Metadata yang boleh dikirim ke peramban (tanpa path). */
export function metaLampiran(l: { id: number; nama: string; tipe: string; ukuran: number }) {
  return { id: l.id, nama: l.nama, tipe: l.tipe, ukuran: l.ukuran };
}

/** Galat simpan → hapus berkas yang sudah ditulis lalu teruskan galatnya. */
export async function denganLampiran<T>(tersimpan: readonly LampiranTersimpan[], kerja: () => Promise<T>): Promise<T> {
  try {
    return await kerja();
  } catch (e) {
    await hapusLampiran(tersimpan.map((t) => t.path));
    throw e;
  }
}
