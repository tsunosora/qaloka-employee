import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  bentrokPasangan,
  hariKerja,
  jadwalAnak,
  jadwalMinggu,
  selisihHariKerja,
  serialHarianAnak,
  tugasPada,
  tugasPola,
  teksWA,
  urutAnakPasangan,
  type AnakH,
  type PasanganH,
  type PengecualianH,
} from "@/lib/services/magang/harian";
import { pasanganSchema, pengecualianSchema, ubahPasanganSchema, ubahPengecualianSchema } from "@/lib/validators/magang-harian";
import { serialHarianGuru, kunciBocor } from "@/lib/services/magang/pantau";
import { MIGRASI_HARIAN, PASANGAN_VOLIKO } from "@/tools/magang/data/voliko-pasangan";
import { gridTeks, rencanaPasanganVoliko } from "@/tools/magang/voliko-jadwal-harian";

// Data fiktif. 2026-11-09 = Senin, 2026-11-15 = Minggu.
const anak = (id: number, panggilan: string, mulai = "2026-11-01", selesai: string | null = null, aktif = true): AnakH => ({ pesertaId: id, panggilan, mulai, selesai, aktif });
const ANAK = new Map<number, AnakH>(
  [anak(1, "Satu"), anak(2, "Dua"), anak(3, "Tiga"), anak(4, "Empat"), anak(5, "Lima"), anak(6, "Enam"), anak(7, "Tujuh"), anak(8, "Delapan")].map((a) => [a.pesertaId, a])
);
const pas = (id: number, a: number, b: number | null, patokanTugas: "konten" | "produksi", patokanTanggal = "2026-11-10", urutan = id): PasanganH => ({
  id,
  nama: null,
  pesertaAId: a,
  pesertaBId: b,
  patokanTanggal,
  patokanTugas,
  aktif: true,
  urutan,
});
const P1 = pas(1, 1, 2, "konten");
const P2 = pas(2, 3, 4, "produksi");
const tanpaLibur = new Set<string>();
const tugasAnak = (ps: PasanganH[], t: string, libur = tanpaLibur, e: PengecualianH[] = [], a = ANAK) => tugasPada(ps, t, libur, e, a);
const ex = (id: number, o: Partial<PengecualianH>): PengecualianH => ({ id, tanggal: "2026-11-11", pasanganId: null, pesertaId: null, jenis: "tugas", tugas: null, pasanganPesertaId: null, catatan: null, ...o });

describe("hari kerja & selisih", () => {
  it("Senin–Sabtu hari kerja; Minggu & Holiday bukan", () => {
    expect(hariKerja("2026-11-09", tanpaLibur)).toBe(true);
    expect(hariKerja("2026-11-14", tanpaLibur)).toBe(true);
    expect(hariKerja("2026-11-15", tanpaLibur)).toBe(false);
    expect(hariKerja("2026-11-12", new Set(["2026-11-12"]))).toBe(false);
  });
  it("selisih bertanda, Minggu & libur tidak dihitung, sama dengan hitung manual", () => {
    expect(selisihHariKerja("2026-11-10", "2026-11-10", tanpaLibur)).toBe(0);
    expect(selisihHariKerja("2026-11-10", "2026-11-14", tanpaLibur)).toBe(4);
    expect(selisihHariKerja("2026-11-14", "2026-11-16", tanpaLibur)).toBe(1); // lewat Minggu
    expect(selisihHariKerja("2026-11-10", "2026-11-09", tanpaLibur)).toBe(-1);
    expect(selisihHariKerja("2026-11-16", "2026-11-14", tanpaLibur)).toBe(-1);
    expect(selisihHariKerja("2026-11-10", "2026-11-13", new Set(["2026-11-12", "2026-11-15"]))).toBe(2);
    // Acak: bandingkan dengan pengulangan hari demi hari.
    const libur = new Set(["2026-11-20", "2026-12-25", "2026-11-29", "2027-01-01"]);
    const manual = (a: string, b: string) => {
      const [lo, hi, s] = b >= a ? [a, b, 1] : [b, a, -1];
      let n = 0;
      for (let d = new Date(`${lo}T00:00:00Z`); ; ) {
        d = new Date(d.getTime() + 86_400_000);
        const t = d.toISOString().slice(0, 10);
        if (t > hi) break;
        if (d.getUTCDay() !== 0 && !libur.has(t)) n++;
      }
      return s * n;
    };
    for (const [a, b] of [["2026-11-01", "2027-01-10"], ["2027-01-10", "2026-10-03"], ["2026-11-15", "2026-11-22"], ["2026-11-22", "2026-11-15"]])
      expect(selisihHariKerja(a, b, libur)).toBe(manual(a, b));
  });
});

