import { describe, it, expect } from "vitest";
import { labelSingkatKategori, KATEGORI_AWAL } from "@/lib/services/magang/misi";

describe("side quest — label pendek kategori (chip Minggu Ini)", () => {
  it("nama kategori dari DB dipakai apa adanya bila muat — tidak ada singkatan tetap di kode", () => {
    const label = KATEGORI_AWAL.map((k) => labelSingkatKategori(k.nama));
    expect(label).toEqual(["Customer Service", "Desain Grafis", "Digital Marketing"]);
    expect(new Set(label).size).toBe(label.length);
  });

  it("nama panjang dipotong di batas kata dengan …", () => {
    expect(labelSingkatKategori("Fotografi Produk dan Katalog Online")).toBe("Fotografi Produk…");
    expect(labelSingkatKategori("Administrasigudangbesar")).toBe("Administrasigudan…");
    expect(labelSingkatKategori("Desain & Percetakan Kaos")).toBe("Desain…");
    expect(labelSingkatKategori("  Lainnya  ")).toBe("Lainnya");
  });
});
