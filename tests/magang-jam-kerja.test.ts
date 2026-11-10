import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeAttendanceRow, type DayInput } from "@/lib/services/attendance/report";
import { computeShift, DEFAULT_SHIFT_CONFIG } from "@/lib/services/attendance/shift";
import { computeJamMagang, labelJamKerja, PETA_JAM_MAGANG_KOSONG, type JamMagangHari } from "@/lib/services/attendance/jam-magang";
import { perubahanStatus, type BarisTersimpan, type KonteksStatus } from "@/lib/services/attendance/recompute";
import { buildImportPreview } from "@/lib/services/attendance/import-map";
import {
  awalHitungUlang,
  buatPetaJamMagang,
  jamEfektifPeserta,
  pesertaSekolahIni,
  petaJamSekolah,
  ringkasPerubahan,
  type JamSekolahBaris,
  type PesertaJamBaris,
} from "@/lib/services/magang/jam-kerja";
import { tanpaUndefined } from "@/lib/services/magang/konten";
import { jamSekolahSchema, ubahJamPesertaSchema } from "@/lib/validators/magang-jam";
import { rencanaJamVoliko } from "@/tools/magang/voliko-jam-kerja";
import { JAM_SEKOLAH_VOLIKO, MIGRASI_JAM } from "@/tools/magang/data/voliko-jam-kerja";

const D = "2026-11-12"; // Kamis
const scan = (jam: string, tipe: "in" | "out", date = D) => ({ scanDate: new Date(`${date}T${jam}:00`), scanType: tipe });
const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const JAM_9_17: JamMagangHari = { jamMasuk: "09:00", jamPulang: "17:00", toleransiMenit: 15 };

const sekolahA: JamSekolahBaris = { sekolahKunci: "smk fiktif satu", sekolahLabel: "SMK Fiktif Satu", jamMasuk: "09:00", jamPulang: "17:00", toleransiMenit: null };
const sekolahB: JamSekolahBaris = { sekolahKunci: "smk fiktif dua", sekolahLabel: "SMK Fiktif Dua", jamMasuk: "08:00", jamPulang: "16:00", toleransiMenit: 10 };
const peserta = (o: Partial<PesertaJamBaris> & { id: number; employeeId: number }): PesertaJamBaris => ({
  sekolah: "SMK Fiktif Satu",
  mulai: "2026-11-01",
  selesai: "2027-01-31",
  aktif: true,
  jamMasuk: null,
  jamPulang: null,
  toleransiMenit: null,
  ...o,
});

describe("computeJamMagang (aturan anak magang)", () => {
  it("09:05 dengan jam 09:00 & toleransi 15 → tidak terlambat", () => {
    expect(computeJamMagang(hm("09:05"), hm("17:00"), JAM_9_17)).toEqual({ status: "on_time", lateMinutes: 0, overtimeMinutes: 0, pulangAwalMinutes: 0 });
  });
  it("09:15 tepat di batas → tidak terlambat; 09:16 → terlambat 16", () => {
    expect(computeJamMagang(hm("09:15"), null, JAM_9_17).lateMinutes).toBe(0);
    expect(computeJamMagang(hm("09:16"), null, JAM_9_17).lateMinutes).toBe(16);
  });
  it("09:20 → terlambat 20 menit (dihitung dari jam masuk, sama dengan aturan toko)", () => {
    expect(computeJamMagang(hm("09:20"), hm("17:00"), JAM_9_17)).toMatchObject({ status: "late", lateMinutes: 20 });
  });
  it("pulang 16:30 dengan jam pulang 17:00 → pulang awal 30, status tetap tepat waktu", () => {
    expect(computeJamMagang(hm("08:55"), hm("16:30"), JAM_9_17)).toEqual({ status: "on_time", lateMinutes: 0, overtimeMinutes: 0, pulangAwalMinutes: 30 });
  });
  it("lembur dihitung lewat jam pulang magang (17:30 → 30), bukan lewat 16:00 jam toko", () => {
    expect(computeJamMagang(hm("09:00"), hm("17:30"), JAM_9_17).overtimeMinutes).toBe(30);
    expect(computeJamMagang(hm("09:00"), hm("17:00"), JAM_9_17).overtimeMinutes).toBe(0);
  });
  it("label jam", () => expect(labelJamKerja("09:00", "17:00")).toBe("09.00–17.00"));
});