describe("pola bergantian", () => {
  it("bergantian Senin–Sabtu, Minggu dilewati tanpa membalik", () => {
    const urut = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-16", "2026-11-17"].map((t) => tugasPola(P1, t, tanpaLibur));
    expect(urut).toEqual(["konten", "produksi", "konten", "produksi", "konten", "produksi", "konten"]);
  });
  it("tanggal merah dilewati dan TIDAK membalik giliran", () => {
    const libur = new Set(["2026-11-12"]);
    expect(tugasPola(P1, "2026-11-11", libur)).toBe("produksi");
    expect(tugasPola(P1, "2026-11-13", libur)).toBe("konten"); // tanpa libur: produksi
    const h = tugasAnak([P1], "2026-11-12", libur).get(1)!;
    expect(h.keadaan).toBe("bukan-hari-kerja");
    expect(h.tugas).toBeNull();
  });
  it("berlaku mundur sebelum patokan", () => {
    expect(tugasPola(P1, "2026-11-09", tanpaLibur)).toBe("produksi");
    expect(tugasPola(P1, "2026-11-07", tanpaLibur)).toBe("konten"); // Sabtu sebelumnya, lewat Minggu 8
    expect(tugasPola(P1, "2026-11-06", tanpaLibur)).toBe("produksi");
  });
  it("pasangan dengan rekan: tugas sama, rekan saling menyebut", () => {
    const m = tugasAnak([P1, P2], "2026-11-10");
    expect(m.get(1)).toMatchObject({ keadaan: "tugas", tugas: "konten", rekan: "Dua", sendiri: false, sumber: "pola" });
    expect(m.get(2)).toMatchObject({ tugas: "konten", rekan: "Satu" });
    expect(m.get(3)).toMatchObject({ tugas: "produksi", rekan: "Empat" });
  });
});

