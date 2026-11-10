/**
 * DATA pasangan jadwal harian Voliko (14 Nov 2026) — dipakai tools/magang/voliko-jadwal-harian.ts dan
 * tests/magang-harian.test.ts. Nama asli anak HANYA boleh ada di berkas data ini (bukan di kode/tes).
 *
 * pesertaId = MagangPeserta.id di DB Voliko; panggilan = Employee.nickname (dicek skrip, tanpa peduli huruf besar).
 * Patokan Selasa 10 Nov 2026: dua pasangan KONTEN, dua pasangan PRODUKSI → tiap hari kerja 2 pasangan konten +
 * 2 pasangan produksi, bergantian.
 */

export const MIGRASI_HARIAN = "20261114000000_magang_jadwal_harian";

export const PASANGAN_VOLIKO = [
  { urutan: 1, a: { pesertaId: 5, panggilan: "Aqila" }, b: { pesertaId: 7, panggilan: "Putra" }, patokanTanggal: "2026-11-10", patokanTugas: "konten" },
  { urutan: 2, a: { pesertaId: 1, panggilan: "Rizki" }, b: { pesertaId: 4, panggilan: "Marisa" }, patokanTanggal: "2026-11-10", patokanTugas: "konten" },
  { urutan: 3, a: { pesertaId: 6, panggilan: "Cerry" }, b: { pesertaId: 8, panggilan: "WAFIQ" }, patokanTanggal: "2026-11-10", patokanTugas: "produksi" },
  { urutan: 4, a: { pesertaId: 2, panggilan: "Yufita" }, b: { pesertaId: 3, panggilan: "Alif" }, patokanTanggal: "2026-11-10", patokanTugas: "produksi" },
] as const;
