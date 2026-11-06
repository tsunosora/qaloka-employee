import { describe, it, expect } from "vitest";
import { susunRapor } from "@/lib/services/magang/rapor";
import { mingguTugas } from "@/lib/services/magang/layanan";
import { fiturUntuk, ATURAN_API, ATURAN_HALAMAN } from "@/lib/lisensi/aturan-jalur";

const praktik = (n: number | null) => ({ ketelitian: n, kecepatan: n, inisiatif: n, sikap: n });

describe("susunRapor", () => {
  const namaPos = new Map([
    [1, "Operator Cetak"],
    [2, "Packing"],
    [3, "Gudang"],
  ]);
  const penugasan = [
    { posId: 1, mulai: "2026-11-09", minggu: 2 },
    { posId: 2, mulai: "2026-11-23", minggu: 1 },
    { posId: 3, mulai: "2026-11-30", minggu: 1 }, // mendatang
  ];
  const tugas = [
    { senin: "2026-11-09", posId: 1, skorKuis: 60, nilai: 60, nilaiIngatan: 3, praktik: praktik(3), terlambat: false },
    { senin: "2026-11-16", posId: 1, skorKuis: 100, nilai: 90, nilaiIngatan: 4, praktik: praktik(4), terlambat: true },
    { senin: "2026-11-23", posId: 2, skorKuis: 80, nilai: null, nilaiIngatan: null, praktik: praktik(null), terlambat: false },
  ];

  it("hanya pos yang sudah dijalani; nilai per pos = rata minggu yang dinilai", () => {
    const r = susunRapor({ penugasan, tugas, namaPos, sampai: "2026-11-23" });
    expect(r.baris.map((b) => b.nama)).toEqual(["Operator Cetak", "Packing"]);
    expect(r.baris[0].nilai).toBe(75);
    expect(r.baris[0].tugasDikirim).toBe(2);
    expect(r.baris[0].praktik.ketelitian).toBe(3.5);
    expect(r.baris[1].nilai).toBeNull();
    expect(r.baris[1].predikat).toBe("Belum dinilai");
  });

  it("ringkasan keseluruhan", () => {
    const r = susunRapor({ penugasan, tugas, namaPos, sampai: "2026-11-23" });
    expect(r.nilaiAkhir).toBe(75);
    expect(r.rataKuis).toBe(80);
    expect(r.tugasDikirim).toBe(3);
    expect(r.tugasTerlambat).toBe(1);
    expect(r.mingguBerjalan).toBe(3);
    expect(r.jumlahPos).toBe(2);
  });
});

describe("mingguTugas", () => {
  const pen = [
    { id: 1, pesertaId: 1, posId: 1, mulai: "2026-11-09", minggu: 2, berbagi: false },
    { id: 2, pesertaId: 1, posId: 2, mulai: "2026-11-23", minggu: 1, berbagi: false },
  ];
  it("minggu ini belum muncul sebelum Jumat; minggu lalu yang belum diisi muncul", () => {
    expect(mingguTugas(pen, new Set(["2026-11-09"]), "2026-11-25")).toEqual(["2026-11-16"]); // Rabu
    expect(mingguTugas(pen, new Set(["2026-11-09", "2026-11-16"]), "2026-11-27")).toEqual(["2026-11-23"]); // Jumat
    expect(mingguTugas(pen, new Set(), "2026-11-27")).toEqual(["2026-11-09", "2026-11-16", "2026-11-23"]);
  });
  it("tidak memunculkan minggu tanpa pos atau minggu depan", () => {
    expect(mingguTugas(pen, new Set(), "2026-11-06")).toEqual([]);
  });
});

describe("lisensi jalur magang", () => {
  it("API, portal, dan halaman magang ikut hr.assessment (paket Kinerja)", () => {
    expect(fiturUntuk("/api/magang/rotasi", ATURAN_API)).toBe("hr.assessment");
    expect(fiturUntuk("/api/public/portal/abc/magang", ATURAN_API)).toBe("hr.assessment");
    expect(fiturUntuk("/api/public/portal/abc", ATURAN_API)).toBe("hr.portal");
    expect(fiturUntuk("/magang/rapor/3", ATURAN_HALAMAN)).toBe("hr.assessment");
  });
});
