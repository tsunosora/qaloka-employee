/**
 * Hari pertama yang dihitung di Ringkasan/Absensi halaman pribadi. MURNI — tests/portal-awal-hitung.test.ts.
 *
 * Laporan absensi membuat satu baris per hari kerja dalam periode; hari tanpa scan = "absent". Untuk
 * orang yang baru bergabung di tengah bulan, hari SEBELUM dia bergabung ikut terhitung absen
 * (terlihat 8 Nov 2026: peserta magang mulai 9 Nov, Ringkasan November sudah penuh "Tidak hadir").
 *
 * Aturan: peserta magang → tanggal mulai magang paling awal (masa magang yang menentukan, bukan
 * joinDate yang bisa kosong/berbeda); selain itu → joinDate. Tidak ada keduanya = tidak dipotong.
 */
export function ymdLokal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function awalHitung(a: { joinDate: Date | null; magangMulai: readonly Date[] }): string | null {
  if (a.magangMulai.length > 0) {
    const awal = a.magangMulai.reduce((x, y) => (y < x ? y : x));
    return ymdLokal(awal);
  }
  return a.joinDate ? ymdLokal(a.joinDate) : null;
}

/** Buang baris harian sebelum hari pertama (tanggal "YYYY-MM-DD" bisa dibandingkan sebagai teks). */
export function potongSebelum<T extends { date: string }>(rows: readonly T[], awal: string | null): T[] {
  return awal ? rows.filter((r) => r.date >= awal) : [...rows];
}
