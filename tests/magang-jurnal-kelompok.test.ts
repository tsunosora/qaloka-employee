import { describe, it, expect } from "vitest";
import { kelompokkanPerAnak } from "@/lib/services/magang/jurnal";
import { cekJurnalMassalSchema } from "@/lib/validators/magang";

/** Temuan simulasi 7 Nov 2026: daftar "jurnal belum dicek" menumpuk satu kartu per hari per anak. */
describe("kelompokkanPerAnak", () => {
  const j = (id: number, pesertaId: number, nama: string, tanggal: string) => ({ id, pesertaId, nama, tanggal });
  it("satu kelompok per anak; jurnal terbaru dulu; anak yang paling lama menunggu di atas", () => {
    const g = kelompokkanPerAnak([
      j(1, 10, "Budi", "2026-11-12"),
      j(2, 20, "Ani", "2026-11-13"),
      j(3, 10, "Budi", "2026-11-10"),
      j(4, 20, "Ani", "2026-11-11"),
      j(5, 10, "Budi", "2026-11-11"),
    ]);
    expect(g.map((x) => x.nama)).toEqual(["Budi", "Ani"]);
    expect(g[0].items.map((x) => x.id)).toEqual([1, 5, 3]);
    expect(g[0].tertua).toBe("2026-11-10");
    expect(g[1].items.map((x) => x.id)).toEqual([2, 4]);
  });
  it("tertua sama → urut nama", () => {
    const g = kelompokkanPerAnak([j(1, 2, "Citra", "2026-11-10"), j(2, 1, "Ani", "2026-11-10")]);
    expect(g.map((x) => x.nama)).toEqual(["Ani", "Citra"]);
  });
  it("kosong", () => expect(kelompokkanPerAnak([])).toEqual([]));
});

describe("cek jurnal massal", () => {
  it("minimal 1, maksimal 200 id", () => {
    expect(cekJurnalMassalSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(cekJurnalMassalSchema.safeParse({ ids: [1, 2] }).success).toBe(true);
    expect(cekJurnalMassalSchema.safeParse({ ids: Array.from({ length: 201 }, (_, i) => i + 1) }).success).toBe(false);
    expect(cekJurnalMassalSchema.safeParse({ ids: [0] }).success).toBe(false);
  });
});
