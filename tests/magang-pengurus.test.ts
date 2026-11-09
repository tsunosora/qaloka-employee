import { describe, it, expect } from "vitest";
import { namaPengurus, saringPesertaAktif } from "@/lib/services/magang/pembimbing";

describe("nama yang menilai/mengecek", () => {
  it("akun dasbor dulu, lalu karyawan (panggilan → nama lengkap)", () => {
    expect(namaPengurus({ name: "Admin Simulasi" }, { fullName: "Pembimbing Cetak", nickname: null })).toBe("Admin Simulasi");
    expect(namaPengurus(null, { fullName: "Pembimbing Cetak", nickname: "Pak Cetak" })).toBe("Pak Cetak");
    expect(namaPengurus(null, { fullName: "Pembimbing Cetak", nickname: null })).toBe("Pembimbing Cetak");
    expect(namaPengurus(null, null)).toBeNull();
  });
});

describe("daftar belum dinilai/dicek hanya peserta aktif", () => {
  it("Minggu Ini (belum, tanpa pesertaId) → aktif saja; per anak / semua → tanpa saringan", () => {
    expect(saringPesertaAktif("belum", null)).toEqual({ aktif: true });
    expect(saringPesertaAktif("belum", 5)).toEqual({});
    expect(saringPesertaAktif("semua", null)).toEqual({});
  });
});
