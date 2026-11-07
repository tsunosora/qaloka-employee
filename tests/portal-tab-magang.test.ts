import { describe, it, expect } from "vitest";
import { TABS_PORTAL, tabTampil, subjudulPortal, labelHalaman } from "@/lib/services/portal/tab-portal";

/** Temuan simulasi 7 Nov 2026: anak PKL melihat "Karyawan" dan tab Lembur/Klaim/Kunjungan/Timesheet. */
const tampil = (s: Parameters<typeof tabTampil>[1]) => TABS_PORTAL.filter((t) => tabTampil(t, s)).map((t) => t.label);

describe("tab halaman pribadi", () => {
  it("peserta magang: Magang di depan, tanpa tab urusan karyawan", () => {
    expect(tampil({ magang: true })).toEqual(["Magang", "Ringkasan", "Absensi", "Penilaian", "Poin", "Izin"]);
  });
  it("karyawan biasa tidak berubah", () => {
    expect(tampil({})).toEqual(["Ringkasan", "Absensi", "Penilaian", "Poin", "Izin", "Lembur", "Kunjungan", "Klaim", "Timesheet"]);
  });
  it("pembimbing mendapat tab Bimbingan; fitur lisensi mati tetap menyembunyikan tab", () => {
    expect(tampil({ pembimbing: true, fitur: { "hr.overtime": false } })).toEqual(["Bimbingan", "Ringkasan", "Absensi", "Penilaian", "Poin", "Izin", "Kunjungan", "Klaim", "Timesheet"]);
  });
});

describe("label", () => {
  it("peserta magang bukan 'Karyawan'", () => {
    expect(subjudulPortal({ magang: true, position: null, department: null })).toBe("Peserta magang");
    expect(labelHalaman(true)).toBe("Halaman Peserta Magang");
  });
  it("karyawan: jabatan → departemen → 'Karyawan'", () => {
    expect(subjudulPortal({ position: "Operator", department: "Produksi" })).toBe("Operator");
    expect(subjudulPortal({ position: null, department: null })).toBe("Karyawan");
    expect(labelHalaman(false)).toBe("Halaman Karyawan");
  });
});
