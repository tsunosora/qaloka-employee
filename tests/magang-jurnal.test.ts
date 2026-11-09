import { describe, it, expect } from "vitest";
import { tanggalBolehIsi, bolehSunting, hariKerja, kerajinan, daftarFoto, hariDalamMinggu } from "@/lib/services/magang/jurnal";
import { bolehKirimPendaftaran, keadaanTautan } from "@/lib/services/magang/pendaftaran";
import { fiturUntuk, ATURAN_API, ATURAN_HALAMAN } from "@/lib/lisensi/aturan-jalur";

const MASA = { mulai: "2026-11-02", selesai: "2027-01-15" };

describe("tanggalBolehIsi", () => {
  it("hari ini + 2 hari ke belakang", () => {
    expect(tanggalBolehIsi("2026-11-07", MASA)).toEqual(["2026-11-07", "2026-11-06", "2026-11-05"]);
  });
  it("tidak sebelum mulai magang", () => {
    expect(tanggalBolehIsi("2026-11-03", MASA)).toEqual(["2026-11-03", "2026-11-02"]);
  });
  it("tidak sesudah selesai magang", () => {
    expect(tanggalBolehIsi("2027-01-17", MASA)).toEqual(["2027-01-15"]);
    expect(tanggalBolehIsi("2027-02-01", MASA)).toEqual([]);
  });
});

describe("bolehSunting", () => {
  it("hanya dalam jendela dan belum dicek", () => {
    expect(bolehSunting({ tanggal: "2026-11-06", dicek: false }, "2026-11-07", MASA)).toBe(true);
    expect(bolehSunting({ tanggal: "2026-11-06", dicek: true }, "2026-11-07", MASA)).toBe(false);
    expect(bolehSunting({ tanggal: "2026-11-02", dicek: false }, "2026-11-07", MASA)).toBe(false);
  });
});

describe("hariKerja & kerajinan", () => {
  it("Senin–Sabtu, tanpa Minggu & libur nasional", () => {
    expect(hariDalamMinggu("2026-11-08")).toBe(0); // Minggu
    const h = hariKerja("2026-11-02", "2026-11-14", new Set(["2026-11-10"]));
    expect(h).toHaveLength(11); // 12 hari Senin–Sabtu dikurangi 1 libur
    expect(h).not.toContain("2026-11-08");
    expect(h).not.toContain("2026-11-10");
  });
  it("jurnal di hari libur/Minggu tidak menambah hitungan; dobel dihitung sekali", () => {
    const h = hariKerja("2026-11-02", "2026-11-07", new Set());
    expect(kerajinan(["2026-11-02", "2026-11-02", "2026-11-03", "2026-11-08"], h)).toEqual({ terisi: 2, dari: 6, persen: 33 });
    expect(kerajinan([], [])).toEqual({ terisi: 0, dari: 0, persen: null });
  });
});

describe("daftarFoto", () => {
  it("aman untuk isi rusak dan maksimal 3", () => {
    expect(daftarFoto(null)).toEqual([]);
    expect(daftarFoto(["a", 1, "b", "c", "d"])).toEqual(["a", "b", "c"]);
  });
});

describe("pendaftaran", () => {
  it("keadaan tautan", () => {
    expect(keadaanTautan({ aktif: true, berlakuSampai: new Date("2026-11-20T00:00:00") }, "2026-11-07")).toBe("aktif");
    expect(keadaanTautan({ aktif: true, berlakuSampai: new Date("2026-11-20T00:00:00") }, "2026-11-21")).toBe("kedaluwarsa");
    expect(keadaanTautan({ aktif: false, berlakuSampai: new Date("2026-11-20T00:00:00") }, "2026-11-07")).toBe("dimatikan");
  });
  it("penahan per IP longgar (satu kelas dari WiFi yang sama) tapi ada batasnya", () => {
    const t = 1_000_000;
    let lolos = 0;
    for (let i = 0; i < 40; i++) if (bolehKirimPendaftaran("10.0.0.9", t)) lolos++;
    expect(lolos).toBe(30);
    expect(bolehKirimPendaftaran("10.0.0.10", t)).toBe(true);
    expect(bolehKirimPendaftaran("10.0.0.9", t + 61 * 60 * 1000)).toBe(true); // jendela baru
  });
  it("lisensi jalur pendaftaran & jurnal", () => {
    expect(fiturUntuk("/api/public/daftar-magang/abc", ATURAN_API)).toBe("hr.assessment");
    expect(fiturUntuk("/api/public/portal/abc/magang/jurnal", ATURAN_API)).toBe("hr.assessment");
    expect(fiturUntuk("/daftar-magang/abc", ATURAN_HALAMAN)).toBe("hr.assessment");
  });
});
