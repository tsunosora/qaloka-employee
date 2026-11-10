/**
 * Jam kerja khusus ANAK MAGANG (15 Nov 2026) — perhitungan murni. Dipakai computeAttendanceRow bila DayInput.jamMagang
 * diisi; karyawan biasa tidak pernah membawa jamMagang (peta hanya berisi peserta magang aktif di dalam masanya),
 * jadi perhitungan mereka tetap persis seperti sebelumnya (shift otomatis jam toko / jadwal per-karyawan).
 *
 * Aturan (sama semantiknya dengan computeShift, tapi satu shift tetap jamMasuk–jamPulang):
 * - Telat   = menit lewat jamMasuk bila datang SETELAH jamMasuk + toleransi (dihitung dari jamMasuk, bukan dari batas
 *             toleransi — sama dengan aturan toko: 09:20 dengan jam 09:00 & toleransi 15 = telat 20 menit).
 * - Pulang awal = menit sebelum jamPulang (hanya bila ada scan pulang). Tidak mengubah status (tetap on_time/late),
 *             hanya ditampilkan.
 * - Lembur  = menit lewat jamPulang (bukan lewat 16:00 jam toko — kalau tidak, anak 09–17 selalu "lembur" 60 menit).
 * - Tidak ada shift siang / longshift untuk anak magang; shift dilaporkan "pagi".
 */

export type JamMagangHari = {
  jamMasuk: string; // "HH:MM"
  jamPulang: string; // "HH:MM"
  /** Sudah diselesaikan: toleransi anak → sekolah → toleransi umum. */
  toleransiMenit: number;
};

/** Peta (karyawan, tanggal) → jam magang hari itu; null = bukan anak magang aktif dalam masanya → aturan umum. */
export type PetaJamMagang = {
  get(employeeId: number, ymd: string): JamMagangHari | null;
  /** Karyawan yang punya jam magang (di tanggal mana pun). */
  readonly employeeIds: readonly number[];
};

export const PETA_JAM_MAGANG_KOSONG: PetaJamMagang = { get: () => null, employeeIds: [] };

export type HasilJamMagang = {
  status: "on_time" | "late";
  lateMinutes: number;
  overtimeMinutes: number;
  pulangAwalMinutes: number;
};

export function menitJam(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function computeJamMagang(clockInMin: number | null, clockOutMin: number | null, jam: JamMagangHari): HasilJamMagang {
  const masuk = menitJam(jam.jamMasuk) ?? 0;
  const pulang = menitJam(jam.jamPulang) ?? 24 * 60;
  const tol = Math.max(0, jam.toleransiMenit);
  const lateMinutes = clockInMin != null && clockInMin > masuk + tol ? clockInMin - masuk : 0;
  const overtimeMinutes = clockOutMin != null && clockOutMin > pulang ? clockOutMin - pulang : 0;
  const pulangAwalMinutes = clockOutMin != null && clockOutMin < pulang ? pulang - clockOutMin : 0;
  return { status: lateMinutes > 0 ? "late" : "on_time", lateMinutes, overtimeMinutes, pulangAwalMinutes };
}

/** "09:00","17:00" → "09.00–17.00" (tulisan jam Indonesia). */
export function labelJamKerja(masuk: string, pulang: string): string {
  return `${masuk.replace(":", ".")}–${pulang.replace(":", ".")}`;
}
