/**
 * DATA jam kerja magang Voliko (15 Nov 2026) — dipakai tools/magang/voliko-jam-kerja.ts dan tests/magang-jam-kerja.test.ts.
 * Nama asli anak HANYA boleh ada di berkas data ini (bukan di kode/tes).
 *
 * sekolah = tulisan sekolah (dicocokkan dengan kunciSekolah: tanpa peduli huruf besar/spasi) — skrip BATAL bila tidak
 * ada peserta dengan sekolah itu. anak = MagangPeserta.id + Employee.nickname (dicek, tanpa peduli huruf besar).
 * toleransiMenit null = toleransi umum (Setting shift_late_tolerance).
 */

export const MIGRASI_JAM = "20261115000000_magang_jam_kerja";

export const JAM_SEKOLAH_VOLIKO = [
  {
    sekolah: "SMK N 4 Yogyakarta",
    jamMasuk: "09:00",
    jamPulang: "17:00",
    toleransiMenit: null,
    anak: [
      { pesertaId: 5, panggilan: "Aqila" },
      { pesertaId: 6, panggilan: "Cerry" },
      { pesertaId: 7, panggilan: "Putra" },
      { pesertaId: 8, panggilan: "WAFIQ" },
    ],
  },
  {
    sekolah: "SMK Negeri 2 Sewon",
    jamMasuk: "08:00",
    jamPulang: "16:00",
    toleransiMenit: null,
    anak: [
      { pesertaId: 1, panggilan: "Rizki" },
      { pesertaId: 2, panggilan: "Yufita" },
      { pesertaId: 3, panggilan: "Alif" },
      { pesertaId: 4, panggilan: "Marisa" },
    ],
  },
] as const;