describe("computeAttendanceRow dengan jamMagang", () => {
  const base: DayInput = { employeeId: 7, date: D, schedule: null, isHoliday: false, shiftConfig: DEFAULT_SHIFT_CONFIG, scans: [] };
  it("anak magang: masuk 09:20 pulang 16:30 → late 20 + pulang awal 30, shift pagi, jamKerja ikut", () => {
    const r = computeAttendanceRow({ ...base, jamMagang: JAM_9_17, scans: [scan("09:20", "in"), scan("16:30", "out")] });
    expect(r).toMatchObject({ status: "late", lateMinutes: 20, overtimeMinutes: 0, pulangAwalMinutes: 30, shift: "pagi" });
    expect(r.jamKerja).toEqual({ masuk: "09:00", pulang: "17:00", toleransiMenit: 15 });
  });
  it("tanpa jamMagang anak yang sama dihitung jam toko (09:20 → telat 80, lembur 30 lewat 16:00)", () => {
    const r = computeAttendanceRow({ ...base, scans: [scan("09:20", "in"), scan("16:30", "out")] });
    expect(r).toMatchObject({ status: "late", lateMinutes: 80, overtimeMinutes: 30 });
  });
  it("izin tetap menang; tanpa scan tetap absent/holiday", () => {
    expect(computeAttendanceRow({ ...base, jamMagang: JAM_9_17, scans: [{ scanDate: new Date(`${D}T00:00:00`), scanType: "absence", status: "Sakit" }] }).status).toBe("Sakit");
    expect(computeAttendanceRow({ ...base, jamMagang: JAM_9_17 }).status).toBe("absent");
  });
});

describe("karyawan biasa TIDAK berubah", () => {
  const jamList = ["06:30", "07:59", "08:00", "08:15", "08:16", "09:44", "10:29", "10:31", "12:51", "13:00", "13:20", "15:00"];
  const pulangList = [null, "12:00", "16:00", "16:50", "19:59", "20:00", "21:00", "21:37"];
  // Peta berisi anak magang (employee 7) — karyawan 99 bukan peserta.
  const peta = buatPetaJamMagang([peserta({ id: 1, employeeId: 7 })], [sekolahA], 15);

  it("peta mengembalikan null untuk bukan-peserta", () => {
    expect(peta.get(99, D)).toBeNull();
    expect(peta.employeeIds).toEqual([7]);
  });

  it("hasil identik (objek utuh, tanpa kunci tambahan) dengan/ tanpa jamMagang null, dan sama dengan computeShift", () => {
    for (const masuk of jamList)
      for (const pulang of pulangList) {
        const scans = [scan(masuk, "in"), ...(pulang ? [scan(pulang, "out")] : [])];
        const input: DayInput = { employeeId: 99, date: D, schedule: null, isHoliday: false, shiftConfig: DEFAULT_SHIFT_CONFIG, scans };
        const lama = computeAttendanceRow(input);
        expect(computeAttendanceRow({ ...input, jamMagang: peta.get(99, D) })).toEqual(lama);
        expect(computeAttendanceRow({ ...input, jamMagang: null })).toEqual(lama);
        expect("jamKerja" in lama || "pulangAwalMinutes" in lama).toBe(false);
        const sc = computeShift(hm(masuk), pulang ? hm(pulang) : null, DEFAULT_SHIFT_CONFIG);
        expect({ status: lama.status, lateMinutes: lama.lateMinutes, overtimeMinutes: lama.overtimeMinutes, shift: lama.shift }).toEqual(sc);
      }
  });

  it("jadwal per-karyawan & flexible tetap seperti biasa", () => {
    const sch = { startTime: "08:00", endTime: "17:00", lateToleranceMinutes: 5, isHoliday: false };
    const input: DayInput = { employeeId: 99, date: D, schedule: sch, isHoliday: false, scans: [scan("08:10", "in"), scan("17:30", "out")] };
    expect(computeAttendanceRow({ ...input, jamMagang: peta.get(99, D) })).toEqual(computeAttendanceRow(input));
    const flex = { ...input, schedule: { ...sch, flexibleHours: true } };
    expect(computeAttendanceRow({ ...flex, jamMagang: null })).toEqual(computeAttendanceRow(flex));
  });
});

