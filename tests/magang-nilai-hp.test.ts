import { describe, it, expect } from "vitest";
import { hitungBenar, predikat } from "@/lib/services/magang/nilai";

/** Temuan simulasi 7 Nov 2026: HP anak hanya menulis "Kuis 40" — anak tidak tahu itu 2 dari 5 benar. */
describe("ringkasan kuis di HP anak", () => {
  it("menghitung jawaban benar; tidak dijawab = salah", () => {
    expect(
      hitungBenar([
        { benar: 1, dipilih: 1 },
        { benar: 0, dipilih: 2 },
        { benar: 3, dipilih: 3 },
        { benar: 2, dipilih: null },
        { benar: 0, dipilih: 1 },
      ])
    ).toEqual({ benar: 2, dari: 5 });
    expect(hitungBenar([])).toEqual({ benar: 0, dari: 0 });
  });
  it("predikat ikut tampil (contoh simulasi: 59 = Cukup)", () => {
    expect(predikat(59)).toBe("Cukup");
  });
});
