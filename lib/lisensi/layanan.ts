/**
 * Layanan lisensi Qaloka di sisi server: membaca kunci tersimpan, menyimpulkan keadaannya, dan
 * menyegarkannya dari qaloka.com. Diturunkan dari `lisensi.service.ts` aplikasi POS (Nest),
 * ditulis ulang tanpa Nest.
 *
 * Aturan yang dibawa apa adanya:
 * - GAGAL-TERBUKA. Tanpa token / tanpa kunci = tidak ada yang ditegakkan.
 * - Penyegaran TIDAK PERNAH melempar. Gagal = kunci lama dipertahankan + catatan di berkas.
 * - Kunci baru diverifikasi tanda tangannya SEBELUM menimpa yang lama.
 * - Token instalasi tidak pernah keluar ke peramban; cuma server ini yang memanggil qaloka.com.
 *
 * Keadaan disimpan di `globalThis`, bukan variabel modul: `next dev` memuat ulang modul tiap
 * berkas disentuh, dan pengatur waktu yang ikut dibuat ulang akan menumpuk (pelajaran kolam
 * koneksi MySQL di qaloka.com).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kunciPublikLisensi } from "./kunci-publik";
import { verifikasi } from "./periksa-kunci";
import { nilaiKeadaan, type Keadaan } from "./keadaan-lisensi";
import { bacaSimpanan, tulisSimpanan, type Simpanan } from "./simpanan-lisensi";

const URL_BAWAAN = "https://qendali.com";
const MEMO_MS = 60_000;
const TIMEOUT_MS = 10_000;
/** Penerbit cuma menerbitkan kunci baru kalau langganan berubah atau kunci lama ≥ 12 jam. */
const JEDA_PENYEGARAN_MS = 6 * 60 * 60 * 1000;


type Wadah = {
  memo: { keadaan: Keadaan; simpanan: Simpanan; pada: number } | null;
  sedang: Promise<void> | null;
  pengatur: ReturnType<typeof setInterval> | null;
};

const g = globalThis as unknown as { __qendaliLisensi?: Wadah };
const wadah: Wadah = (g.__qendaliLisensi ??= { memo: null, sedang: null, pengatur: null });

/** Alamat instalasi untuk dicocokkan ke `alamatSah`. Kosong = tidak diperiksa. */
export function alamatInstalasi(): string | null {
  const nilai = (process.env.QENDALI_ALAMAT || process.env.APP_URL || "").trim();
  return nilai || null;
}

function urlPenerbit(): string {
  return `${(process.env.QENDALI_LISENSI_URL || URL_BAWAAN).replace(/\/+$/, "")}/api/lisensi`;
}

function versiAplikasi(): string {
  if (process.env.QENDALI_VERSI) return process.env.QENDALI_VERSI;
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    return String(pkg.version ?? "tak-diketahui");
  } catch {
    return "tak-diketahui";
  }
}

/** Keadaan lisensi sekarang (dimemo 60 detik). Tidak pernah melempar. */
export async function keadaanLisensi(): Promise<Keadaan & { simpanan: Simpanan }> {
  const sekarang = Date.now();
  if (wadah.memo && sekarang - wadah.memo.pada < MEMO_MS) {
    return { ...wadah.memo.keadaan, simpanan: wadah.memo.simpanan };
  }
  const simpanan = await bacaSimpanan();
  const keadaan = nilaiKeadaan({
    kunci: simpanan.kunci,
    kunciPublik: kunciPublikLisensi(),
    alamat: alamatInstalasi(),
    terakhirTerlihat: simpanan.terakhirTerlihat,
  });
  wadah.memo = { keadaan, simpanan, pada: sekarang };
  return { ...keadaan, simpanan };
}

/** Minta kunci baru ke qaloka.com. Panggilan berbarengan digabung jadi satu. */
export function segarkanLisensi(alasan = "manual"): Promise<void> {
  if (!wadah.sedang) {
    wadah.sedang = jalankanPenyegaran(alasan).finally(() => {
      wadah.sedang = null;
    });
  }
  return wadah.sedang;
}

async function jalankanPenyegaran(alasan: string): Promise<void> {
  const token = (process.env.QENDALI_LISENSI_TOKEN || "").trim();
  if (!token) return; // gagal-terbuka: belum dipasang = belum ditegakkan

  const simpanan = await bacaSimpanan();
  let catatan = "";
  const henti = new AbortController();
  const waktu = setTimeout(() => henti.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(urlPenerbit(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "x-qendali-versi": versiAplikasi(),
        accept: "application/json",
      },
      signal: henti.signal,
      cache: "no-store",
    });
    const badan = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 403) {
      catatan = `403 ${String(badan.salah ?? badan.alasan ?? "ditolak")}`;
    } else if (!res.ok) {
      catatan = `HTTP ${res.status}`;
    } else if (typeof badan.kunci !== "string") {
      catatan = "jawaban tanpa kunci";
    } else {
      const cek = verifikasi(badan.kunci, kunciPublikLisensi());
      if (!cek.sah) {
        catatan = `kunci baru ditolak: ${cek.alasan}`;
      } else {
        simpanan.kunci = badan.kunci;
        simpanan.terakhirTerlihat = new Date().toISOString();
        catatan = badan.baru ? "kunci baru tersimpan" : "kunci lama masih segar";
      }
    }
  } catch (e) {
    catatan = henti.signal.aborted ? `timeout ${TIMEOUT_MS / 1000} detik` : String((e as Error)?.message ?? e);
  } finally {
    clearTimeout(waktu);
    simpanan.terakhirDicoba = new Date().toISOString();
    simpanan.catatanTerakhir = catatan || null;
    try {
      await tulisSimpanan(simpanan);
    } catch (e) {
      console.error("[lisensi] gagal menyimpan kunci:", e);
    }
    wadah.memo = null;
    console.log(`[lisensi] penyegaran (${alasan}): ${catatan || "selesai"}`);
  }
}

/** Dipanggil sekali dari instrumentation.ts saat server menyala. */
export function mulaiPenyegaranBerkala(): void {
  if (wadah.pengatur) return;
  if (!(process.env.QENDALI_LISENSI_TOKEN || "").trim()) {
    console.warn("[lisensi] QENDALI_LISENSI_TOKEN kosong — lisensi tidak ditegakkan (semua fitur terbuka).");
    return;
  }
  void segarkanLisensi("boot");
  wadah.pengatur = setInterval(() => void segarkanLisensi("berkala"), JEDA_PENYEGARAN_MS);
  wadah.pengatur.unref?.();
}

/** Lupakan memo — dipakai tes. */
export function lupakanMemo(): void {
  wadah.memo = null;
}
