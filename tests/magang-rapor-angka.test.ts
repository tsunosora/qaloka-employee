import { describe, it, expect } from "vitest";
import { angkaId } from "@/lib/services/magang/rapor";

/** Temuan simulasi 7 Nov 2026: rapor menulis "Kuis rata-rata 40.5" (titik desimal gaya Inggris). */
describe("angka rapor gaya Indonesia", () => {
  it("koma desimal, maksimal 1 angka di belakang koma", () => {
    expect(angkaId(40.5)).toBe("40,5");
    expect(angkaId(3.45)).toMatch(/^3,[45]$/);
    expect(angkaId(80)).toBe("80");
  });
  it("kosong = tanda pisah", () => {
    expect(angkaId(null)).toBe("—");
    expect(angkaId(undefined)).toBe("—");
  });
});