describe("resolver jam (anak → sekolah → umum)", () => {
  const ps = petaJamSekolah([sekolahA, sekolahB]);
  it("jam sekolah dipakai; toleransi null → umum", () => {
    const peta = buatPetaJamMagang([peserta({ id: 1, employeeId: 7 })], [sekolahA], 12);
    expect(peta.get(7, D)).toEqual({ jamMasuk: "09:00", jamPulang: "17:00", toleransiMenit: 12 });
    expect(jamEfektifPeserta(peserta({ id: 1, employeeId: 7 }), ps)).toMatchObject({ sumber: "sekolah", label: "09.00–17.00", toleransiMenit: null });
  });
  it("kolom anak menang atas sekolah, per kolom (masuk khusus, pulang ikut sekolah)", () => {
    const p = peserta({ id: 1, employeeId: 7, jamMasuk: "10:00", toleransiMenit: 5 });
    expect(jamEfektifPeserta(p, ps)).toMatchObject({ jamMasuk: "10:00", jamPulang: "17:00", toleransiMenit: 5, sumber: "anak" });
    expect(buatPetaJamMagang([p], [sekolahA], 15).get(7, D)).toEqual({ jamMasuk: "10:00", jamPulang: "17:00", toleransiMenit: 5 });
  });
  it("toleransi sekolah dipakai bila anak kosong", () => {
    expect(buatPetaJamMagang([peserta({ id: 2, employeeId: 8, sekolah: "SMK Fiktif Dua" })], [sekolahB], 15).get(8, D)?.toleransiMenit).toBe(10);
  });
  it("tanpa jam sekolah & tanpa jam anak lengkap → null (aturan umum)", () => {
    expect(jamEfektifPeserta(peserta({ id: 1, employeeId: 7, sekolah: "SMK Lain" }), ps)).toBeNull();
    expect(jamEfektifPeserta(peserta({ id: 1, employeeId: 7, sekolah: "SMK Lain", jamMasuk: "09:00" }), ps)).toBeNull();
    expect(jamEfektifPeserta(peserta({ id: 1, employeeId: 7, sekolah: "SMK Lain", jamMasuk: "09:00", jamPulang: "15:00" }), ps)?.label).toBe("09.00–15.00");
  });
  it("jam masuk ≥ jam pulang → diabaikan (aturan umum)", () => {
    expect(jamEfektifPeserta(peserta({ id: 1, employeeId: 7, jamMasuk: "18:00" }), ps)).toBeNull();
  });
  it("nonaktif / karyawan nonaktif / di luar masa → null (jam toko)", () => {
    const peta = buatPetaJamMagang(
      [peserta({ id: 1, employeeId: 7, aktif: false }), peserta({ id: 2, employeeId: 8, karyawanAktif: false }), peserta({ id: 3, employeeId: 9, mulai: "2026-11-10", selesai: "2026-11-20" })],
      [sekolahA],
      15
    );
    expect(peta.get(7, D)).toBeNull();
    expect(peta.get(8, D)).toBeNull();
    expect(peta.get(9, "2026-11-09")).toBeNull();
    expect(peta.get(9, "2026-11-10")).not.toBeNull();
    expect(peta.get(9, "2026-11-20")).not.toBeNull();
    expect(peta.get(9, "2026-11-21")).toBeNull();
  });
  it("kunci sekolah tanpa peduli huruf besar & spasi", () => {
    for (const tulisan of ["smk fiktif satu", "SMK  FIKTIF   Satu ", "Smk Fiktif Satu"])
      expect(jamEfektifPeserta(peserta({ id: 1, employeeId: 7, sekolah: tulisan }), ps)?.label).toBe("09.00–17.00");
    const daftar = [peserta({ id: 1, employeeId: 7, sekolah: "SMK FIKTIF SATU" }), peserta({ id: 2, employeeId: 8, sekolah: "smk fiktif satu" }), peserta({ id: 3, employeeId: 9, sekolah: "Lain" }), peserta({ id: 4, employeeId: 10, sekolah: null })];
    expect(pesertaSekolahIni(daftar, "Smk Fiktif  Satu").map((p) => p.id)).toEqual([1, 2]);
    expect(pesertaSekolahIni(daftar, "")).toEqual([]);
  });
  it("hitung ulang dari mulai magang, maksimal 62 hari ke belakang", () => {
    expect(awalHitungUlang("2026-11-01", "2026-11-12")).toBe("2026-11-01");
    expect(awalHitungUlang("2026-01-01", "2026-11-12")).toBe("2026-09-11");
  });
});