describe("pengecualian", () => {
  it("ganti tugas pasangan satu hari TIDAK menggeser hari-hari berikutnya", () => {
    const e = [ex(1, { pasanganId: 1, jenis: "tugas", tugas: "konten" })]; // 11 Nov pola = produksi
    expect(tugasAnak([P1], "2026-11-11", tanpaLibur, e).get(1)).toMatchObject({ tugas: "konten", sumber: "pengecualian", tingkat: "pasangan" });
    expect(tugasAnak([P1], "2026-11-12", tanpaLibur, e).get(1)!.tugas).toBe("konten");
    expect(tugasAnak([P1], "2026-11-13", tanpaLibur, e).get(1)!.tugas).toBe("produksi");
  });
  it("libur pasangan: keduanya libur, hari berikutnya tetap sesuai pola", () => {
    const e = [ex(1, { pasanganId: 1, jenis: "libur" })];
    const m = tugasAnak([P1], "2026-11-11", tanpaLibur, e);
    expect(m.get(1)).toMatchObject({ keadaan: "libur", libur: true, tugas: null });
    expect(m.get(2)!.keadaan).toBe("libur");
    expect(tugasAnak([P1], "2026-11-12", tanpaLibur, e).get(2)!.tugas).toBe("konten");
  });
  it("ganti pasangan hari itu: dua arah, rekan lama masing-masing sendiri, tugas ikut pemilik / ditentukan", () => {
    const e = [ex(1, { pesertaId: 1, jenis: "pasangan", pasanganPesertaId: 3 })];
    const m = tugasAnak([P1, P2], "2026-11-11", tanpaLibur, e);
    expect(m.get(1)).toMatchObject({ tugas: "produksi", rekan: "Tiga", sendiri: false, tingkat: "anak" });
    expect(m.get(3)).toMatchObject({ tugas: "produksi", rekan: "Satu", tingkat: "anak" });
    expect(m.get(2)).toMatchObject({ tugas: "produksi", rekan: null, sendiri: true });
    expect(m.get(4)).toMatchObject({ tugas: "konten", rekan: null, sendiri: true });
    const e2 = [ex(1, { pesertaId: 1, jenis: "pasangan", pasanganPesertaId: 3, tugas: "konten" })];
    expect(tugasAnak([P1, P2], "2026-11-11", tanpaLibur, e2).get(3)).toMatchObject({ tugas: "konten", rekan: "Satu" });
    // hari berikutnya kembali ke pasangan asli
    expect(tugasAnak([P1, P2], "2026-11-12", tanpaLibur, e).get(1)).toMatchObject({ rekan: "Dua", tugas: "konten" });
  });
  it("libur satu anak → rekannya sendiri", () => {
    const m = tugasAnak([P1], "2026-11-11", tanpaLibur, [ex(1, { pesertaId: 2, jenis: "libur" })]);
    expect(m.get(2)!.keadaan).toBe("libur");
    expect(m.get(1)).toMatchObject({ tugas: "produksi", sendiri: true, rekan: null });
  });
  it("pengecualian terbaru menang", () => {
    const e = [ex(1, { pasanganId: 1, jenis: "libur" }), ex(2, { pasanganId: 1, jenis: "tugas", tugas: "konten" })];
    expect(tugasAnak([P1], "2026-11-11", tanpaLibur, e).get(1)!.tugas).toBe("konten");
  });
});

describe("sendiri & masa magang", () => {
  it("pasangan satu anak (rekan belum ada) → sendiri", () => {
    expect(tugasAnak([pas(5, 5, null, "produksi")], "2026-11-10").get(5)).toMatchObject({ tugas: "produksi", sendiri: true, rekan: null });
  });
  it("rekan nonaktif / belum mulai → anak tersisa sendiri; anak itu sendiri tanpa tugas", () => {
    const a = new Map(ANAK);
    a.set(2, anak(2, "Dua", "2026-11-12"));
    const m = tugasAnak([P1], "2026-11-11", tanpaLibur, [], a);
    expect(m.get(2)).toMatchObject({ keadaan: "di-luar-masa", tugas: null });
    expect(m.get(1)).toMatchObject({ tugas: "produksi", sendiri: true });
    a.set(2, anak(2, "Dua", "2026-11-01", null, false));
    expect(tugasAnak([P1], "2026-11-12", tanpaLibur, [], a).get(2)!.tugas).toBeNull();
  });
  it("sesudah selesai → null", () => {
    const a = new Map(ANAK);
    a.set(1, anak(1, "Satu", "2026-11-01", "2026-11-11"));
    expect(tugasAnak([P1], "2026-11-11", tanpaLibur, [], a).get(1)!.tugas).toBe("produksi");
    expect(tugasAnak([P1], "2026-11-12", tanpaLibur, [], a).get(1)).toMatchObject({ keadaan: "di-luar-masa", tugas: null });
  });
  it("jadwalAnak: Minggu, tanpa pasangan, di luar masa", () => {
    const j = jadwalAnak({ pesertaId: 8, dari: "2026-11-14", sampai: "2026-11-16", pasangan: [P1], libur: tanpaLibur, pengecualian: [], anak: ANAK });
    expect(j.map((h) => h.keadaan)).toEqual(["tanpa-pasangan", "bukan-hari-kerja", "tanpa-pasangan"]);
  });
});

