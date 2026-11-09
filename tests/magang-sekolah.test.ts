import { describe, it, expect } from "vitest";
import { daftarSekolah, kunciSekolah, sekolahSama } from "@/lib/services/magang/sekolah";

describe("sekolah — tulisan berbeda dianggap satu sekolah", () => {
  it("huruf besar/kecil & spasi tidak membedakan", () => {
    expect(kunciSekolah("  SMK  Negeri 2 Contoh ")).toBe("smk negeri 2 contoh");
    expect(sekolahSama("SMK NEGERI 2 CONTOH", "Smk negeri 2 contoh")).toBe(true);
    expect(sekolahSama("SMK Negeri 2 Contoh", "SMK Negeri 3 Contoh")).toBe(false);
  });

  it("daftar saringan: satu entri per sekolah, label = tulisan terbanyak, kosong dilewati", () => {
    const d = daftarSekolah(["SMK Negeri 2 Contoh", "Smk negeri 2 contoh", "SMK Negeri 2 Contoh", "SMK NEGERI 2 CONTOH", null, "", "SMA Lain"]);
    expect(d).toEqual([
      { kunci: "sma lain", label: "SMA Lain", jumlah: 1 },
      { kunci: "smk negeri 2 contoh", label: "SMK Negeri 2 Contoh", jumlah: 4 },
    ]);
  });
});
