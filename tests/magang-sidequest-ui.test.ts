import { describe, it, expect } from "vitest";
import { labelSingkatKategori } from "@/lib/services/magang/rapor";
import { KUNCI_KATEGORI } from "@/lib/services/magang/misi";

describe("side quest — label pendek kategori (chip Minggu Ini)", () => {
  it("setiap kategori punya label pendek sendiri", () => {
    const label = KUNCI_KATEGORI.map(labelSingkatKategori);
    expect(label).toEqual(["CS", "Desain", "Marketing"]);
    expect(new Set(label).size).toBe(label.length);
  });

  it("kategori lain/tak dikenal tetap tampil", () => {
    expect(labelSingkatKategori("lain")).toBe("Lainnya");
    expect(labelSingkatKategori("foto")).toBe("foto");
  });
});
