import { describe, it, expect } from "vitest";
import { susunRotasi, tambahMinggu, type PenugasanAda, type PosRotasi } from "@/lib/services/magang/rotasi";
import { pilihTargetBaru } from "@/lib/services/magang/layanan";

/** Rombongan baru dari sekolah lain tanpa mengacak jadwal yang berjalan (mode "baru", 9 Nov 2026). */

/** Susunan pos prioritas yang diusulkan (Konten ×2, Produksi Print, Produksi Sport, Runner): 2 minggu, kap 3. */
const POS5: PosRotasi[] = [1, 2, 3, 4, 5].map((id) => ({ id, durasiMinggu: 2, kapasitas: 3 }));
const lama = [1, 2, 3, 4].map((id) => ({ id, mulai: "2026-11-16", selesai: "2027-03-29" }));
const jadwalLama = susunRotasi({ pos: POS5, peserta: lama, ada: [], dari: "2026-11-16" });

function mingguAnak(hasil: readonly PenugasanAda[], id: number): string[] {
  const s: string[] = [];
  for (const a of hasil.filter((x) => x.pesertaId === id)) for (let k = 0; k < a.minggu; k++) s.push(tambahMinggu(a.mulai, k));
  return s.sort();
}

function cekKapasitas(semua: readonly PenugasanAda[]) {
  const isi = new Map<string, number>();
  for (const a of semua)
    for (let k = 0; k < a.minggu; k++) {
      const kunci = `${tambahMinggu(a.mulai, k)}#${a.posId}`;
      isi.set(kunci, (isi.get(kunci) ?? 0) + 1);
    }
  for (const [kunci, n] of isi) {
    const kap = POS5.find((p) => p.id === Number(kunci.split("#")[1]))!.kapasitas!;
    expect(n, kunci).toBeLessThanOrEqual(kap);
  }
}

describe("rombongan baru (hanya)", () => {
  it("4 anak baru masuk 7 Des: hanya anak baru yang disusun, kapasitas dihormati, tanpa minggu kosong", () => {
    const baru = [5, 6, 7, 8].map((id) => ({ id, mulai: "2026-12-07", selesai: "2027-03-05" }));
    const hasil = susunRotasi({ pos: POS5, peserta: [...lama, ...baru], ada: jadwalLama, dari: "2026-12-07", hanya: [5, 6, 7, 8] });
    expect(hasil.every((a) => a.pesertaId >= 5)).toBe(true);
    expect(hasil.some((a) => a.berbagi)).toBe(false);
    cekKapasitas([...jadwalLama, ...hasil]);
    for (const id of [5, 6, 7, 8]) {
      const m = mingguAnak(hasil, id);
      expect(new Set(m).size, `anak ${id} dobel`).toBe(m.length);
      expect(m[0]).toBe("2026-12-07");
      expect(m.length).toBe(13); // 7 Des … 1 Mar (minggu yang memuat 5 Mar)
      expect(new Set(hasil.filter((a) => a.pesertaId === id).slice(0, 5).map((a) => a.posId)).size, `anak ${id} belum memegang semua pos`).toBe(5);
    }
  });

  it("tanpa `hanya`, menyusun dari 7 Des MENGUBAH jadwal anak lama (perilaku lama — alasan mode baru)", () => {
    const baru = [5, 6, 7, 8].map((id) => ({ id, mulai: "2026-12-07", selesai: "2027-03-05" }));
    const adaSebelum = jadwalLama.filter((a) => a.mulai < "2026-12-07");
    const semua = susunRotasi({ pos: POS5, peserta: [...lama, ...baru], ada: adaSebelum, dari: "2026-12-07" });
    expect(semua.some((a) => a.pesertaId <= 4)).toBe(true);
  });

  it("12 anak dari 3 rombongan (mulai beda) muat di 5 pos berkapasitas total 15 tanpa berbagi", () => {
    const r2 = [5, 6, 7, 8].map((id) => ({ id, mulai: "2026-12-07", selesai: "2027-03-05" }));
    const j2 = susunRotasi({ pos: POS5, peserta: [...lama, ...r2], ada: jadwalLama, dari: "2026-12-07", hanya: [5, 6, 7, 8] });
    const r3 = [9, 10, 11, 12].map((id) => ({ id, mulai: "2027-01-04", selesai: "2027-03-26" }));
    const j3 = susunRotasi({ pos: POS5, peserta: [...lama, ...r2, ...r3], ada: [...jadwalLama, ...j2], dari: "2027-01-04", hanya: [9, 10, 11, 12] });
    expect(j3.length).toBeGreaterThan(0);
    expect([...j2, ...j3].some((a) => a.berbagi)).toBe(false);
    cekKapasitas([...jadwalLama, ...j2, ...j3]);
  });
});

describe("pilihTargetBaru", () => {
  const pen = [
    { pesertaId: 1, mulai: "2026-11-16", minggu: 2 }, // berjalan sampai 29 Nov
    { pesertaId: 2, mulai: "2026-11-09", minggu: 1 }, // selesai sebelum 16 Nov
  ];
  it("tanpa pilihan: peserta aktif yang belum punya jadwal sejak `dari`", () => {
    expect(pilihTargetBaru([1, 2, 3], pen, "2026-11-23")).toEqual([2, 3]);
  });
  it("dengan pilihan: hanya yang aktif", () => {
    expect(pilihTargetBaru([1, 2, 3], pen, "2026-11-23", [1, 9])).toEqual([1]);
  });
});
