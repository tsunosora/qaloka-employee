/**
 * Tab & label halaman pribadi /me/<token>. MURNI — tests/portal-tab-magang.test.ts.
 *
 * Anak magang/PKL dulu melihat label "Karyawan" / "Halaman Karyawan" dan semua tab karyawan (Lembur, Klaim,
 * Kunjungan, Timesheet) yang tidak pernah dia pakai — membingungkan anak SMK (temuan simulasi 7 Nov 2026).
 * Untuk peserta magang aktif: label "Peserta magang" dan tab khusus karyawan disembunyikan. Ringkasan,
 * Absensi, Izin, Penilaian, Poin TETAP tampil (bisa dipakai anak PKL — tunggu keputusan owner).
 */

// `fitur` = kode lisensi yang harus ada supaya tab tampil (lib/services/portal/keadaan.ts).
// `bulanan` = tab memakai pemilih bulan di atas; yang tidak punya rentangnya sendiri.
// `magang` = hanya tampil untuk peserta magang aktif (state.magang).
// `pembimbing` = hanya tampil untuk pembimbing pos magang aktif (state.pembimbing).
// `bukanMagang` = disembunyikan untuk peserta magang aktif (urusan karyawan: lembur, klaim, kunjungan, timesheet).
export type TabPortal = { key: string; label: string; fitur?: string; bulanan?: boolean; magang?: boolean; pembimbing?: boolean; bukanMagang?: boolean };

export const TABS_PORTAL: readonly TabPortal[] = [
  { key: "magang", label: "Magang", fitur: "hr.assessment", magang: true },
  { key: "bimbingan", label: "Bimbingan", fitur: "hr.assessment", pembimbing: true },
  { key: "overview", label: "Ringkasan", bulanan: true },
  { key: "attendance", label: "Absensi", bulanan: true },
  { key: "assessment", label: "Penilaian", bulanan: true },
  { key: "points", label: "Poin", bulanan: true },
  { key: "leave", label: "Izin" },
  { key: "lembur", label: "Lembur", fitur: "hr.overtime", bukanMagang: true },
  { key: "kunjungan", label: "Kunjungan", fitur: "hr.visits", bukanMagang: true },
  { key: "reimbursement", label: "Klaim", fitur: "hr.reimbursement", bukanMagang: true },
  { key: "timesheet", label: "Timesheet", fitur: "hr.timesheet", bukanMagang: true },
];

type Keadaan = { fitur?: Record<string, boolean>; magang?: boolean; pembimbing?: boolean };

export function tabTampil(t: TabPortal, s: Keadaan): boolean {
  if (t.fitur && s.fitur?.[t.fitur] === false) return false;
  if (t.magang && !s.magang) return false;
  if (t.pembimbing && !s.pembimbing) return false;
  if (t.bukanMagang && s.magang) return false;
  return true;
}

/** Keterangan di bawah nama. */
export function subjudulPortal(s: { magang?: boolean; position: string | null; department: string | null }): string {
  if (s.magang) return "Peserta magang";
  return s.position ?? s.department ?? "Karyawan";
}

/** Label kecil di atas nama pada layar PIN. */
export function labelHalaman(magang: boolean | undefined): string {
  return magang ? "Halaman Peserta Magang" : "Halaman Karyawan";
}
