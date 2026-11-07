/**
 * Aturan jurnal harian anak magang. MURNI — tests/magang-jurnal.test.ts.
 * Keputusan owner 7 Nov 2026: teks + foto (opsional), dicek pembimbing, dan di rapor hanya dihitung
 * KERAJINANNYA ("jurnal terisi X dari Y hari kerja"), tidak masuk nilai mingguan.
 */
import { tambahHari } from "./rotasi";

export const MIN_KEGIATAN = 20;
export const MAKS_KEGIATAN = 3000;
export const MAKS_FOTO = 3;
/** Anak yang lupa boleh menyusulkan jurnal sampai 2 HARI KERJA ke belakang. */
export const MUNDUR_HARI = 2;

/** Hari dalam minggu dari "YYYY-MM-DD" (0 = Minggu), bebas zona waktu. */
export function hariDalamMinggu(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Tanggal yang boleh diisi hari ini: hari kerja terakhir (hari ini bila hari kerja) + MUNDUR_HARI hari kerja
 * ke belakang, dalam masa magang. Hari kerja = Senin–Sabtu tanpa libur nasional — sama dengan hitungan
 * kerajinan di rapor. Dulu dihitung hari kalender, jadi hari Minggu bisa diisi (temuan simulasi 7 Nov 2026).
 * "Hari ini" selalu dihitung satu jatah (walau libur), lalu MUNDUR_HARI hari kerja sebelumnya:
 * Senin → Senin, Sabtu, Jumat; Minggu → Sabtu, Jumat.
 */
export function tanggalBolehIsi(hariIni: string, masa: { mulai: string; selesai: string | null }, libur: ReadonlySet<string> = new Set()): string[] {
  const hasil: string[] = [];
  const kerja = (t: string) => hariDalamMinggu(t) !== 0 && !libur.has(t);
  let mundur = 0;
  for (let k = 0; k <= 14 && mundur <= MUNDUR_HARI; k++) {
    const t = tambahHari(hariIni, -k);
    if (t < masa.mulai) break;
    if (k > 0 && !kerja(t)) continue;
    if (k > 0) mundur++;
    if (mundur > MUNDUR_HARI) break;
    if (!kerja(t) || (masa.selesai && t > masa.selesai)) continue;
    hasil.push(t);
  }
  return hasil;
}

/** Boleh disunting anak: tanggalnya masih dalam jendela isi DAN belum dicek pembimbing. */
export function bolehSunting(
  j: { tanggal: string; dicek: boolean },
  hariIni: string,
  masa: { mulai: string; selesai: string | null },
  libur: ReadonlySet<string> = new Set()
): boolean {
  return !j.dicek && tanggalBolehIsi(hariIni, masa, libur).includes(j.tanggal);
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

/**
 * Kelompokkan jurnal per anak untuk daftar "belum dicek" pembimbing — dulu satu kartu per hari per anak
 * (±30 kartu/minggu untuk 5 anak). Anak yang jurnal tertuanya paling lama menunggu tampil paling atas;
 * di dalam kelompok, jurnal terbaru dulu.
 */
export function kelompokkanPerAnak<T extends { pesertaId: number; nama: string; tanggal: string }>(
  items: readonly T[]
): { pesertaId: number; nama: string; items: T[]; tertua: string }[] {
  const peta = new Map<number, { pesertaId: number; nama: string; items: T[]; tertua: string }>();
  for (const j of items) {
    const g = peta.get(j.pesertaId) ?? { pesertaId: j.pesertaId, nama: j.nama, items: [], tertua: j.tanggal };
    g.items.push(j);
    if (j.tanggal < g.tertua) g.tertua = j.tanggal;
    peta.set(j.pesertaId, g);
  }
  const hasil = [...peta.values()];
  for (const g of hasil) g.items.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));
  return hasil.sort((a, b) => (a.tertua < b.tertua ? -1 : a.tertua > b.tertua ? 1 : a.nama.localeCompare(b.nama, "id")));
}

/** Daftar path foto dari kolom JSON (aman bila isinya rusak). */
export function daftarFoto(j: unknown): string[] {
  return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string").slice(0, MAKS_FOTO) : [];
}