describe("satu anak = satu pasangan aktif", () => {
  const ada = [P1, P2, { ...pas(3, 5, 6, "konten"), aktif: false }];
  it("bentrok bila anak sudah di pasangan aktif lain", () => {
    expect(bentrokPasangan(ada, { pesertaAId: 2, pesertaBId: 7, aktif: true })).toEqual([{ pesertaId: 2, pasanganId: 1 }]);
    expect(bentrokPasangan(ada, { pesertaAId: 7, pesertaBId: 3, aktif: true })).toEqual([{ pesertaId: 3, pasanganId: 2 }]);
  });
  it("tidak bentrok: pasangan nonaktif, pasangan itu sendiri (ubah), calon nonaktif", () => {
    expect(bentrokPasangan(ada, { pesertaAId: 5, pesertaBId: 7, aktif: true })).toEqual([]);
    expect(bentrokPasangan(ada, { id: 1, pesertaAId: 1, pesertaBId: 7, aktif: true })).toEqual([]);
    expect(bentrokPasangan(ada, { pesertaAId: 1, pesertaBId: 3, aktif: false })).toEqual([]);
  });
});

describe("validasi", () => {
  it("pasangan: dua anak berbeda, patokan bukan Minggu", () => {
    expect(pasanganSchema.safeParse({ pesertaAId: 1, pesertaBId: 1, patokanTanggal: "2026-11-10", patokanTugas: "konten" }).success).toBe(false);
    expect(pasanganSchema.safeParse({ pesertaAId: 1, patokanTanggal: "2026-11-15", patokanTugas: "konten" }).success).toBe(false);
    const ok = pasanganSchema.parse({ pesertaAId: 1, patokanTanggal: "2026-11-10", patokanTugas: "produksi" });
    expect(ok).toMatchObject({ pesertaBId: null, aktif: true, nama: null });
  });
  it("PATCH sebagian tidak menambah kunci (tanpa nilai bawaan, tidak dikirim ≠ null)", () => {
    expect(ubahPasanganSchema.parse({ aktif: false })).toEqual({ aktif: false });
    const n = ubahPasanganSchema.parse({ patokanTugas: "konten" });
    expect(Object.entries(n).filter(([, v]) => v !== undefined)).toEqual([["patokanTugas", "konten"]]);
    expect(ubahPasanganSchema.parse({ nama: "" }).nama).toBeNull();
    expect(ubahPasanganSchema.parse({ pesertaBId: null }).pesertaBId).toBeNull();
    const c = ubahPengecualianSchema.parse({ tugas: "produksi" });
    expect(Object.entries(c).filter(([, v]) => v !== undefined)).toEqual([["tugas", "produksi"]]);
    expect(ubahPasanganSchema.safeParse({ lain: 1 }).success).toBe(false);
  });
  it("pengecualian: sasaran tepat satu, ganti pasangan wajib rekan, tugas wajib untuk jenis tugas", () => {
    expect(pengecualianSchema.safeParse({ tanggal: "2026-11-11", pasanganId: 1, jenis: "libur" }).success).toBe(true);
    expect(pengecualianSchema.safeParse({ tanggal: "2026-11-11", pasanganId: 1, pesertaId: 2, jenis: "libur" }).success).toBe(false);
    expect(pengecualianSchema.safeParse({ tanggal: "2026-11-11", pasanganId: 1, jenis: "tugas" }).success).toBe(false);
    expect(pengecualianSchema.safeParse({ tanggal: "2026-11-11", pesertaId: 1, jenis: "pasangan" }).success).toBe(false);
    expect(pengecualianSchema.safeParse({ tanggal: "2026-11-11", pesertaId: 1, jenis: "pasangan", pasanganPesertaId: 1 }).success).toBe(false);
    expect(pengecualianSchema.safeParse({ tanggal: "2026-11-11", pesertaId: 1, jenis: "pasangan", pasanganPesertaId: 3 }).success).toBe(true);
    expect(pengecualianSchema.safeParse({ tanggal: "2026-11-11", pasanganId: 1, jenis: "pasangan", pasanganPesertaId: 3 }).success).toBe(false);
  });
});

