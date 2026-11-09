import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  progresMisi,
  slugKategori,
  kunciKategoriUnik,
  periksaKategoriMisi,
  periksaPindahKategori,
  bolehHapusKategori,
  labelKategori,
  petaKategori,
  urutkanKategori,
  KATEGORI_AWAL,
  POLA_KUNCI_KATEGORI,
  MAKS_KUNCI_KATEGORI,
} from "@/lib/services/magang/misi";
import { kategoriMisiSchema, ubahKategoriMisiSchema, pindahKategoriMisiSchema, urutanKategoriMisiSchema } from "@/lib/validators/magang";

const kat = (kunci: string, nama: string, urutan: number, aktif = true, prioritas: string | null = null) => ({ kunci, nama, urutan, aktif, prioritas, ringkas: null });

describe("kategori side quest — progres dinamis", () => {
  const misi = [
    { id: 1, kategori: "cs", poin: 10 },
    { id: 2, kategori: "foto-produk", poin: 20 },
    { id: 3, kategori: "foto-produk", poin: 20 },
    { id: 4, kategori: "arsip", poin: 5 },
  ];

  it("kategori buatan admin ikut dihitung, urut menurut `urutan` (bukan abjad/kunci)", () => {
    const p = progresMisi(misi, [{ misiId: 2, status: "disetujui" }], [kat("cs", "Customer Service", 2), kat("foto-produk", "Fotografi Produk", 1, true, "Tinggi")]);
    expect(p.kategori.map((k) => k.kategori)).toEqual(["foto-produk", "cs", "lain"]);
    expect(p.kategori[0]).toMatchObject({ label: "Fotografi Produk", prioritas: "Tinggi", selesai: 1, total: 2, poin: 20, poinMaks: 40 });
    expect(p.kategori[1].prioritas).toBe("—");
  });

  it("misi di kategori NONAKTIF tidak dihitung — sama seperti misi nonaktif", () => {
    const p = progresMisi(misi.slice(0, 3), [{ misiId: 2, status: "disetujui" }], [kat("cs", "Customer Service", 1), kat("foto-produk", "Fotografi Produk", 2, false)]);
    expect(p.kategori.map((k) => k.kategori)).toEqual(["cs"]);
    expect(p).toMatchObject({ selesai: 0, total: 1, poinMaks: 10 });
  });

  it("kunci yang tidak ada di daftar tetap masuk 'Lainnya' (tidak hilang diam-diam)", () => {
    const p = progresMisi(misi, [{ misiId: 4, status: "menunggu" }], [kat("cs", "Customer Service", 1)]);
    const lain = p.kategori.find((k) => k.kategori === "lain")!;
    expect(lain).toMatchObject({ label: "Lainnya", total: 3, menunggu: 1 });
  });

  it("tanpa kategori sama sekali → semua misi di 'Lainnya'", () => {
    expect(progresMisi(misi, [], []).kategori.map((k) => k.kategori)).toEqual(["lain"]);
  });

  it("label diambil dari DB; kunci tak dikenal tampil apa adanya", () => {
    const peta = petaKategori([kat("cs", "Layanan Pelanggan", 1)]);
    expect(labelKategori("cs", peta)).toBe("Layanan Pelanggan");
    expect(labelKategori("zzz", peta)).toBe("zzz");
  });

  it("urutkanKategori: urutan lalu nama", () => {
    expect(urutkanKategori([kat("b", "Beta", 2), kat("c", "Charlie", 1), kat("a", "Alfa", 2)]).map((k) => k.kunci)).toEqual(["c", "a", "b"]);
  });
});

describe("kategori side quest — kunci (slug)", () => {
  it("slug dari nama: huruf kecil, tanda baca → '-', aksen dibuang", () => {
    expect(slugKategori("Desain Grafis")).toBe("desain-grafis");
    expect(slugKategori("  Foto & Video!! ")).toBe("foto-video");
    expect(slugKategori("Café Kréatif")).toBe("cafe-kreatif");
    expect(slugKategori("!!!")).toBe("kategori");
    for (const n of ["Desain Grafis", "Foto & Video", "A".repeat(100)]) expect(slugKategori(n)).toMatch(POLA_KUNCI_KATEGORI);
  });

  it("slug dibatasi 40 huruf tanpa '-' menggantung", () => {
    const s = slugKategori("Pemasaran digital lewat media sosial dan marketplace besar");
    expect(s.length).toBeLessThanOrEqual(MAKS_KUNCI_KATEGORI);
    expect(s.endsWith("-")).toBe(false);
  });

  it("kunci unik: akhiran -2, -3 bila sudah dipakai (tanpa beda huruf besar/kecil)", () => {
    expect(kunciKategoriUnik("Customer Service", ["cs"])).toBe("customer-service");
    expect(kunciKategoriUnik("Desain", ["desain"])).toBe("desain-2");
    expect(kunciKategoriUnik("Desain", ["desain", "DESAIN-2"])).toBe("desain-3");
    const panjang = "x".repeat(60);
    const k = kunciKategoriUnik(panjang, [slugKategori(panjang)]);
    expect(k.length).toBeLessThanOrEqual(MAKS_KUNCI_KATEGORI);
    expect(k.endsWith("-2")).toBe(true);
  });
});

