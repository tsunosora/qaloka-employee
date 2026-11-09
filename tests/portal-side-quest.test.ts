import { describe, it, expect } from "vitest";
import { STATUS_MISI_META, galatBukti, persen, petakanGalatServer, ringkasBukti, statusMisi } from "@/components/portal/sideQuest";

describe("side quest di halaman pribadi — status tampil", () => {
  it("memetakan status kiriman ke label anak", () => {
    expect(STATUS_MISI_META[statusMisi(null)].label).toBe("Belum dikerjakan");
    expect(STATUS_MISI_META[statusMisi({ status: "menunggu" })].label).toBe("Menunggu dicek");
    expect(STATUS_MISI_META[statusMisi({ status: "ditolak" })].label).toBe("Perlu diperbaiki");
    expect(STATUS_MISI_META[statusMisi({ status: "disetujui" })].label).toBe("Selesai");
    expect(statusMisi({ status: "aneh" })).toBe("belum");
  });

  it("persen aman untuk total 0 dan dibatasi 0–100", () => {
    expect(persen(0, 0)).toBe(0);
    expect(persen(1, 3)).toBe(33);
    expect(persen(5, 3)).toBe(100);
  });

  it("ringkasan bukti yang diminta", () => {
    expect(ringkasBukti(["foto", "teks"])).toBe("Bukti: foto + tulisan");
    expect(ringkasBukti(["tautan"])).toBe("Bukti: tautan");
  });
});

describe("side quest — cek dini per kolom", () => {
  const batas = { minTeks: 20, maksFoto: 3 };

  it("hanya kolom yang diminta yang diperiksa", () => {
    expect(galatBukti(["teks"], { teks: "", tautan: "", jumlahFoto: 0 }, batas)).toEqual({ teks: expect.any(String) });
    expect(galatBukti(["foto", "tautan"], { teks: "", tautan: "", jumlahFoto: 0 }, batas)).toEqual({
      foto: expect.any(String),
      tautan: expect.any(String),
    });
  });

  it("lengkap = tanpa galat; tautan harus http(s); foto dibatasi", () => {
    const isi = { teks: "a".repeat(20), tautan: "https://contoh.id/x", jumlahFoto: 2 };
    expect(galatBukti(["foto", "tautan", "teks"], isi, batas)).toEqual({});
    expect(galatBukti(["tautan"], { ...isi, tautan: "javascript:alert(1)" }, batas).tautan).toMatch(/https/);
    expect(galatBukti(["foto"], { ...isi, jumlahFoto: 4 }, batas).foto).toMatch(/maksimal 3/);
  });

  it("teks dihitung tanpa spasi pinggir", () => {
    expect(galatBukti(["teks"], { teks: `  ${"a".repeat(19)}  `, tautan: "", jumlahFoto: 0 }, batas).teks).toBeDefined();
  });
});

describe("side quest — galat server ke kolom", () => {
  it("foto, fieldErrors zod, dan formErrors umum", () => {
    expect(petakanGalatServer({ foto: ["Foto terlalu besar."] })).toEqual({ foto: "Foto terlalu besar." });
    expect(petakanGalatServer({ formErrors: [], fieldErrors: { tautan: ["Terlalu panjang"] } })).toEqual({ tautan: "Terlalu panjang" });
    expect(petakanGalatServer({ formErrors: ["Lampirkan minimal 1 foto hasil kerjamu."] })).toEqual({ umum: "Lampirkan minimal 1 foto hasil kerjamu." });
    expect(petakanGalatServer(null)).toEqual({});
  });
});
