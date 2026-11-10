import type { PrismaClient, Prisma } from "@prisma/client";
import { buildReport, shouldEmitDate, type DayInput } from "./report";
import { loadShiftConfig } from "./shift";
import { getSetting } from "@/lib/settings";
import { jadwalEfektifDari } from "@/lib/services/jadwal-shift/efektif";
import { muatPetaJamMagang } from "@/lib/services/magang/jam-kerja-db";

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function eachDate(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(dateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export type AttendanceReportParams = {
  startStr: string;
  endStr: string;
  departmentId?: string | null;
  employeeId?: string | null;
  machineId?: string | null;
};

export type AttendanceReportResult = {
  rows: (ReturnType<typeof buildReport>[number] & { fullName: string; department: string | null })[];
  summary: {
    totalRows: number;
    late: number;
    absent: number;
    onTime: number;
    longshift: number;
    totalLateMinutes: number;
    totalOvertimeMinutes: number;
  };
};

/** Agregasi laporan absensi untuk rentang tanggal × karyawan (dipakai route report & export). */
export async function aggregateAttendance(
  prisma: PrismaClient,
  { startStr, endStr, departmentId, employeeId, machineId }: AttendanceReportParams
): Promise<AttendanceReportResult> {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  const rangeEnd = new Date(end.getTime() + 86400000);

  const empWhere: Prisma.EmployeeWhereInput = { deletedAt: null, isActive: true };
  if (departmentId) empWhere.departmentId = Number(departmentId);
  if (employeeId) empWhere.id = Number(employeeId);
  // Filter per mesin/cabang: batasi karyawan ke yang terdaftar di mesin itu.
  if (machineId) {
    const enrolls = await prisma.machineEnrollment.findMany({
      where: { machineId: Number(machineId) },
      select: { employeeId: true },
    });
    const ids = enrolls.map((e) => e.employeeId);
    empWhere.id = employeeId ? Number(employeeId) : { in: ids.length ? ids : [-1] };
  }

  const employees = await prisma.employee.findMany({
    where: empWhere,
    include: { workSchedule: true, department: true },
    orderBy: { fullName: "asc" },
  });

  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      scanDate: { gte: start, lt: rangeEnd },
      ...(machineId ? { machineId: Number(machineId) } : {}),
    },
    orderBy: { scanDate: "asc" },
  });

  const holidays = await prisma.holiday.findMany({ where: { date: { gte: start, lt: rangeEnd } } });
  const holidaySet = new Set(holidays.map((h) => dateKey(h.date)));
  const autoSunday = (await getSetting("auto_sunday_holiday")) === "true";
  const shiftConfig = await loadShiftConfig();
  const jadwal = await jadwalEfektifDari(prisma, employees, startStr, endStr);
  // Jam kerja khusus anak magang (peserta aktif dalam masanya). Karyawan biasa → null → perhitungan tak berubah.
  const jamMagang = await muatPetaJamMagang(prisma, shiftConfig.lateToleranceMinutes, employees.map((e) => e.id));

  const byEmpDate = new Map<string, typeof attendances>();
  for (const a of attendances) {
    const key = `${a.employeeId}|${dateKey(a.scanDate)}`;
    const arr = byEmpDate.get(key) ?? [];
    arr.push(a);
    byEmpDate.set(key, arr);
  }

  const allDates = eachDate(start, end);
  const showAllDates = Boolean(employeeId);
  // Hari yang BELUM dilalui tidak boleh dihitung "tidak berangkat" — orangnya memang
  // belum sempat absen. Tanggal setelah hari ini hanya muncul bila sudah punya catatan
  // (mis. cuti yang sudah disetujui untuk minggu depan).
  const todayKey = dateKey(new Date());

  const days: (DayInput & { fullName: string; department: string | null })[] = [];
  for (const emp of employees) {
    for (const date of allDates) {
      const scans = byEmpDate.get(`${emp.id}|${date}`) ?? [];
      if (!showAllDates && scans.length === 0) continue;
      if (!shouldEmitDate(date, scans.length > 0, todayKey)) continue;
      // Jadwal per tanggal (roster) menang atas jadwal tetap; libur roster = hari libur.
      const hari = jadwal.get(emp.id, date);
      const isHoliday =
        holidaySet.has(date) ||
        (autoSunday && new Date(`${date}T00:00:00`).getDay() === 0) ||
        hari.libur;
      days.push({
        employeeId: emp.id,
        fullName: emp.fullName,
        department: emp.department?.name ?? null,
        date,
        schedule: hari.schedule,
        isHoliday,
        shiftConfig,
        jamMagang: jamMagang.get(emp.id, date),
        scans: scans.map((s) => ({
          scanDate: s.scanDate,
          scanType: s.scanType,
          status: s.status,
          absenceReason: s.absenceReason,
        })),
      });
    }
  }

  // `...r` menyertakan shift & isHoliday (dari buildReport) — dipakai oleh struk absensi.
  const rows = buildReport(days).map((r, idx) => ({
    ...r,
    fullName: days[idx].fullName,
    department: days[idx].department,
  }));

  const summary = {
    totalRows: rows.length,
    late: rows.filter((r) => r.status === "late").length,
    absent: rows.filter((r) => r.status === "absent").length,
    onTime: rows.filter((r) => r.status === "on_time").length,
    longshift: rows.filter((r) => r.status === "longshift").length,
    totalLateMinutes: rows.reduce((s, r) => s + r.lateMinutes, 0),
    totalOvertimeMinutes: rows.reduce((s, r) => s + r.overtimeMinutes, 0),
  };

  return { rows, summary };
}
