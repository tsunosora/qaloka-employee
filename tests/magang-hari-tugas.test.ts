import { describe, it, expect } from "vitest";
import { jendelaTugas, keadaanJendela, normalHariTugas, namaHariTugas, HARI_TUGAS_BAWAAN } from "@/lib/services/magang/nilai";
import { mingguTugas } from "@/lib/services/magang/layanan";
import { seninDari } from "@/lib/services/magang/rotasi";

// Minggu Senin 9 Nov 2026: Jumat 13, Sabtu 14, Minggu 15, Senin 16, Selasa 17.
const SABTU = 6;

describe("setelan hari tugas mengingat", () => {
  it("bawaan Jumat; nilai tak sah (kosong, Minggu, 7, teks) jatuh ke Jumat", () => {
    expect(HARI_TUGAS_BAWAAN).toBe(5);
    for (const v of [null, undefined, "", "0", "7", "abc", 2.5, 0]) expect(normalHariTugas(v)).toBe(5);
    expect(normalHariTugas("6")).toBe(6);
    expect(normalHariTugas(1)).toBe(1);
    expect(namaHariTugas(6)).toBe("Sabtu");
    expect(namaHariTugas(99)).toBe("Jumat");
  });

  it("tanpa setelan perilaku lama tetap: buka Jumat", () => {
    expect(jendelaTugas("2026-11-09")).toEqual({ buka: "2026-11-13", batas: "2026-11-16" });
  });

  it("Sabtu: dibuka Sabtu, tepat waktu s.d. Senin berikutnya, Selasa terlambat", () => {
    expect(jendelaTugas("2026-11-09", SABTU)).toEqual({ buka: "2026-11-14", batas: "2026-11-16" });
    expect(keadaanJendela("2026-11-09", "2026-11-13", SABTU)).toBe("belum"); // Jumat
    expect(keadaanJendela("2026-11-09", "2026-11-14", SABTU)).toBe("buka"); // Sabtu
    expect(keadaanJendela("2026-11-09", "2026-11-15", SABTU)).toBe("buka"); // Minggu
    expect(keadaanJendela("2026-11-09", "2026-11-16", SABTU)).toBe("buka"); // Senin berikutnya
    expect(keadaanJendela("2026-11-09", "2026-11-17", SABTU)).toBe("terlambat"); // Selasa
  });

  it("Sabtu & Minggu tetap milik minggu rotasi Senin yang sama (bukan minggu berikutnya)", () => {
    expect(seninDari("2026-11-14")).toBe("2026-11-09"); // Sabtu
    expect(seninDari("2026-11-15")).toBe("2026-11-09"); // Minggu
    expect(seninDari("2026-11-16")).toBe("2026-11-16"); // Senin
  });

  it("mingguTugas dengan Sabtu: minggu ini muncul Sabtu, bukan Jumat; minggu lalu tetap muncul", () => {
    const pen = [
      { id: 1, pesertaId: 1, posId: 1, mulai: "2026-11-09", minggu: 2, berbagi: false },
      { id: 2, pesertaId: 1, posId: 2, mulai: "2026-11-23", minggu: 1, berbagi: false },
    ];
    expect(mingguTugas(pen, new Set(), "2026-11-13", SABTU)).toEqual([]); // Jumat minggu pertama
    expect(mingguTugas(pen, new Set(), "2026-11-14", SABTU)).toEqual(["2026-11-09"]); // Sabtu
    expect(mingguTugas(pen, new Set(), "2026-11-16", SABTU)).toEqual(["2026-11-09"]); // Senin: minggu baru belum buka
    expect(mingguTugas(pen, new Set(["2026-11-09"]), "2026-11-20", SABTU)).toEqual([]); // Jumat minggu ke-2
    expect(mingguTugas(pen, new Set(["2026-11-09"]), "2026-11-21", SABTU)).toEqual(["2026-11-16"]); // Sabtu minggu ke-2
    // Bawaan (Jumat) tidak berubah.
    expect(mingguTugas(pen, new Set(), "2026-11-13")).toEqual(["2026-11-09"]);
  });

  it("Senin: dibuka Senin itu juga, batas Senin berikutnya", () => {
    expect(jendelaTugas("2026-11-09", 1)).toEqual({ buka: "2026-11-09", batas: "2026-11-16" });
    expect(keadaanJendela("2026-11-09", "2026-11-09", 1)).toBe("buka");
  });
});
