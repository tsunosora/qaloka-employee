import { describe, it, expect } from "vitest";
import {
  pilihSoal,
  periksaKuis,
  nilaiMinggu,
  keadaanJendela,
  tanpaKunci,
  predikat,
  type SoalBank,
} from "@/lib/services/magang/nilai";

const BANK: SoalBank[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  pertanyaan: `Soal ${i + 1}`,
  pilihan: ["a", "b", "c", "d"],
  benar: i % 4,
}));

describe("pilihSoal", () => {
  it("tetap untuk anak & minggu yang sama, berbeda untuk minggu lain", () => {
    const a = pilihSoal(BANK, 3, "2026-11-09").map((s) => s.id);
    expect(pilihSoal(BANK, 3, "2026-11-09").map((s) => s.id)).toEqual(a);
    expect(pilihSoal([...BANK].reverse(), 3, "2026-11-09").map((s) => s.id)).toEqual(a); // urutan bank tak berpengaruh
    expect(pilihSoal(BANK, 3, "2026-11-16").map((s) => s.id)).not.toEqual(a);
    expect(a).toHaveLength(5);
    expect(new Set(a).size).toBe(5);
  });

  it("bank kurang dari 5 → semua soal dipakai", () => {
    expect(pilihSoal(BANK.slice(0, 2), 1, "2026-11-09")).toHaveLength(2);
  });
});

describe("tanpaKunci", () => {
  it("tidak membocorkan jawaban benar", () => {
    expect(tanpaKunci(BANK[0])).not.toHaveProperty("benar");
  });
});

describe("periksaKuis", () => {
  it("menilai hanya soal yang diberikan; jawaban tak sah = kosong", () => {
    const diberikan = BANK.slice(0, 4); // benar: 0,1,2,3
    const { skor, rincian } = periksaKuis(diberikan, { "1": 0, "2": 1, "3": 9, "99": 0 });
    expect(skor).toBe(50);
    expect(rincian.find((r) => r.soalId === 3)!.dipilih).toBeNull();
    expect(rincian.find((r) => r.soalId === 4)!.dipilih).toBeNull();
    expect(rincian).toHaveLength(4);
  });

  it("pos tanpa soal → skor null", () => {
    expect(periksaKuis([], {}).skor).toBeNull();
  });
});

describe("nilaiMinggu", () => {
  const penuh = { ketelitian: 4, kecepatan: 4, inisiatif: 4, sikap: 4 };
  it("semua sempurna = 100, semua terendah = 0", () => {
    expect(nilaiMinggu({ skorKuis: 100, nilaiIngatan: 4, praktik: penuh })).toBe(100);
    expect(nilaiMinggu({ skorKuis: 0, nilaiIngatan: 1, praktik: { ketelitian: 1, kecepatan: 1, inisiatif: 1, sikap: 1 } })).toBe(0);
  });

  it("belum dinilai lengkap → null", () => {
    expect(nilaiMinggu({ skorKuis: 80, nilaiIngatan: null, praktik: penuh })).toBeNull();
    expect(nilaiMinggu({ skorKuis: 80, nilaiIngatan: 3, praktik: { ketelitian: 3 } })).toBeNull();
  });

  it("tanpa kuis, bobot kuis pindah ke ingatan", () => {
    expect(nilaiMinggu({ skorKuis: null, nilaiIngatan: 4, praktik: { ketelitian: 1, kecepatan: 1, inisiatif: 1, sikap: 1 } })).toBe(50);
  });

  it("predikat", () => {
    expect(predikat(null)).toBe("Belum dinilai");
    expect(predikat(90)).toBe("Sangat baik");
    expect(predikat(40)).toBe("Perlu bimbingan");
  });
});

describe("keadaanJendela", () => {
  it("buka Jumat sampai Senin berikutnya, sesudahnya terlambat", () => {
    expect(keadaanJendela("2026-11-09", "2026-11-12")).toBe("belum"); // Kamis
    expect(keadaanJendela("2026-11-09", "2026-11-13")).toBe("buka"); // Jumat
    expect(keadaanJendela("2026-11-09", "2026-11-16")).toBe("buka"); // Senin berikutnya
    expect(keadaanJendela("2026-11-09", "2026-11-17")).toBe("terlambat");
  });
});