describe("validasi (PATCH sebagian)", () => {
  it("PATCH hanya kunci yang dikirim; null = ikut sekolah; tanpa bawaan", () => {
    const r = ubahJamPesertaSchema.parse({ jamMasuk: "09:30" });
    expect(tanpaUndefined(r)).toEqual({ jamMasuk: "09:30" });
    expect(tanpaUndefined(ubahJamPesertaSchema.parse({ toleransiMenit: null }))).toEqual({ toleransiMenit: null });
    expect(ubahJamPesertaSchema.safeParse({}).success).toBe(false);
    expect(ubahJamPesertaSchema.safeParse({ jamMasuk: "9:30" }).success).toBe(false);
    expect(ubahJamPesertaSchema.safeParse({ jamMasuk: "09:30", sekolah: "x" }).success).toBe(false);
    expect(ubahJamPesertaSchema.safeParse({ toleransiMenit: -1 }).success).toBe(false);
  });
  it("PUT sekolah: jam wajib & berurutan; toleransi tidak dikirim tetap undefined (tidak mereset)", () => {
    expect(jamSekolahSchema.parse({ sekolahKunci: "a", jamMasuk: "09:00", jamPulang: "17:00" }).toleransiMenit).toBeUndefined();
    expect(jamSekolahSchema.safeParse({ sekolahKunci: "a", jamMasuk: "17:00", jamPulang: "09:00" }).success).toBe(false);
    expect(jamSekolahSchema.safeParse({ sekolahKunci: "a", jamMasuk: "24:00", jamPulang: "25:00" }).success).toBe(false);
  });
});

describe("hitung ulang tersimpan hanya menyentuh anak magang", () => {
  let id = 0;
  const baris = (employeeId: number, jam: string, tipe: "in" | "out", status = "on_time", late = 0, ot = 0): BarisTersimpan => ({
    id: ++id,
    employeeId,
    scanDate: new Date(`${D}T${jam}:00`),
    scanType: tipe,
    status,
    lateMinutes: late,
    overtimeMinutes: ot,
    absenceReason: null,
  });
  // Nilai tersimpan = hasil jam toko (sebelum jam magang ada).
  const rows = [baris(7, "09:05", "in", "late", 65), baris(7, "17:00", "out", "late", 0, 60), baris(99, "08:20", "in", "late", 20), baris(99, "16:30", "out", "late", 0, 30)];
  const ctx = (jamMagang: KonteksStatus["jamMagang"]): KonteksStatus => ({
    jadwal: () => ({ schedule: null, libur: false }),
    holidaySet: new Set(),
    autoSunday: true,
    shiftConfig: DEFAULT_SHIFT_CONFIG,
    jamMagang,
  });
  it("tanpa jam magang: tidak ada yang berubah (nilai tersimpan sudah benar)", () => {
    expect(perubahanStatus(rows, ctx(PETA_JAM_MAGANG_KOSONG))).toEqual([]);
  });
  it("dengan jam 09–17 untuk karyawan 7: hanya baris karyawan 7 berubah", () => {
    const peta = buatPetaJamMagang([peserta({ id: 1, employeeId: 7 })], [sekolahA], 15);
    const p = perubahanStatus(rows, ctx(peta));
    expect(new Set(p.map((x) => x.employeeId))).toEqual(new Set([7]));
    expect(p.map((x) => x.sesudah)).toEqual([
      { status: "on_time", lateMinutes: 0, overtimeMinutes: 0 },
      { status: "on_time", lateMinutes: 0, overtimeMinutes: 0 },
    ]);
    const r = ringkasPerubahan(rows, p);
    expect(r.get(7)).toEqual({ baris: 2, berubah: 2, terlambatSebelum: 1, terlambatSesudah: 0 });
    expect(r.get(99)).toEqual({ baris: 2, berubah: 0, terlambatSebelum: 1, terlambatSesudah: 1 });
  });
});

describe("impor scanlog", () => {
  it("anak magang memakai jamnya (saran pulang = jam pulang magang); karyawan biasa tetap", () => {
    const employees = [
      { id: 7, machinePin: "7", fullName: "Anak Fiktif", workSchedule: null },
      { id: 99, machinePin: "99", fullName: "Karyawan Fiktif", workSchedule: null },
    ];
    const parsed = [
      { pin: "7", name: "ANAK", dateISO: D, scans: ["09:20:00"] },
      { pin: "99", name: "KARY", dateISO: D, scans: ["09:20:00"] },
    ];
    const tanpa = buildImportPreview(parsed, employees, { shiftConfig: DEFAULT_SHIFT_CONFIG });
    const dengan = buildImportPreview(parsed, employees, { shiftConfig: DEFAULT_SHIFT_CONFIG, jamMagang: (eid) => (eid === 7 ? JAM_9_17 : null) });
    expect(dengan.rows[1]).toEqual(tanpa.rows[1]);
    expect(dengan.rows[0]).toMatchObject({ lateMinutes: 20, status: "late", suggested: "17:00", shift: "pagi" });
  });
});

