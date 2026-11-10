import type { PrismaClient, Prisma } from "@prisma/client";
import { computeAttendanceRow, type ScheduleInfo } from "./report";
import { loadShiftConfig, type ShiftConfig } from "./shift";
import type { PetaJamMagang } from "./jam-magang";
import { getSetting } from "@/lib/settings";
import { jadwalEfektifDari } from "@/lib/services/jadwal-shift/efektif";
import { muatPetaJamMagang } from "@/lib/services/magang/jam-kerja-db";

export type BarisTersimpan = {
  id: number;
  employeeId: number;
  scanDate: Date;
  scanType: string | null;
  status: string;
  lateMinutes: number;
  overtimeMinutes: number;
  absenceReason: string | null;
};

export type PerubahanStatus = {
  id: number;
  employeeId: number;
  date: string;
  scanType: string | null;
  sebelum: { status: string; lateMinutes: number; overtimeMinutes: number };
  sesudah: { status: string; lateMinutes: number; overtimeMinutes: number };
};

export type KonteksStatus = {
  jadwal: (employeeId: number, date: string) => { schedule: ScheduleInfo | null; libur: boolean };
  holidaySet: ReadonlySet<string>;
  autoSunday: boolean;
  shiftConfig: ShiftConfig;
  jamMagang: PetaJamMagang;
};

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * MURNI: baris tersimpan → daftar baris yang nilainya berbeda dari hasil hitung (computeAttendanceRow).
 * Status satu hari lahir dari jam masuk & pulang, jadi dikelompokkan per karyawan-per hari.
 */
export function perubahanStatus(rows: readonly BarisTersimpan[], ctx: KonteksStatus): PerubahanStatus[] {
  const groups = new Map<string, BarisTersimpan[]>();
  for (const r of rows) {
    const key = `${r.employeeId}|${dateKey(r.scanDate)}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const out: PerubahanStatus[] = [];
  for (const [key, scans] of groups) {
    const [empIdStr, date] = key.split("|");
    const employeeId = Number(empIdStr);
    const hari = ctx.jadwal(employeeId, date);
    const isHoliday =
      ctx.holidaySet.has(date) ||
      (ctx.autoSunday && new Date(`${date}T00:00:00`).getDay() === 0) ||
      hari.libur;

    const computed = computeAttendanceRow({
      employeeId,
      date,
      schedule: hari.schedule,
      isHoliday,
      shiftConfig: ctx.shiftConfig,
      jamMagang: ctx.jamMagang.get(employeeId, date),
      scans: scans.map((s) => ({
        scanDate: s.scanDate,
        scanType: s.scanType,
        status: s.status,
        absenceReason: s.absenceReason,
      })),
    });

    for (const s of scans) {
      // Telat menempel di scan masuk, lembur di scan pulang — seragam dengan input manual.
      const late = s.scanType === "in" ? computed.lateMinutes : 0;
      const overtime = s.scanType === "out" ? computed.overtimeMinutes : 0;
      if (s.status === computed.status && s.lateMinutes === late && s.overtimeMinutes === overtime) continue;
      out.push({
        id: s.id,
        employeeId,
        date,
        scanType: s.scanType,
        sebelum: { status: s.status, lateMinutes: s.lateMinutes, overtimeMinutes: s.overtimeMinutes },
        sesudah: { status: computed.status, lateMinutes: late, overtimeMinutes: overtime },
      });
    }
  }
  return out;
}

export type OpsiHitungUlang = {
  employeeIds?: number[];
  from?: Date;
  machineNames?: string[];
  /** Pratinjau: pakai peta jam magang ini (mis. jam yang BELUM disimpan) alih-alih yang ada di DB. */
  jamMagang?: PetaJamMagang;
};

/** Hitung (tanpa menulis) baris tersimpan yang akan berubah. Dipakai recomputeStoredStatus & pratinjau jam magang. */
export async function rencanaStatusTersimpan(
  prisma: PrismaClient,
  opts: OpsiHitungUlang = {}
): Promise<{ rows: BarisTersimpan[]; perubahan: PerubahanStatus[] }> {
  const where: Prisma.AttendanceWhereInput = {
    ...(opts.machineNames ? { machineName: { in: opts.machineNames } } : {}),
    ...(opts.employeeIds ? { employeeId: { in: opts.employeeIds } } : {}),
    ...(opts.from ? { scanDate: { gte: opts.from } } : {}),
  };

  const rows = await prisma.attendance.findMany({
    where,
    select: {
      id: true,
      employeeId: true,
      scanDate: true,
      scanType: true,
      status: true,
      lateMinutes: true,
      overtimeMinutes: true,
      absenceReason: true,
    },
    orderBy: { scanDate: "asc" },
  });
  if (rows.length === 0) return { rows, perubahan: [] };

  const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
  const dates = [...new Set(rows.map((r) => dateKey(r.scanDate)))];
  const dari = dates.reduce((a, b) => (a < b ? a : b));
  const sampai = dates.reduce((a, b) => (a > b ? a : b));

  const [employees, holidays, autoSundayRaw, shiftConfig] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, workSchedule: true },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: new Date(`${dari}T00:00:00`), lte: new Date(`${sampai}T23:59:59`) } },
      select: { date: true },
    }),
    getSetting("auto_sunday_holiday"),
    loadShiftConfig(),
  ]);

  // Jadwal per tanggal (roster) menang atas jadwal tetap — sama dengan laporan.
  const jadwal = await jadwalEfektifDari(prisma, employees, dari, sampai);
  // Jam kerja khusus anak magang (hanya peserta aktif dalam masanya; karyawan biasa → null = tak berubah).
  const jamMagang = opts.jamMagang ?? (await muatPetaJamMagang(prisma, shiftConfig.lateToleranceMinutes, employeeIds));

  const perubahan = perubahanStatus(rows, {
    jadwal: (id, d) => jadwal.get(id, d),
    holidaySet: new Set(holidays.map((h) => dateKey(h.date))),
    autoSunday: autoSundayRaw === "true",
    shiftConfig,
    jamMagang,
  });
  return { rows, perubahan };
}

/**
 * Hitung ulang status/telat/lembur yang TERSIMPAN di baris Attendance.
 *
 * Scan dari mesin dulu disimpan dengan `status: "on_time"` mati — nilainya tak pernah
 * dihitung. Laporan Absensi memang menghitung sendiri saat ditampilkan, tapi halaman
 * "Log Absensi" membaca kolom tersimpan, sehingga semua orang tampak tepat waktu
 * walau datang jam 09.44.
 *
 * Fungsi ini memakai logika yang SAMA dengan laporan (computeAttendanceRow) supaya
 * kedua halaman tak pernah lagi berbeda.
 */
export async function recomputeStoredStatus(
  prisma: PrismaClient,
  opts: { employeeIds?: number[]; from?: Date; machineNames?: string[] } = {}
): Promise<number> {
  const { perubahan } = await rencanaStatusTersimpan(prisma, opts);
  return terapkanPerubahan(prisma, perubahan);
}

/** Tulis hasil rencanaStatusTersimpan (satu UPDATE per baris yang berubah; tanpa DDL). */
export async function terapkanPerubahan(prisma: PrismaClient, perubahan: readonly PerubahanStatus[]): Promise<number> {
  for (const p of perubahan) {
    await prisma.attendance.update({
      where: { id: p.id },
      data: { status: p.sesudah.status, lateMinutes: p.sesudah.lateMinutes, overtimeMinutes: p.sesudah.overtimeMinutes },
    });
  }
  return perubahan.length;
}
