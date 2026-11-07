import { describe, it, expect } from "vitest";
import { tanggalBolehIsi, bolehSunting } from "@/lib/services/magang/jurnal";

/** Temuan simulasi 7 Nov 2026: jurnal bisa diisi untuk hari Minggu, padahal rapor menghitung Senin–Sabtu. */
const MASA = { mulai: "2026-11-02", selesai: "2027-01-15" };

describe("jendela isi jurnal = hari kerja", () => {
  it("Senin: hari ini + Sabtu + Jumat (Minggu dilewati)", () => {
    expect(tanggalBolehIsi("2026-11-09", MASA)).toEqual(["2026-11-09", "2026-11-07", "2026-11-06"]);
  });
  it("Minggu: hari Minggu tidak bisa diisi; Sabtu & Jumat masih bisa", () => {
    expect(tanggalBolehIsi("2026-11-08", MASA)).toEqual(["2026-11-07", "2026-11-06"]);
  });
  it("libur nasional dilewati seperti Minggu", () => {
    // Rabu 11 Nov libur → Kamis 12: Kamis, Selasa, Senin
    expect(tanggalBolehIsi("2026-11-12", MASA, new Set(["2026-11-11"]))).toEqual(["2026-11-12", "2026-11-10", "2026-11-09"]);
  });
  it("jurnal hari Minggu tidak bisa disunting", () => {
    expect(bolehSunting({ tanggal: "2026-11-08", dicek: false }, "2026-11-09", MASA)).toBe(false);
  });
});
