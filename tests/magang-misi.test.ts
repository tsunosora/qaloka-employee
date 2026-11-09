import { describe, it, expect } from "vitest";
import {
  progresMisi,
  periksaBukti,
  uraiBukti,
  gabungBukti,
  tautanSah,
  bolehKirimMisi,
  KUNCI_KATEGORI,
} from "@/lib/services/magang/misi";
import { CONTOH_MISI } from "@/lib/services/magang/contoh-misi";
import { misiSchema, kirimMisiSchema, putusMisiSchema } from "@/lib/validators/magang";

describe("side quest — progres per kategori", () => {
  const misi = [
    { id: 1, kategori: "cs", poin: 10 },
    { id: 2, kategori: "cs", poin: 15 },
    { id: 3, kategori: "desain", poin: 30 },
    { id: 4, kategori: "marketing", poin: 10 },
  ];

  it("menghitung x/y dan poin hanya dari yang disetujui", () => {
    const p = progresMisi(misi, [
      { misiId: 1, status: "disetujui" },
      { misiId: 2, status: "menunggu" },
      { misiId: 3, status: "ditolak" },
    ]);
    const cs = p.kategori.find((k) => k.kategori === "cs")!;
    expect(cs).toMatchObject({ selesai: 1, menunggu: 1, total: 2, poin: 10, poinMaks: 25 });
    expect(p.kategori.find((k) => k.kategori === "desain")).toMatchObject({ selesai: 0, ditolak: 1, total: 1 });
    expect(p).toMatchObject({ selesai: 1, menunggu: 1, total: 4, poin: 10, poinMaks: 65 });
  });

  it("peserta baru (tanpa kiriman) otomatis mendapat semua misi aktif", () => {
    const p = progresMisi(misi, []);
    expect(p.total).toBe(4);
    expect(p.selesai).toBe(0);
  });

  it("kiriman untuk misi yang sudah dinonaktifkan tidak ikut dihitung", () => {
    const p = progresMisi(misi.slice(0, 1), [
      { misiId: 1, status: "disetujui" },
      { misiId: 99, status: "disetujui" },
    ]);
    expect(p).toMatchObject({ selesai: 1, total: 1 });
  });

  it("kategori tanpa misi tidak ditampilkan", () => {
    expect(progresMisi([{ id: 1, kategori: "cs", poin: 5 }], []).kategori.map((k) => k.kategori)).toEqual(["cs"]);
  });
});

describe("side quest — bukti", () => {
  it("bukti diurai urut, tanpa ganda; kosong = foto", () => {
    expect(uraiBukti("teks,foto,teks,xx")).toEqual(["foto", "teks"]);
    expect(uraiBukti("")).toEqual(["foto"]);
    expect(gabungBukti(["tautan", "foto"])).toBe("foto,tautan");
  });

  it("semua bukti yang diminta wajib ada", () => {
    expect(periksaBukti(["foto"], { teks: null, tautan: null, jumlahFoto: 0 })).toMatch(/foto/);
    expect(periksaBukti(["foto"], { teks: null, tautan: null, jumlahFoto: 1 })).toBeNull();
    expect(periksaBukti(["teks"], { teks: "pendek", tautan: null, jumlahFoto: 0 })).toMatch(/minimal/);
    expect(periksaBukti(["tautan"], { teks: null, tautan: null, jumlahFoto: 0 })).toMatch(/tautan/i);
    expect(periksaBukti(["foto", "teks"], { teks: "x".repeat(25), tautan: null, jumlahFoto: 2 })).toBeNull();
    expect(periksaBukti(["foto"], { teks: null, tautan: null, jumlahFoto: 4 })).toMatch(/maksimal/);
  });

  it("tautan harus http(s) — javascript: ditolak", () => {
    expect(tautanSah("https://instagram.com/p/abc")).toBe(true);
    expect(tautanSah("javascript:alert(1)")).toBe(false);
    expect(periksaBukti([], { teks: null, tautan: "javascript:alert(1)", jumlahFoto: 0 })).toMatch(/https/);
  });

  it("bukti yang sudah disetujui terkunci; ditolak/menunggu boleh dikirim ulang", () => {
    expect(bolehKirimMisi(null)).toBe(true);
    expect(bolehKirimMisi("menunggu")).toBe(true);
    expect(bolehKirimMisi("ditolak")).toBe(true);
    expect(bolehKirimMisi("disetujui")).toBe(false);
  });
});

describe("side quest — validator", () => {
  it("misi: kategori harus dikenal, bukti minimal satu", () => {
    expect(misiSchema.safeParse({ kategori: "cs", judul: "Balas chat", bukti: ["teks"] }).success).toBe(true);
    expect(misiSchema.safeParse({ kategori: "konten", judul: "Balas chat", bukti: ["teks"] }).success).toBe(false);
    expect(misiSchema.safeParse({ kategori: "cs", judul: "Balas chat", bukti: [] }).success).toBe(false);
  });

  it("tolak wajib dengan catatan perbaikan", () => {
    expect(putusMisiSchema.safeParse({ aksi: "tolak" }).success).toBe(false);
    expect(putusMisiSchema.safeParse({ aksi: "tolak", catatan: "Fotonya buram" }).success).toBe(true);
    expect(putusMisiSchema.safeParse({ aksi: "setujui" }).success).toBe(true);
  });

  it("kiriman multipart: misiId dari teks, hapusFoto diurai", () => {
    const r = kirimMisiSchema.parse({ misiId: "3", teks: " ", hapusFoto: "0,2" });
    expect(r).toMatchObject({ misiId: 3, teks: null, hapusFoto: [0, 2] });
  });
});

describe("bank misi awal (dari dokumen Materi Internship)", () => {
  it("ketiga kategori terisi, semuanya sah menurut validator", () => {
    for (const k of KUNCI_KATEGORI) expect(CONTOH_MISI.filter((m) => m.kategori === k).length).toBeGreaterThanOrEqual(5);
    for (const m of CONTOH_MISI) expect(misiSchema.safeParse(m).success, m.judul).toBe(true);
  });

  it("tugas akhir jersey fantasy ada di Desain Grafis", () => {
    expect(CONTOH_MISI.some((m) => m.kategori === "desain" && /jersey fantasy/i.test(m.judul))).toBe(true);
  });

  it("tidak mengarang harga (tanpa angka rupiah)", () => {
    for (const m of CONTOH_MISI) expect(`${m.judul} ${m.deskripsi}`).not.toMatch(/Rp\s?\d/);
  });
});
