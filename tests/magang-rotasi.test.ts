import { describe, it, expect } from "vitest";
import {
  susunRotasi,
  seninDari,
  tambahMinggu,
  penugasanPada,
  type PenugasanAda,
  type PosRotasi,
} from "@/lib/services/magang/rotasi";

const SENIN = "2026-11-09"; // Senin

/** 7 pos: 3 berat (2 minggu), 4 ringan (1 minggu) — bentuk yang dipilih owner. */
const POS: PosRotasi[] = [
  { id: 1, durasiMinggu: 2 },
  { id: 2, durasiMinggu: 1 },
  { id: 3, durasiMinggu: 2 },
  { id: 4, durasiMinggu: 1 },
  { id: 5, durasiMinggu: 2 },
  { id: 6, durasiMinggu: 1 },
  { id: 7, durasiMinggu: 1 },
];

const peserta = (n: number, selesai = "2027-02-05") =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, mulai: SENIN, selesai }));

/** Pos yang dipegang anak per minggu → untuk memeriksa tidak ada minggu kosong/tumpang. */
function petaMinggu(hasil: PenugasanAda[], pesertaId: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of hasil.filter((x) => x.pesertaId === pesertaId)) {
    for (let k = 0; k < a.minggu; k++) {
      const s = tambahMinggu(a.mulai, k);
      expect(m.has(s), `minggu ${s} dobel untuk anak ${pesertaId}`).toBe(false);
      m.set(s, a.posId);
    }
  }
  return m;
}

describe("seninDari", () => {
  it("mengembalikan Senin minggu itu", () => {
    expect(seninDari("2026-11-09")).toBe("2026-11-09");
    expect(seninDari("2026-11-13")).toBe("2026-11-09"); // Jumat
    expect(seninDari("2026-11-15")).toBe("2026-11-09"); // Minggu
    expect(seninDari("2026-11-16")).toBe("2026-11-16");
    expect(seninDari("2027-01-01")).toBe("2026-12-28"); // lintas tahun
  });
});

describe("susunRotasi", () => {
  it("tiap anak memegang SEMUA pos sebelum mengulang", () => {
    const hasil = susunRotasi({ pos: POS, peserta: peserta(5), ada: [], dari: SENIN });
    for (let id = 1; id <= 5; id++) {
      const urut = hasil.filter((a) => a.pesertaId === id).map((a) => a.posId);
      const tujuhPertama = urut.slice(0, POS.length);
      expect(new Set(tujuhPertama).size, `anak ${id}: ${urut.join(",")}`).toBe(POS.length);
    }
  });

  it("lama penugasan ikut durasi pos dan tidak ada minggu kosong / tumpang", () => {
    const hasil = susunRotasi({ pos: POS, peserta: peserta(6), ada: [], dari: SENIN });
    const terakhir = seninDari("2027-02-05");
    for (let id = 1; id <= 6; id++) {
      const peta = petaMinggu(hasil, id);
      for (let s = SENIN; s <= terakhir; s = tambahMinggu(s, 1)) expect(peta.has(s), `anak ${id} kosong di ${s}`).toBe(true);
    }
    for (const a of hasil) {
      const durasi = POS.find((p) => p.id === a.posId)!.durasiMinggu;
      // Hanya penugasan terakhir yang boleh dipotong oleh tanggal selesai.
      if (a.minggu !== durasi) expect(tambahMinggu(a.mulai, a.minggu - 1)).toBe(terakhir);
    }
  });

  it("anak-anak tidak berebut pos yang sama selama posnya cukup", () => {
    const hasil = susunRotasi({ pos: POS, peserta: peserta(4), ada: [], dari: SENIN });
    const berbagi = hasil.filter((a) => a.berbagi);
    // 4 anak, 7 pos → mestinya hampir selalu ada pos kosong. Ukur supaya regresi terlihat.
    expect(berbagi.length).toBeLessThanOrEqual(2);
    for (let w = 0; w < 6; w++) {
      const s = tambahMinggu(SENIN, w);
      const posMingguIni = [1, 2, 3, 4].map((id) => penugasanPada(hasil.filter((a) => a.pesertaId === id), s)?.posId);
      const tanpaBerbagi = posMingguIni.filter((_, i) => !penugasanPada(hasil.filter((a) => a.pesertaId === i + 1), s)?.berbagi);
      expect(new Set(tanpaBerbagi).size).toBe(tanpaBerbagi.length);
    }
  });

  it("anak lebih banyak dari pos → tetap dapat pos, ditandai berbagi", () => {
    const pos = POS.slice(0, 3);
    const hasil = susunRotasi({ pos, peserta: peserta(5, "2026-11-29"), ada: [], dari: SENIN });
    expect(hasil.filter((a) => a.mulai === SENIN)).toHaveLength(5);
    expect(hasil.some((a) => a.berbagi)).toBe(true);
  });

  it("anak yang masuk di tengah jalan disusun mulai minggu masuknya", () => {
    const masuk = tambahMinggu(SENIN, 3);
    const hasil = susunRotasi({
      pos: POS,
      peserta: [...peserta(2), { id: 9, mulai: "2026-12-02", selesai: "2027-02-05" }], // Rabu → Senin 30 Nov
      ada: [],
      dari: SENIN,
    });
    const milik9 = hasil.filter((a) => a.pesertaId === 9);
    expect(milik9[0].mulai).toBe(masuk);
  });

  it("susun ulang menghormati riwayat & pos yang sedang berjalan", () => {
    const ada: PenugasanAda[] = [
      { pesertaId: 1, posId: 1, mulai: SENIN, minggu: 2 },
      { pesertaId: 1, posId: 2, mulai: tambahMinggu(SENIN, 2), minggu: 1 },
      { pesertaId: 2, posId: 3, mulai: tambahMinggu(SENIN, 2), minggu: 2 }, // masih jalan di minggu ke-4
    ];
    const dari = tambahMinggu(SENIN, 3);
    const hasil = susunRotasi({ pos: POS, peserta: peserta(2), ada, dari });
    expect(hasil.every((a) => a.mulai >= dari)).toBe(true);
    // Anak 2 baru bebas sesudah pos 3 selesai.
    expect(hasil.find((a) => a.pesertaId === 2)!.mulai).toBe(tambahMinggu(SENIN, 4));
    // Anak 1 tidak mengulang pos 1 & 2 sebelum 5 pos lain terpegang.
    const lanjut1 = hasil.filter((a) => a.pesertaId === 1).slice(0, 5).map((a) => a.posId);
    expect(lanjut1).not.toContain(1);
    expect(lanjut1).not.toContain(2);
  });

  it("tanpa pos atau tanpa anak → kosong", () => {
    expect(susunRotasi({ pos: [], peserta: peserta(3), ada: [], dari: SENIN })).toEqual([]);
    expect(susunRotasi({ pos: POS, peserta: [], ada: [], dari: SENIN })).toEqual([]);
  });

  it("tanggal selesai kosong → disusun 13 minggu, tidak tak terbatas", () => {
    const hasil = susunRotasi({ pos: POS, peserta: [{ id: 1, mulai: SENIN, selesai: null }], ada: [], dari: SENIN });
    const total = hasil.reduce((s, a) => s + a.minggu, 0);
    expect(total).toBe(13);
  });
});
