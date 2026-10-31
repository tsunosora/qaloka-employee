/**
 * Tiket integrasi antarproduk Qaloka (amplop `qi1`) — dua arah:
 *   - `periksaTiketIntegrasi()` : MENERIMA panggilan dari Qaloka POS (kartu absensi di beranda kasir).
 *   - `tiketUntuk()`             : MEMINTA tiket ke qaloka.com untuk memanggil Qaloka POS (KPI staf).
 *
 * Acuannya `lib/tiket-integrasi.mjs` + docs/lisensi.md → "Tiket integrasi" di repo qendali.
 * Pemeriksaannya GAGAL-TERTUTUP — beda dengan penegakan lisensi yang gagal-terbuka: yang dijaga di
 * sini data karyawan yang keluar ke aplikasi lain, jadi ragu sedikit pun, tolak.
 */
import { verify } from "node:crypto";
import { kunciPublikLisensi } from "./kunci-publik";
import { keadaanLisensi } from "./layanan";
import { PRODUK_APLIKASI } from "./keadaan-lisensi";

export const AMPLOP_INTEGRASI = "qi1";
const VERSI = 1;
/** Pasangan yang boleh memanggil aplikasi ini — cermin `PASANGAN` di qaloka.com (ada di kontrak). */
export const BOLEH_DARI = ["qendali"];

export type HasilTiket =
  | { sah: true; isi: { klien: string; dari: string; ke: string; kedaluwarsaPada: string } }
  | { sah: false; alasan: string };

/** MURNI — semua masukan diberikan, supaya bisa diuji tanpa berkas & jaringan. */
export function periksaTiketMurni(
  tiket: string | null | undefined,
  o: { kunciPublik: Record<string, string>; produkSaya: string; klienSaya: string | null; sekarang?: Date },
): HasilTiket {
  const bagian = String(tiket ?? "").trim().split(".");
  if (bagian.length !== 3) return { sah: false, alasan: "bentuk_salah" };
  const [amplop, p1, p2] = bagian;
  if (amplop !== AMPLOP_INTEGRASI) return { sah: false, alasan: "amplop_salah" };
  let isi: Record<string, unknown>;
  try {
    isi = JSON.parse(Buffer.from(p1, "base64url").toString("utf8"));
  } catch {
    return { sah: false, alasan: "isi_rusak" };
  }
  if (isi?.versi !== VERSI) return { sah: false, alasan: "versi_salah" };
  const pem = o.kunciPublik[String(isi.kid)];
  if (!pem) return { sah: false, alasan: "kid_tidak_dikenal" };
  let cocok = false;
  try {
    cocok = verify(null, Buffer.from(`${amplop}.${p1}`), pem, Buffer.from(p2, "base64url"));
  } catch {
    return { sah: false, alasan: "tanda_tangan_rusak" };
  }
  if (!cocok) return { sah: false, alasan: "tanda_tangan_tidak_cocok" };
  const sekarang = o.sekarang ?? new Date();
  if (!(new Date(String(isi.kedaluwarsaPada)).getTime() > sekarang.getTime())) return { sah: false, alasan: "kedaluwarsa" };
  if (isi.ke !== o.produkSaya) return { sah: false, alasan: "bukan_untuk_produk_ini" };
  if (!o.klienSaya) return { sah: false, alasan: "lisensi_belum_terpasang" };
  if (isi.klien !== o.klienSaya) return { sah: false, alasan: "usaha_lain" };
  if (!BOLEH_DARI.includes(String(isi.dari))) return { sah: false, alasan: "pasangan_tidak_didukung" };
  return { sah: true, isi: isi as never };
}

/**
 * Periksa tiket dari header `Authorization: Qendali <tiket>`. `klienSaya` diambil dari kunci
 * lisensi aplikasi ini — HANYA kalau kuncinya terverifikasi. Kunci yang tidak sah tetap membawa
 * nama klien di isinya, tapi nama dari kunci palsu tidak boleh dipakai mencocokkan apa pun.
 */
export async function periksaTiketIntegrasi(tiket: string): Promise<HasilTiket> {
  const k = await keadaanLisensi().catch(() => null);
  const klienSaya = k?.kidTerverifikasi ? k.klien : null;
  return periksaTiketMurni(tiket, { kunciPublik: kunciPublikLisensi(), produkSaya: PRODUK_APLIKASI, klienSaya });
}

/** Ambil tiket dari header, atau null kalau headernya bukan skema Qaloka. */
export function tiketDariHeader(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  return /^qendali\s+/i.test(auth) ? auth.replace(/^qendali\s+/i, "").trim() : null;
}

// ── Sisi pemanggil ─────────────────────────────────────────────────────────────────────────

type Simpanan = { tiket: string | null; habis: number };
const g = globalThis as unknown as { __qendaliTiketKeluar?: Map<string, Simpanan> };
const simpanan = (g.__qendaliTiketKeluar ??= new Map());
/** Minta yang baru kalau sisa umurnya kurang dari ini. */
const SISA_MIN_MS = 60_000;
/**
 * Kegagalan juga diingat sebentar. Tanpa ini, usaha yang memang tidak berlangganan produk tujuan
 * membuat tiap panggilan bertanya ulang ke qaloka.com — kartu yang dimuat tiap 15 detik jadi
 * 4 permintaan per menit ke penerbit, untuk jawaban yang sama.
 */
const INGAT_GAGAL_MS = 5 * 60_000;

/**
 * Tiket untuk memanggil produk `ke` milik usaha yang sama. null = tidak bisa (token belum
 * dipasang, qaloka.com tidak terjangkau, atau usaha ini tidak berlangganan produk tujuan) —
 * pemanggil lalu jatuh ke kunci API lama kalau ada.
 */
export async function tiketUntuk(ke: string): Promise<string | null> {
  const token = (process.env.QENDALI_LISENSI_TOKEN || "").trim();
  if (!token) return null;
  const ada = simpanan.get(ke);
  if (ada && ada.tiket === null && ada.habis > Date.now()) return null;
  if (ada && ada.tiket && ada.habis - Date.now() > SISA_MIN_MS) return ada.tiket;

  const base = (process.env.QENDALI_LISENSI_URL || "https://qendali.com").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/aplikasi/integrasi`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ ke }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const badan = (await res.json().catch(() => ({}))) as { tiket?: string; kedaluwarsaPada?: string; salah?: string };
    if (!res.ok || !badan.tiket) {
      console.warn(`[integrasi] tiket ke ${ke} ditolak qaloka.com: ${res.status} ${badan.salah ?? ""}`);
      simpanan.set(ke, { tiket: null, habis: Date.now() + INGAT_GAGAL_MS });
      return null;
    }
    simpanan.set(ke, { tiket: badan.tiket, habis: new Date(badan.kedaluwarsaPada ?? 0).getTime() });
    return badan.tiket;
  } catch (e) {
    console.warn(`[integrasi] gagal meminta tiket ke ${ke}:`, e instanceof Error ? e.message : e);
    simpanan.set(ke, { tiket: null, habis: Date.now() + INGAT_GAGAL_MS });
    return null;
  }
}
