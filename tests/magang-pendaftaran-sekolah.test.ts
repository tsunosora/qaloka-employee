import { describe, it, expect } from "vitest";
import { dataPesertaDariPendaftar, terapkanSekolahTautan } from "@/lib/services/magang/pendaftaran";
import { pendaftaranSchema } from "@/lib/validators/magang";

const kiriman = {
  namaLengkap: "Peserta Contoh",
  panggilan: null,
  hp: "081234567890",
  sekolah: "Sekolah Lain",
  jurusan: null,
  guruPembimbing: "Guru Contoh",
  kontakGuru: "0811111111",
  mulai: "2026-11-09",
  selesai: null,
  pin: "482913",
  confirm: "482913",
};

/** Tautan pendaftaran khusus satu sekolah/rombongan (9 Nov 2026). */
describe("sekolah dari tautan pendaftaran", () => {
  it("tautan khusus sekolah menimpa sekolah yang dikirim formulir", () => {
    const r = pendaftaranSchema.safeParse(terapkanSekolahTautan(kiriman, "SMK Contoh 1"));
    expect(r.success).toBe(true);
    expect(r.success && r.data.sekolah).toBe("SMK Contoh 1");
  });

  it("kiriman tanpa sekolah tetap lolos di tautan khusus", () => {
    const { sekolah: _buang, ...tanpa } = kiriman;
    void _buang;
    const r = pendaftaranSchema.safeParse(terapkanSekolahTautan(tanpa, "SMK Contoh 1"));
    expect(r.success && r.data.sekolah).toBe("SMK Contoh 1");
  });

  it("tautan umum (sekolah kosong) memakai sekolah kiriman", () => {
    expect(terapkanSekolahTautan(kiriman, null)).toBe(kiriman);
    expect(terapkanSekolahTautan(kiriman, "   ")).toBe(kiriman);
    const r = pendaftaranSchema.safeParse(terapkanSekolahTautan(kiriman, undefined));
    expect(r.success && r.data.sekolah).toBe("Sekolah Lain");
  });

  it("kiriman rusak tidak membuat galat — validasi yang menolak", () => {
    expect(terapkanSekolahTautan(null, "SMK Contoh 1")).toEqual({ sekolah: "SMK Contoh 1" });
    expect(pendaftaranSchema.safeParse(terapkanSekolahTautan(null, "SMK Contoh 1")).success).toBe(false);
  });
});

describe("persetujuan pendaftar → data peserta", () => {
  it("sekolah, guru pembimbing & kontaknya ikut tersalin", () => {
    const d = dataPesertaDariPendaftar({
      namaLengkap: "Peserta Contoh",
      panggilan: "Contoh",
      hp: "081234567890",
      sekolah: "SMK Contoh 1",
      jurusan: "DKV",
      guruPembimbing: "Guru Contoh",
      kontakGuru: "0811111111",
      mulai: new Date(2026, 10, 9),
      selesai: new Date(2027, 1, 8),
    });
    expect(d).toEqual({
      namaLengkap: "Peserta Contoh",
      panggilan: "Contoh",
      hp: "081234567890",
      sekolah: "SMK Contoh 1",
      jurusan: "DKV",
      guruPembimbing: "Guru Contoh",
      kontakGuru: "0811111111",
      mulai: "2026-11-09",
      selesai: "2027-02-08",
    });
  });

  it("guru kosong tetap null", () => {
    const d = dataPesertaDariPendaftar({
      namaLengkap: "Peserta Contoh",
      panggilan: null,
      hp: null,
      sekolah: "SMK Contoh 1",
      jurusan: null,
      guruPembimbing: null,
      kontakGuru: null,
      mulai: new Date(2026, 10, 9),
      selesai: null,
    });
    expect(d.guruPembimbing).toBeNull();
    expect(d.kontakGuru).toBeNull();
    expect(d.selesai).toBeNull();
  });
});
