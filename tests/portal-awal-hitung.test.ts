import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { awalHitung, potongSebelum, ymdLokal } from "@/lib/services/portal/awal-hitung";

// Tanggal dibuat dengan jam LOKAL supaya tes tidak bergantung zona waktu mesin.
const hari = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const baris = (date: string) => ({ date, status: "absent" });

describe("awalHitung — hari pertama yang dihitung di Ringkasan", () => {
  it("peserta magang: tanggal mulai magang, bukan joinDate", () => {
    expect(awalHitung({ joinDate: hari(2026, 1, 1), magangMulai: [hari(2026, 11, 9)] })).toBe("2026-11-09");
  });
  it("beberapa masa magang → yang paling awal", () => {
    expect(awalHitung({ joinDate: null, magangMulai: [hari(2026, 11, 9), hari(2026, 7, 1)] })).toBe("2026-07-01");
  });
  it("karyawan biasa: joinDate; tanpa keduanya: tidak dipotong", () => {
    expect(awalHitung({ joinDate: hari(2026, 11, 3), magangMulai: [] })).toBe("2026-11-03");
    expect(awalHitung({ joinDate: null, magangMulai: [] })).toBeNull();
  });
  it("ymdLokal memakai tanggal lokal", () => {
    expect(ymdLokal(new Date(2026, 10, 9, 0, 0))).toBe("2026-11-09");
  });
});

describe("potongSebelum — bug 8 Nov: hari sebelum masa magang terhitung tidak hadir", () => {
  const nov = ["2026-11-02", "2026-11-03", "2026-11-07", "2026-11-09", "2026-11-10"].map(baris);
  it("hari sebelum mulai dibuang, hari mulai tetap", () => {
    expect(potongSebelum(nov, "2026-11-09").map((r) => r.date)).toEqual(["2026-11-09", "2026-11-10"]);
  });
  it("tanpa tanggal awal: semua baris tetap", () => {
    expect(potongSebelum(nov, null)).toHaveLength(5);
  });
  it("mulai sesudah periode: periode itu kosong (bukan penuh absen)", () => {
    expect(potongSebelum(nov, "2026-12-01")).toEqual([]);
  });
  it("buildPortalOverview memotong baris periode ini DAN periode pembanding", () => {
    const src = readFileSync("lib/services/portal/overview.ts", "utf8");
    expect(src).toContain("potongSebelum(attendance.rows, awal)");
    expect(src).toContain("potongSebelum(prevAttendance.rows, awal)");
  });
});

describe("portal /me → absen HP", () => {
  const me = readFileSync("app/(public)/me/[token]/page.tsx", "utf8");
  const absen = readFileSync("app/(public)/absen/[token]/page.tsx", "utf8");
  const keadaan = readFileSync("lib/services/portal/keadaan.ts", "utf8");
  it("tombol absen hanya bila absen HP menyala & bukan mode owner, menuju /absen/<token>", () => {
    expect(me).toContain("state.absenHp && !state.asManager");
    expect(me).toContain("href={`/absen/${token}`}");
  });
  it("absenHp = saklar karyawan DAN add-on hr.absen_hp termasuk lisensi", () => {
    expect(keadaan).toMatch(/absenHp: employee\.absenHp && lisensi\["hr\.absen_hp"\] !== false/);
  });
  it("halaman absen menautkan balik ke /me hanya bila portal termasuk lisensi", () => {
    expect(absen).toContain("keadaan.portal &&");
    expect(absen).toContain("href={`/me/${token}`}");
  });
});