describe("kategori side quest — aturan pakai, hapus, pindah", () => {
  const daftar = [kat("cs", "Customer Service", 1), kat("arsip", "Arsip", 2, false)];

  it("misi hanya boleh memakai kategori yang ada & aktif", () => {
    expect(periksaKategoriMisi("cs", daftar)).toBeNull();
    expect(periksaKategoriMisi("tidak-ada", daftar)).toMatch(/tidak ditemukan/);
    expect(periksaKategoriMisi("arsip", daftar)).toMatch(/nonaktif/);
    // misi yang memang sudah di kategori nonaktif boleh disunting tanpa dipaksa pindah
    expect(periksaKategoriMisi("arsip", daftar, "arsip")).toBeNull();
    expect(periksaKategoriMisi("arsip", daftar, "cs")).toMatch(/nonaktif/);
  });

  it("hapus hanya bila tidak dirujuk misi mana pun (termasuk yang terhapus)", () => {
    expect(bolehHapusKategori(0)).toBe(true);
    expect(bolehHapusKategori(1)).toBe(false);
  });

  it("pindah: tujuan harus ada, berbeda, dan aktif", () => {
    expect(periksaPindahKategori({ kunci: "arsip" }, daftar[0])).toBeNull();
    expect(periksaPindahKategori({ kunci: "cs" }, null)).toMatch(/tidak ditemukan/);
    expect(periksaPindahKategori({ kunci: "cs" }, daftar[0])).toMatch(/berbeda/);
    expect(periksaPindahKategori({ kunci: "cs" }, daftar[1])).toMatch(/nonaktif/);
  });
});

describe("kategori side quest — validator", () => {
  it("tambah: nama minimal 2 huruf; prioritas & ringkas boleh kosong", () => {
    expect(kategoriMisiSchema.parse({ nama: " Fotografi ", prioritas: "", ringkas: null })).toEqual({ nama: "Fotografi", prioritas: null, ringkas: null });
    expect(kategoriMisiSchema.safeParse({ nama: "x" }).success).toBe(false);
  });

  it("ubah: field yang tidak dikirim tidak diubah; kosong = dihapus", () => {
    expect(ubahKategoriMisiSchema.parse({ aktif: false })).toEqual({ aktif: false });
    expect(ubahKategoriMisiSchema.parse({ prioritas: "" })).toMatchObject({ prioritas: null });
    expect(ubahKategoriMisiSchema.safeParse({}).success).toBe(false);
  });

  it("pindah & urutan", () => {
    expect(pindahKategoriMisiSchema.safeParse({ ke: "desain" }).success).toBe(true);
    expect(pindahKategoriMisiSchema.safeParse({ ke: "Desain Grafis" }).success).toBe(false);
    expect(urutanKategoriMisiSchema.safeParse({ ids: [3, 1, 2] }).success).toBe(true);
    expect(urutanKategoriMisiSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});

describe("migrasi 20261110000000_magang_misi_kategori", () => {
  const sql = readFileSync("prisma/migrations/20261110000000_magang_misi_kategori/migration.sql", "utf8");
  const tanpaKomentar = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  it("membuat tabel secara idempoten dan INSERT IGNORE ketiga kategori lama dengan label yang sama", () => {
    expect(tanpaKomentar).toMatch(/CREATE TABLE IF NOT EXISTS `MagangMisiKategori`/);
    expect(tanpaKomentar).toMatch(/INSERT IGNORE INTO `MagangMisiKategori`/);
    for (const k of KATEGORI_AWAL) {
      expect(tanpaKomentar).toContain(`('${k.kunci}', '${k.nama}', '${k.ringkas}', '${k.prioritas}', ${k.urutan}, true`);
    }
  });

  it("kunci lain yang sudah dipakai misi ikut dibuatkan kategori sebelum FOREIGN KEY", () => {
    const ambil = tanpaKomentar.search(/INSERT IGNORE INTO `MagangMisiKategori`[^;]*SELECT DISTINCT `kategori`[^;]*FROM `MagangMisi`/);
    const fk = tanpaKomentar.indexOf("FOREIGN KEY (`kategori`) REFERENCES `MagangMisiKategori`(`kunci`)");
    expect(ambil).toBeGreaterThan(-1);
    expect(fk).toBeGreaterThan(ambil);
    expect(tanpaKomentar).toMatch(/ON DELETE RESTRICT ON UPDATE CASCADE/);
  });

  it("tidak mengubah/menghapus isi MagangMisi maupun MagangMisiKiriman", () => {
    expect(tanpaKomentar).not.toMatch(/\bUPDATE\s+`?MagangMisi/i);
    expect(tanpaKomentar).not.toMatch(/\bDELETE\s+FROM\s+`?MagangMisi/i);
    expect(tanpaKomentar).not.toMatch(/\bTRUNCATE\b/i);
    expect(tanpaKomentar).not.toMatch(/\bDROP\b/i);
    expect(tanpaKomentar).not.toMatch(/MagangMisiKiriman/);
  });
});
