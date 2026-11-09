import { describe, it, expect } from "vitest";
import { POS_PRIORITAS, BARIS_FOTO_VIDEO, POS_LAMA_NONAKTIF, rencanakan, type PosDb } from "@/lib/services/magang/pos-prioritas";
import { posSchema, soalSchema } from "@/lib/validators/magang";
import { susunRotasi, type PenugasanAda, type PenugasanBaru } from "@/lib/services/magang/rotasi";

/** Keputusan owner 9 Nov 2026: rotasi utama = Konten + Produksi; CS & Desain jadi side quest. */
describe("pos prioritas (Konten + Produksi)", () => {
  it("5 pos, 2 minggu, kapasitas 3, lolos posSchema", () => {
    expect(POS_PRIORITAS.map((p) => p.nama)).toEqual([
      "Konten: Shooting & Talent",
      "Konten: Editing, Copywriting & Posting",
      "Produksi: Voliko Print",
      "Produksi: Voliko Sport",
      "Runner & Stok",
    ]);
    for (const p of POS_PRIORITAS) {
      expect(p.durasiMinggu, p.nama).toBe(2);
      expect(p.kapasitas, p.nama).toBe(3);
      const r = posSchema.safeParse({ ...p, pembimbingId: 13, aktif: true });
      expect(r.success, `${p.nama}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
    expect(POS_PRIORITAS.find((p) => p.nama === "Produksi: Voliko Sport")?.lokasi).toBe("Voliko Sport");
    expect(POS_PRIORITAS.filter((p) => p.lokasi !== null)).toHaveLength(1);
  });

  it("deskripsi = daftar target berbutir + kewajiban foto & video produk jadi", () => {
    for (const p of POS_PRIORITAS) {
      const baris = p.deskripsi.split("\n");
      expect(baris.length, p.nama).toBeGreaterThanOrEqual(5);
      for (const b of baris) expect(b.startsWith("- "), b).toBe(true);
      expect(p.deskripsi, p.nama).toContain(BARIS_FOTO_VIDEO);
      expect(p.deskripsi, p.nama).toMatch(/foto/i);
      expect(p.deskripsi, p.nama).toMatch(/video/i);
    }
  });

  it("8–10 soal per pos, lolos soalSchema, 4 pilihan, tanpa soal kembar", () => {
    for (const p of POS_PRIORITAS) {
      expect(p.soal.length, p.nama).toBeGreaterThanOrEqual(8);
      expect(p.soal.length, p.nama).toBeLessThanOrEqual(10);
      expect(new Set(p.soal.map((s) => s.pertanyaan)).size, p.nama).toBe(p.soal.length);
      for (const s of p.soal) {
        expect(s.pilihan, s.pertanyaan).toHaveLength(4);
        expect(new Set(s.pilihan).size, s.pertanyaan).toBe(4);
        const r = soalSchema.safeParse({ posId: 1, ...s, aktif: true });
        expect(r.success, `${s.pertanyaan}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
      }
    }
  });

  it("tidak ada nominal harga (Rp)", () => {
    const semua = JSON.stringify(POS_PRIORITAS);
    expect(semua).not.toMatch(/\bRp\.?\s?\d/i);
    expect(semua).not.toMatch(/rupiah/i);
  });

  it("kunci jawaban tersebar di indeks 0–3 (tiap pos memakai ≥3 indeks berbeda)", () => {
    const hitung = [0, 0, 0, 0];
    for (const p of POS_PRIORITAS) {
      const dipakai = new Set(p.soal.map((s) => s.benar));
      expect(dipakai.size, p.nama).toBeGreaterThanOrEqual(3);
      for (const s of p.soal) hitung[s.benar]++;
    }
    for (const n of hitung) expect(n).toBeGreaterThan(0);
    const total = hitung.reduce((a, b) => a + b, 0);
    for (const n of hitung) expect(n / total).toBeLessThan(0.4);
  });

  it("pos lama yang dinonaktifkan tidak termasuk Orientasi", () => {
    expect(POS_LAMA_NONAKTIF).toEqual(["Customer Service", "Desainer", "Operator Outdoor", "Operator A3+"]);
    expect(POS_LAMA_NONAKTIF.some((n) => /orientasi/i.test(n))).toBe(false);
  });
});

// ── Simulasi rotasi ─────────────────────────────────────────────────────────────────────────

const PESERTA = [1, 2, 3, 4].map((id) => ({ id, mulai: "2026-11-16", selesai: "2027-03-29" }));
const ORIENTASI: PenugasanAda[] = PESERTA.map((p) => ({ pesertaId: p.id, posId: 99, mulai: "2026-11-09", minggu: 1 }));

function cekTiapAnakPegangSemua(usulan: readonly PenugasanBaru[], posIds: readonly number[]) {
  for (const p of PESERTA) {
    const blok = usulan.filter((a) => a.pesertaId === p.id).sort((a, b) => (a.mulai < b.mulai ? -1 : 1));
    // 20 minggu (16 Nov – 29 Mar) = 10 blok 2 minggu = 2 putaran penuh.
    expect(blok.length, `anak ${p.id}`).toBe(10);
    for (let putaran = 0; putaran * posIds.length < blok.length; putaran++) {
      const isi = blok.slice(putaran * posIds.length, (putaran + 1) * posIds.length).map((a) => a.posId);
      expect(new Set(isi).size, `anak ${p.id} putaran ${putaran + 1}`).toBe(isi.length);
    }
    expect(blok[0].mulai).toBe("2026-11-16");
    // Tanpa celah: blok berikutnya mulai tepat saat blok sebelumnya selesai.
    for (let i = 1; i < blok.length; i++) {
      const [y, m, d] = blok[i - 1].mulai.split("-").map(Number);
      const akhir = new Date(Date.UTC(y, m - 1, d + 7 * blok[i - 1].minggu)).toISOString().slice(0, 10);
      expect(blok[i].mulai).toBe(akhir);
    }
  }
}

