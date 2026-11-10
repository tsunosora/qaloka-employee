import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hariKe, susunBulan, POLA_BAWAAN, type BarisAda } from "@/lib/services/magang/konten";
import { briefSchema } from "@/lib/validators/magang-konten";
import { ANAK_VOLIKO, BARIS_VOLIKO, BRIEF_VOLIKO, GRUP_VOLIKO, KONSEP_VOLIKO, MIGRASI_KONTEN } from "@/tools/magang/data/voliko-konten-nov2026";
import { cekDataStatis } from "@/tools/magang/voliko-jadwal-konten";

describe("data impor jadwal konten Voliko", () => {
  it("lolos pemeriksaan skrip (validator UI, kode/grup dikenal, tanpa hari Minggu)", () => {
    expect(() => cekDataStatis()).not.toThrow();
  });

  it("kode anak & peserta unik; anggota grup tidak tumpang tindih", () => {
    expect(new Set(ANAK_VOLIKO.map((a) => a.kode)).size).toBe(ANAK_VOLIKO.length);
    expect(new Set(ANAK_VOLIKO.map((a) => a.pesertaId)).size).toBe(ANAK_VOLIKO.length);
    const anggota = GRUP_VOLIKO.flatMap((g) => [...g.anggota]);
    expect(new Set(anggota).size).toBe(anggota.length);
    expect(anggota.sort()).toEqual(ANAK_VOLIKO.map((a) => a.kode).sort());
  });

  it("2–28 Nov = 24 baris, semua Senin–Sabtu, satu baris per tanggal", () => {
    const t = BARIS_VOLIKO.map((b) => b.tanggal);
    expect(t).toHaveLength(24);
    expect(new Set(t).size).toBe(24);
    expect(t[0]).toBe("2026-11-02");
    expect(t[23]).toBe("2026-11-28");
    expect(t.every((x) => hariKe(x) >= 1 && hariKe(x) <= 6)).toBe(true);
    expect([...t].sort()).toEqual(t);
  });

  it("2–14 Nov persis sheet (bukan usulan); 16–28 Nov usulan dengan 7 anak = hasil generator", () => {
    const sheet = BARIS_VOLIKO.filter((b) => b.tanggal <= "2026-11-14");
    expect(sheet.every((b) => !b.usulan)).toBe(true);
    expect(sheet.map((b) => b.kode ?? b.grup)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, "GRUB A"]);

    const usulan = BARIS_VOLIKO.filter((b) => b.tanggal >= "2026-11-16");
    expect(usulan.every((b) => b.usulan)).toBe(true);

    const idGrup = new Map<string, number>(GRUP_VOLIKO.map((g, i) => [g.nama, i + 1]));
    const ada = new Map<string, BarisAda[]>(sheet.map((b) => [b.tanggal, [{ kode: b.kode, grupId: b.grup ? idGrup.get(b.grup)! : null, empathy: b.konsep === "empathy" }]]));
    const r = susunBulan({
      bulan: "2026-11",
      kode: ANAK_VOLIKO.map((a) => a.kode),
      grupUrut: [...idGrup.values()],
      polaHari: POLA_BAWAAN.hari,
      empathyKonsep: "empathy",
      mulaiKodeSetelah: null,
      empathyTerakhir: null,
      libur: new Set(),
      ada,
    });
    const namaGrup = new Map([...idGrup].map(([n, id]) => [id, n]));
    expect(r.baris.filter((b) => b.tanggal <= "2026-11-28").map((b) => [b.tanggal, b.konsep, b.kode ?? namaGrup.get(b.grupId!)])).toEqual(
      usulan.map((b) => [b.tanggal, b.konsep, b.kode ?? b.grup])
    );
  });

  it("konsep, brief & skrip: referensi IG, catatan Xposer, drive tanpa URL, migrasi benar", () => {
    expect(KONSEP_VOLIKO.map((k) => k.kunci)).toEqual(["sitkom", "flexing", "talk", "empathy"]);
    expect(KONSEP_VOLIKO.every((k) => k.referensi[0].url.startsWith("https://www.instagram.com/p/"))).toBe(true);
    expect(briefSchema.safeParse(BRIEF_VOLIKO).success).toBe(true);
    expect(BRIEF_VOLIKO.catatan).toMatch(/Xposer/);
    expect(BRIEF_VOLIKO.drive[0].url).toBe("");
    expect(BRIEF_VOLIKO.caption.split("\n").filter(Boolean)).toHaveLength(8);
    expect(MIGRASI_KONTEN).toBe("20261112000000_magang_jadwal_konten");
    const skrip = readFileSync("tools/magang/voliko-jadwal-konten.ts", "utf8");
    expect(skrip).toMatch(/\$transaction/);
    expect(skrip).not.toMatch(/\b(CREATE|ALTER|DROP)\s+TABLE\b/i);
    expect(skrip).toMatch(/--jalankan/);
  });

  it("nama asli anak hanya ada di berkas data (tidak di kode aplikasi/tes)", () => {
    const nama = ANAK_VOLIKO.map((a) => a.panggilan);
    for (const f of [
      "lib/services/magang/konten.ts",
      "lib/services/magang/konten-db.ts",
      "tools/magang/voliko-jadwal-konten.ts",
      "tests/magang-konten.test.ts",
      "tests/magang-konten-impor.test.ts",
    ]) {
      const isi = readFileSync(f, "utf8");
      for (const n of nama) expect(isi.includes(n), `${n} di ${f}`).toBe(false);
    }
  });
});
