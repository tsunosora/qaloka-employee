/**
 * Aturan jurnal harian anak magang. MURNI — tests/magang-jurnal.test.ts.
 * Keputusan owner 7 Nov 2026: teks + foto (opsional), dicek pembimbing, dan di rapor hanya dihitung
 * KERAJINANNYA ("jurnal terisi X dari Y hari kerja"), tidak masuk nilai mingguan.
 */
import { tambahHari } from "./rotasi";

export const MIN_KEGIATAN = 20;
export const MAKS_KEGIATAN = 3000;
export const MAKS_FOTO = 3;
/** Anak yang lupa boleh menyusulkan jurnal sampai 2 hari ke belakang. */
export const MUNDUR_HARI = 2;

/** Hari dalam minggu dari "YYYY-MM-DD" (0 = Minggu), bebas zona waktu. */
export function hariDalamMinggu(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Tanggal yang boleh diisi hari ini: hari ini + MUNDUR_HARI ke belakang, dalam masa magang. */
export function tanggalBolehIsi(hariIni: string, masa: { mulai: string; selesai: string | null }): string[] {
  const hasil: string[] = [];
  for (let k = 0; k <= MUNDUR_HARI; k++) {
    const t = tambahHari(hariIni, -k);
    if (t < masa.mulai) break;
    if (masa.selesai && t > masa.selesai) continue;
    hasil.push(t);
  }
  return hasil;
}

/** Boleh disunting anak: tanggalnya masih dalam jendela isi DAN belum dicek pembimbing. */
export function bolehSunting(j: { tanggal: string; dicek: boolean }, hariIni: string, masa: { mulai: string; selesai: string | null }): boolean {
  return !j.dicek && tanggalBolehIsi(hariIni, masa).includes(j.tanggal);
}

/**
 * Hari kerja dalam rentang (inklusif): Senin–Sabtu, dikurangi libur nasional. Percetakan buka Sabtu;
 * Minggu dianggap libur. Dipakai untuk "jurnal terisi X dari Y hari kerja".
 */
export function hariKerja(dari: string, sampai: string, libur: ReadonlySet<string>): string[] {
  const hasil: string[] = [];
  for (let t = dari; t <= sampai; t = tambahHari(t, 1)) {
    if (hariDalamMinggu(t) === 0 || libur.has(t)) continue;
    hasil.push(t);
    if (hasil.length > 400) break; // pengaman data rusak
  }
  return hasil;
}

export function kerajinan(terisi: readonly string[], hari: readonly string[]): { terisi: number; dari: number; persen: number | null } {
  const set = new Set(hari);
  const n = new Set(terisi.filter((t) => set.has(t))).size;
  return { terisi: n, dari: hari.length, persen: hari.length ? Math.round((n / hari.length) * 100) : null };
}

/** Daftar path foto dari kolom JSON (aman bila isinya rusak). */
export function daftarFoto(j: unknown): string[] {
  return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string").slice(0, MAKS_FOTO) : [];
}
