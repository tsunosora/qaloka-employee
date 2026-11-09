import { describe, it, expect } from "vitest";
import { CONTOH_POS } from "@/lib/services/magang/contoh-pos";
import { JUMLAH_SOAL } from "@/lib/services/magang/nilai";

/** Temuan simulasi 7 Nov 2026: pos contoh hanya 3 soal → anak hanya mendapat 3 soal, bukan 5. */
describe("pos contoh percetakan", () => {
  it("tiap pos punya soal sebanyak yang diundi per minggu, kunci valid, tanpa soal kembar", () => {
    for (const p of CONTOH_POS) {
      expect(p.soal.length, p.nama).toBeGreaterThanOrEqual(JUMLAH_SOAL);
      expect(new Set(p.soal.map((s) => s.pertanyaan)).size, p.nama).toBe(p.soal.length);
      for (const s of p.soal) expect(s.benar, s.pertanyaan).toBeLessThan(s.pilihan.length);
    }
  });
});
