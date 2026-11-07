import { describe, it, expect } from "vitest";
import { posMilik, bolehUrus, jurnalBolehDicek, anakDiPos } from "@/lib/services/magang/pembimbing";
import { fiturUntuk, ATURAN_API } from "@/lib/lisensi/aturan-jalur";

describe("posMilik", () => {
  const pos = [
    { id: 1, pembimbingId: 7, aktif: true, deletedAt: null },
    { id: 2, pembimbingId: 7, aktif: false, deletedAt: null }, // nonaktif
    { id: 3, pembimbingId: 7, aktif: true, deletedAt: new Date("2026-11-01") }, // dihapus
    { id: 4, pembimbingId: 8, aktif: true, deletedAt: null }, // pembimbing lain
    { id: 5, pembimbingId: null, aktif: true, deletedAt: null },
    { id: 6, pembimbingId: 7, aktif: true, deletedAt: null },
  ];

  it("hanya pos aktif & tidak dihapus yang dia bimbing", () => {
    expect(posMilik(pos, 7)).toEqual([1, 6]);
    expect(posMilik(pos, 8)).toEqual([4]);
    expect(posMilik(pos, 99)).toEqual([]);
  });
});

describe("bolehUrus", () => {
  it("posId harus termasuk pos miliknya; tanpa pos = tidak", () => {
    expect(bolehUrus(1, [1, 6])).toBe(true);
    expect(bolehUrus(4, [1, 6])).toBe(false);
    expect(bolehUrus(null, [1, 6])).toBe(false);
    expect(bolehUrus(undefined, [1, 6])).toBe(false);
    expect(bolehUrus(1, [])).toBe(false);
  });
});

describe("jurnalBolehDicek", () => {
  it("menyaring id massal: pos miliknya DAN belum dicek", () => {
    const jurnal = [
      { id: 10, posId: 1, dicekAt: null },
      { id: 11, posId: 1, dicekAt: new Date("2026-11-05") }, // sudah dicek → tidak ditimpa
      { id: 12, posId: 4, dicekAt: null }, // pos orang lain
      { id: 13, posId: null, dicekAt: null }, // tanpa pos
      { id: 14, posId: 6, dicekAt: null },
    ];
    expect(jurnalBolehDicek(jurnal, [1, 6])).toEqual([10, 14]);
    expect(jurnalBolehDicek(jurnal, [])).toEqual([]);
  });
});

describe("anakDiPos", () => {
  const peserta = [
    { pesertaId: 1, nama: "Peserta B", penugasan: [{ posId: 1, mulai: "2026-11-02", minggu: 2 }, { posId: 4, mulai: "2026-11-16", minggu: 1 }] },
    { pesertaId: 2, nama: "Peserta A", penugasan: [{ posId: 6, mulai: "2026-11-09", minggu: 1 }] },
    { pesertaId: 3, nama: "Peserta C", penugasan: [{ posId: 4, mulai: "2026-11-09", minggu: 1 }] },
  ];

  it("hanya anak yang penugasan minggu INI ada di posnya, urut nama", () => {
    expect(anakDiPos(peserta, [1, 6], "2026-11-09")).toEqual([
      { pesertaId: 2, nama: "Peserta A", posId: 6, mingguKe: 1, dari: 1 },
      { pesertaId: 1, nama: "Peserta B", posId: 1, mingguKe: 2, dari: 2 },
    ]);
  });

  it("anak yang sudah pindah ke pos lain tidak ikut", () => {
    expect(anakDiPos(peserta, [1, 6], "2026-11-16")).toEqual([]);
    expect(anakDiPos(peserta, [4], "2026-11-16").map((a) => a.nama)).toEqual(["Peserta B"]);
  });
});

describe("lisensi bimbingan", () => {
  it("API halaman pribadi pembimbing = hr.assessment (bukan hanya hr.portal)", () => {
    expect(fiturUntuk("/api/public/portal/abc/bimbingan", ATURAN_API)).toBe("hr.assessment");
    expect(fiturUntuk("/api/public/portal/abc/bimbingan/tugas/5", ATURAN_API)).toBe("hr.assessment");
    expect(fiturUntuk("/api/public/portal/abc/bimbingan/jurnal/cek", ATURAN_API)).toBe("hr.assessment");
  });
});