describe("grid minggu & teks WA", () => {
  const P3 = pas(3, 5, 6, "konten");
  const P4 = pas(4, 7, 8, "produksi");
  const semua = [P1, P2, P3, P4];
  it("grid Senin–Sabtu, Minggu tidak ada, libur tertulis", () => {
    const m = jadwalMinggu({ senin: "2026-11-11", pasangan: semua, libur: new Set(["2026-11-13"]), pengecualian: [], anak: ANAK });
    expect(m.map((h) => h.tanggal)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(m[4].sel[0]).toMatchObject({ keadaan: "bukan-hari-kerja", tugas: null });
    expect(m[5].sel[0].tugas).toBe("produksi"); // 12 = konten, 13 libur, 14 = produksi
  });
  it("teks WA: Konten & Produksi per hari, sendiri & libur", () => {
    const m = jadwalMinggu({ senin: "2026-11-16", pasangan: semua, libur: new Set(["2026-11-17"]), pengecualian: [ex(9, { tanggal: "2026-11-18", pesertaId: 8, jenis: "libur" })], anak: ANAK });
    const t = teksWA(m, ANAK, urutAnakPasangan(semua), new Map([["2026-11-17", "Libur uji"]]));
    expect(t.split("\n")[0]).toBe("Jadwal harian magang Senin 16 Nov – Sabtu 21 Nov");
    expect(t).toContain("Senin 16 Nov — Konten: Tiga & Empat, Tujuh & Delapan · Produksi: Satu & Dua, Lima & Enam");
    expect(t).toContain("Selasa 17 Nov — Libur (Libur uji)");
    expect(t).toContain("Rabu 18 Nov — Konten: Satu & Dua, Lima & Enam · Produksi: Tiga & Empat, Tujuh (sendiri) · Libur: Delapan");
    expect(t).not.toContain("Minggu");
  });
});

describe("data Voliko (patokan 10 Nov)", () => {
  // Nama fiktif dengan id & patokan sama dengan berkas data.
  const fiktif = new Map(PASANGAN_VOLIKO.flatMap((p) => [p.a, p.b]).map((x) => [x.pesertaId, anak(x.pesertaId, `Anak${x.pesertaId}`, "2026-11-09")]));
  const ps = PASANGAN_VOLIKO.map((p, i): PasanganH => ({ id: i + 1, nama: null, pesertaAId: p.a.pesertaId, pesertaBId: p.b.pesertaId, patokanTanggal: p.patokanTanggal, patokanTugas: p.patokanTugas, aktif: true, urutan: p.urutan }));
  it("berkas data: 8 anak berbeda, 2 pasangan konten + 2 produksi, migrasi benar", () => {
    const ids = PASANGAN_VOLIKO.flatMap((p) => [p.a.pesertaId, p.b.pesertaId]);
    expect(new Set(ids).size).toBe(8);
    expect(ids.slice().sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(PASANGAN_VOLIKO.map((p) => p.patokanTugas)).toEqual(["konten", "konten", "produksi", "produksi"]);
    expect(PASANGAN_VOLIKO.every((p) => p.patokanTanggal === "2026-11-10")).toBe(true);
    expect(MIGRASI_HARIAN).toBe("20261114000000_magang_jadwal_harian");
  });
  it("10–16 Nov: tiap hari 2 pasangan konten + 2 produksi, bergantian, Minggu 15 dilewati", () => {
    const harap: Record<string, [string, string, string, string]> = {
      "2026-11-10": ["konten", "konten", "produksi", "produksi"],
      "2026-11-11": ["produksi", "produksi", "konten", "konten"],
      "2026-11-12": ["konten", "konten", "produksi", "produksi"],
      "2026-11-13": ["produksi", "produksi", "konten", "konten"],
      "2026-11-14": ["konten", "konten", "produksi", "produksi"],
      "2026-11-16": ["produksi", "produksi", "konten", "konten"],
    };
    for (const [t, h] of Object.entries(harap)) {
      const m = tugasPada(ps, t, tanpaLibur, [], fiktif);
      expect(ps.map((p) => m.get(p.pesertaAId)!.tugas), t).toEqual(h);
    }
    expect(tugasPada(ps, "2026-11-15", tanpaLibur, [], fiktif).get(5)!.keadaan).toBe("bukan-hari-kerja");
  });
  it("rencana skrip: idempoten, cek id + panggilan, bentrok → masalah; grid tercetak", () => {
    const asli = new Map(PASANGAN_VOLIKO.flatMap((p) => [p.a, p.b]).map((x) => [x.pesertaId, { pesertaId: x.pesertaId, panggilan: x.panggilan.toLowerCase() }]));
    const r1 = rencanaPasanganVoliko([], asli);
    expect(r1.masalah).toEqual([]);
    expect(r1.aksi.filter((a) => a.aksi === "buat")).toHaveLength(4);
    const r2 = rencanaPasanganVoliko(ps, asli);
    expect(r2.aksi.every((a) => a.aksi === "ada")).toBe(true);
    const salah = new Map(asli);
    salah.set(8, { pesertaId: 8, panggilan: "Lain" });
    expect(rencanaPasanganVoliko([], salah).masalah.join()).toMatch(/id 8/);
    const r3 = rencanaPasanganVoliko([pas(9, PASANGAN_VOLIKO[0].a.pesertaId, 99, "konten")], asli);
    expect(r3.masalah.join()).toMatch(/pasangan aktif #9/);
    const g = gridTeks({ pasangan: ps, anak: fiktif, libur: new Map(), pengecualian: [], dari: "2026-11-10", sampai: "2026-11-16" });
    expect(g.split("\n")).toHaveLength(8);
    expect(g).toContain("Minggu 15 Nov");
    const skrip = readFileSync("tools/magang/voliko-jadwal-harian.ts", "utf8");
    expect(skrip).toMatch(/\$transaction/);
    expect(skrip).not.toMatch(/\b(CREATE|ALTER|DROP)\s+TABLE\b/i);
    expect(skrip).toMatch(/--jalankan/);
  });
  it("nama asli anak hanya ada di berkas data (tidak di kode aplikasi/tes)", () => {
    const nama = PASANGAN_VOLIKO.flatMap((p) => [p.a.panggilan, p.b.panggilan]);
    for (const f of [
      "lib/services/magang/harian.ts",
      "lib/services/magang/harian-db.ts",
      "lib/validators/magang-harian.ts",
      "tools/magang/voliko-jadwal-harian.ts",
      "tests/magang-harian.test.ts",
      "components/portal/HarianMagang.tsx",
      "components/magang/harian/DialogSel.tsx",
      "components/magang/harian/DialogPasangan.tsx",
      "app/(dashboard)/magang/harian/page.tsx",
    ]) {
      const isi = readFileSync(f, "utf8");
      for (const n of nama) expect(isi.includes(n), `${n} di ${f}`).toBe(false);
    }
  });
});

describe("migrasi & kebocoran", () => {
  it("migrasi hanya menambah 2 tabel (tanpa DROP/DELETE/ALTER kolom lama)", () => {
    const sql = readFileSync("prisma/migrations/20261114000000_magang_jadwal_harian/migration.sql", "utf8");
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(2);
    expect(sql).not.toMatch(/\bDROP\b|DELETE FROM|^\s*UPDATE\b|ADD COLUMN|MODIFY/im);
    expect(sql).toMatch(/INDEX `MagangHarianPengecualian_tanggal_idx`/);
  });
  it("HP anak & guru: hanya tanggal/keadaan/tugas/rekan/sendiri (tanpa catatan pembina)", () => {
    const m = tugasAnak([P1], "2026-11-11", tanpaLibur, [ex(1, { pasanganId: 1, jenis: "tugas", tugas: "konten", catatan: "rahasia pembina" })]);
    const s = serialHarianAnak(m.get(1)!);
    expect(Object.keys(s).sort()).toEqual(["keadaan", "rekan", "sendiri", "tanggal", "tugas"]);
    expect(JSON.stringify(s)).not.toContain("rahasia");
    const j = jadwalAnak({ pesertaId: 1, dari: "2026-11-08", sampai: "2026-11-14", pasangan: [P1], libur: new Set(["2026-11-13"]), pengecualian: [], anak: ANAK });
    const g = serialHarianGuru(j);
    expect(g.map((x) => x.tanggal)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]); // tanpa Minggu 8
    expect(g[4]).toMatchObject({ keadaan: "bukan-hari-kerja", tugas: null });
    expect(kunciBocor(g)).toEqual([]);
  });
});