describe("data & skrip Voliko", () => {
  const anakData = JAM_SEKOLAH_VOLIKO.flatMap((s) => s.anak.map((a) => ({ ...a, sekolah: s.sekolah })));
  const pesertaVoliko = anakData.map((a) => ({ id: a.pesertaId, employeeId: 100 + a.pesertaId, panggilan: a.panggilan.toLowerCase(), sekolah: a.sekolah.toUpperCase() }));

  it("dua sekolah, 8 anak (id 1–8), jam 09–17 & 08–16, toleransi umum", () => {
    expect(anakData.map((a) => a.pesertaId).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(JAM_SEKOLAH_VOLIKO.map((s) => `${s.jamMasuk}-${s.jamPulang}-${s.toleransiMenit}`)).toEqual(["09:00-17:00-null", "08:00-16:00-null"]);
    expect(MIGRASI_JAM).toBe("20261115000000_magang_jam_kerja");
  });
  it("rencana: buat 2 → sesudah diterapkan semua sama (idempoten)", () => {
    const r1 = rencanaJamVoliko(pesertaVoliko, []);
    expect(r1.masalah).toEqual([]);
    expect(r1.aksi.map((a) => a.aksi)).toEqual(["buat", "buat"]);
    const jadi: JamSekolahBaris[] = r1.aksi.map((a) => ({ sekolahKunci: a.kunci, sekolahLabel: a.label, jamMasuk: a.data.jamMasuk, jamPulang: a.data.jamPulang, toleransiMenit: a.data.toleransiMenit }));
    expect(rencanaJamVoliko(pesertaVoliko, jadi).aksi.map((a) => a.aksi)).toEqual(["sama", "sama"]);
    const beda = [{ ...jadi[0], jamMasuk: "08:30" }, jadi[1]];
    expect(rencanaJamVoliko(pesertaVoliko, beda).aksi.map((a) => a.aksi)).toEqual(["beda", "sama"]);
  });
  it("batal bila sekolah tidak ditemukan / panggilan tidak cocok / anak di sekolah lain", () => {
    expect(rencanaJamVoliko(pesertaVoliko.filter((p) => p.id > 4), []).masalah.join(" ")).toMatch(/tidak ditemukan/);
    expect(rencanaJamVoliko(pesertaVoliko.map((p) => (p.id === 5 ? { ...p, panggilan: "lain" } : p)), []).masalah.length).toBe(1);
    expect(rencanaJamVoliko(pesertaVoliko.map((p) => (p.id === 5 ? { ...p, sekolah: pesertaVoliko[7].sekolah } : p)), []).masalah.join(" ")).toMatch(/tercatat di sekolah/);
  });
  it("nama asli anak hanya ada di berkas data", () => {
    const nama = anakData.map((a) => a.panggilan);
    for (const f of [
      "lib/services/magang/jam-kerja.ts",
      "lib/services/magang/jam-kerja-db.ts",
      "lib/services/magang/jam-kerja-simpan.ts",
      "lib/services/attendance/jam-magang.ts",
      "lib/validators/magang-jam.ts",
      "tools/magang/voliko-jam-kerja.ts",
      "tests/magang-jam-kerja.test.ts",
      "components/magang/JamKerjaSekolah.tsx",
      "components/portal/JamKerjaMagang.tsx",
      "tools/magang/deploy-jam-kerja-voliko.sh",
    ]) {
      const isi = readFileSync(f, "utf8");
      for (const n of nama) expect(isi.includes(n), `${n} di ${f}`).toBe(false);
    }
  });
  it("skrip: dry-run bawaan, tanpa DDL/transaksi", () => {
    const skrip = readFileSync("tools/magang/voliko-jam-kerja.ts", "utf8");
    expect(skrip).not.toMatch(/\b(CREATE|ALTER|DROP)\s+TABLE\b/i);
    expect(skrip).not.toMatch(/\$transaction/);
    expect(skrip).toMatch(/--jalankan/);
  });
});

describe("migrasi", () => {
  it("hanya menambah 1 tabel + 3 kolom NULL (tanpa DROP/UPDATE/MODIFY)", () => {
    const sql = readFileSync("prisma/migrations/20261115000000_magang_jam_kerja/migration.sql", "utf8");
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql.match(/ADD COLUMN `\w+` \w+(\(\d+\))? NULL/g)).toHaveLength(3);
    expect(sql).not.toMatch(/\bDROP\b|DELETE FROM|^\s*UPDATE\b|MODIFY|NOT NULL DEFAULT '/im);
    expect(sql).toMatch(/UNIQUE INDEX `MagangJamSekolah_sekolahKunci_key`/);
  });
});
