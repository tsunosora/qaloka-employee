/**
 * Pembantu PERAMBAN untuk halaman absen HP (/absen/[token]) — dipakai absen HP biasa dan layar
 * "Absen tim" PIC. Tidak boleh mengimpor lib/services/absen-hp/aturan (berkas itu memakai
 * node:crypto, tidak bisa dimuat di peramban).
 */

const KUNCI_PERANGKAT = "qe-absen-hp-perangkat";

/** Id acak HP ini; server cuma menyimpan sidiknya. Hilang kalau data peramban dihapus. */
export function idPerangkat(): string {
  try {
    let id = localStorage.getItem(KUNCI_PERANGKAT);
    if (!id) {
      id = crypto.randomUUID() + crypto.randomUUID().slice(0, 8);
      localStorage.setItem(KUNCI_PERANGKAT, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Jenis foto yang diterima server apa adanya (lib/services/absen-hp/aturan.ts → jenisGambar). */
const TIPE_ASLI_SAH = ["image/jpeg", "image/png", "image/webp"];
/** Sama dengan FOTO_MAKS_BITA di server. */
const MAKS_BITA = 6 * 1024 * 1024;

function keKanvas(sumber: CanvasImageSource, lebar: number, tinggi: number): Promise<Blob> {
  const skala = Math.min(1, 1280 / Math.max(lebar, tinggi));
  const c = document.createElement("canvas");
  c.width = Math.round(lebar * skala);
  c.height = Math.round(tinggi * skala);
  const g = c.getContext("2d");
  if (!g || !c.width || !c.height) return Promise.reject(new Error("kanvas"));
  g.drawImage(sumber, 0, 0, c.width, c.height);
  return new Promise((ok, gagal) => c.toBlob((b) => (b && b.size > 0 ? ok(b) : gagal(new Error("foto"))), "image/jpeg", 0.8));
}

/**
 * Foto dikecilkan di HP (sisi terpanjang 1280 px, JPEG) supaya cepat terkirim di sinyal lemah.
 * Tiga jalan, berurutan — 9 Nov 2026 seorang peserta magang tidak bisa absen ("foto tidak diterima")
 * sementara temannya di tempat yang sama berhasil; dulu cuma ada jalan (1), gagal = buntu:
 *  1. createImageBitmap (cepat; tidak ada / gagal di sebagian peramban & foto kamera besar),
 *  2. <img> + decode() dari object URL,
 *  3. kirim berkas ASLI bila jenisnya diterima server (JPEG/PNG/WebP) dan ≤ 6 MB.
 * Selain itu (mis. HEIC dari galeri iPhone) → galat dengan `kode` supaya pesannya tepat.
 */
export async function kecilkan(berkas: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(berkas);
    return await keKanvas(bmp, bmp.width, bmp.height);
  } catch {
    /* jalan berikutnya */
  }
  const url = URL.createObjectURL(berkas);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await keKanvas(img, img.naturalWidth, img.naturalHeight);
  } catch {
    /* jalan berikutnya */
  } finally {
    URL.revokeObjectURL(url);
  }
  if (TIPE_ASLI_SAH.includes(berkas.type) && berkas.size > 0 && berkas.size <= MAKS_BITA) return berkas;
  throw Object.assign(new Error("foto"), { kode: berkas.size > MAKS_BITA ? "foto_besar" : "foto_jenis" });
}

/** Pesan untuk anak bila foto tidak bisa disiapkan di HP. */
export function pesanFotoGagal(e: unknown, berkas: { type: string }): string {
  const kode = (e as { kode?: string } | null)?.kode;
  if (kode === "foto_besar") return "Foto terlalu besar dan tidak bisa diperkecil di HP ini. Ambil ulang dengan kamera (bukan dari galeri).";
  if (/heic|heif/i.test(berkas.type)) return "Format foto HEIC tidak bisa dipakai. Ambil foto langsung dengan kamera, bukan dari galeri.";
  return "Foto tidak terbaca di HP ini. Ambil ulang dengan kamera; kalau tetap gagal, coba buka tautan ini di Chrome.";
}

export function bacaLokasi(): Promise<GeolocationPosition> {
  return new Promise((ok, gagal) =>
    navigator.geolocation.getCurrentPosition(ok, gagal, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }),
  );
}

export const jamDari = (t: string) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** Sama dengan teksJarak() di lib/services/absen-hp/aturan.ts. */
export const teksJarak = (m: number) =>
  m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;

/** Pesan galat dari jawaban server: rute tim memakai `alasan`, penjaga lisensi memakai `message`. */
export function pesanDari(d: unknown, cadangan: string): string {
  const o = (d ?? {}) as { alasan?: string; message?: string };
  return o.alasan || o.message || cadangan;
}

/** Pemanggil rute /api/public/absen/[token]/tim/* dari layar PIC (header x-perangkat sudah terpasang). */
export type Minta = (jalur: string, init?: RequestInit) => Promise<{ ok: boolean; d: unknown }>;