describe("simulasi rotasi pos prioritas (4 anak, 16 Nov 2026 – 29 Mar 2027)", () => {
  it("susunRotasi: tiap anak memegang ke-5 pos sebelum mengulang, tanpa berbagi, Orientasi tetap", () => {
    const pos = POS_PRIORITAS.map((p, i) => ({ id: i + 1, durasiMinggu: p.durasiMinggu, kapasitas: p.kapasitas }));
    const usulan = susunRotasi({ pos, peserta: PESERTA, ada: ORIENTASI, dari: "2026-11-16" });
    expect(usulan.every((a) => a.mulai >= "2026-11-16")).toBe(true);
    expect(usulan.some((a) => a.posId === 99)).toBe(false);
    expect(usulan.filter((a) => a.berbagi)).toHaveLength(0);
    expect(usulan.map((a) => a.mulai).sort()[0]).toBe("2026-11-16");
    cekTiapAnakPegangSemua(usulan, pos.map((p) => p.id));
  });

  it("rencanakan(): placeholder negatif, pos lama dinonaktifkan, Orientasi dipertahankan & diingatkan", () => {
    const posDb: PosDb[] = [
      { id: 99, nama: "Orientasi & Training (Pusat)", aktif: true, durasiMinggu: 1, kapasitas: 10, jumlahSoal: 3 },
      { id: 5, nama: "Customer Service", aktif: true, durasiMinggu: 2, kapasitas: 1, jumlahSoal: 5 },
      { id: 6, nama: "Desainer", aktif: false, durasiMinggu: 2, kapasitas: 1, jumlahSoal: 5 },
      { id: 7, nama: "Operator A3+", aktif: true, durasiMinggu: 2, kapasitas: 1, jumlahSoal: 5 },
      // Satu pos baru sudah pernah dibuat (mis. skrip dijalankan ulang) tapi belum punya soal.
      { id: 50, nama: "Runner & Stok", aktif: true, durasiMinggu: 2, kapasitas: 3, jumlahSoal: 0 },
    ];
    const lamaSesudah: PenugasanAda = { pesertaId: 1, posId: 5, mulai: "2026-11-23", minggu: 2 };
    const r = rencanakan({ posDb, peserta: PESERTA, penugasan: [...ORIENTASI, lamaSesudah], dari: "2026-11-16" });

    expect(r.masalah).toEqual([]);
    expect(r.pos.map((p) => p.id)).toEqual([-1, -2, -3, -4, 50]);
    expect(r.pos.filter((p) => p.baru)).toHaveLength(4);
    expect(r.pos.find((p) => p.id === 50)?.tambahSoal).toBe(true);
    expect(r.nonaktifkan).toEqual([
      { id: 5, nama: "Customer Service" },
      { id: 7, nama: "Operator A3+" },
    ]);
    expect(r.tetapAktif).toEqual([{ id: 99, nama: "Orientasi & Training (Pusat)" }]);
    expect(r.ada).toEqual(ORIENTASI);
    expect(r.berjalan).toEqual([]);
    expect(r.hapus).toEqual([lamaSesudah]);
    expect(r.usulan.filter((a) => a.berbagi)).toHaveLength(0);
    cekTiapAnakPegangSemua(r.usulan, r.pos.map((p) => p.id));
  });

  it("rencanakan(): berhenti bila bukan Senin, nama pos kembar, atau pos baru nonaktif", () => {
    expect(rencanakan({ posDb: [], peserta: PESERTA, penugasan: [], dari: "2026-11-17" }).masalah[0]).toMatch(/bukan hari Senin/);
    const kembar = rencanakan({
      posDb: [
        { id: 1, nama: "Runner & Stok", aktif: true, durasiMinggu: 2, kapasitas: 3, jumlahSoal: 0 },
        { id: 2, nama: "Runner & Stok", aktif: true, durasiMinggu: 2, kapasitas: 3, jumlahSoal: 0 },
      ],
      peserta: PESERTA,
      penugasan: [],
      dari: "2026-11-16",
    });
    expect(kembar.masalah.join(" ")).toMatch(/2 pos bernama/);
    expect(kembar.usulan).toEqual([]);
    const nonaktif = rencanakan({
      posDb: [{ id: 1, nama: "Produksi: Voliko Print", aktif: false, durasiMinggu: 2, kapasitas: 3, jumlahSoal: 9 }],
      peserta: PESERTA,
      penugasan: [],
      dari: "2026-11-16",
    });
    expect(nonaktif.masalah.join(" ")).toMatch(/NONAKTIF/);
  });

  it("rencanakan(): penugasan lama yang masih berjalan melewati tanggal mulai dilaporkan", () => {
    const panjang: PenugasanAda = { pesertaId: 2, posId: 5, mulai: "2026-11-09", minggu: 2 };
    const r = rencanakan({ posDb: [], peserta: PESERTA, penugasan: [panjang], dari: "2026-11-16" });
    expect(r.berjalan).toEqual([panjang]);
    expect(r.usulan.filter((a) => a.pesertaId === 2)[0].mulai).toBe("2026-11-23");
  });
});
