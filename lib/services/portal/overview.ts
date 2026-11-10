import type { PrismaClient } from "@prisma/client";
import { awalHitung, potongSebelum } from "./awal-hitung";
import { aggregateAttendance } from "@/lib/services/attendance/aggregate";
import { labelJamKerja } from "@/lib/services/attendance/jam-magang";
import { buildEmployeeReceipt } from "@/lib/services/attendance/receipt-source";
import type { ReceiptData } from "@/lib/services/attendance/receipt";
import type { ReceiptPeriod } from "@/lib/services/attendance/period";
import {
  fetchPosproKpiForUser,
  fetchPosproDaily,
  type PosproStaffKpi,
  type PosproDailyRow,
} from "@/lib/services/pospro/client";
import {
  workedMinutesOf,
  summarizeDiscipline,
  compareDiscipline,
  previousRange,
  type DisciplineComparison,
} from "./worktime";

/** Status yang berarti karyawan tidak masuk dengan keterangan. */
const LEAVE_STATUSES = new Set(["Izin", "Sakit", "Cuti"]);

export type PortalAttendanceRow = {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  shift: string | null;
  lateMinutes: number;
  overtimeMinutes: number;
  isHoliday: boolean;
  absenceReason: string | null;
  /** Durasi kerja hari itu (menit), dihitung dari jam masuk & pulang. */
  workedMinutes: number;
  /** Hasil kerja hari itu dari PosPro; null bila tak dipetakan / tak ada data. */
  output: PosproDailyRow | null;
  /** Hanya anak magang berjam khusus: menit pulang sebelum jam pulang magangnya. */
  pulangAwalMinutes?: number;
};

export type PortalAttendanceSummary = {
  /** Hari dengan scan masuk/pulang. */
  present: number;
  onTime: number;
  late: number;
  longshift: number;
  /** Hari tanpa scan & tanpa keterangan. */
  absent: number;
  /** Hari Izin/Sakit/Cuti. */
  leave: number;
  holiday: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
  /** Persentase kehadiran terhadap hari kerja (bukan libur), 0–100. */
  attendanceRate: number;
};

export type PortalScore = {
  indicator: string;
  category: string;
  weight: number;
  score: number;
  weightedValue: number;
  notes: string | null;
};

export type PortalAssessment = {
  id: number;
  date: string;
  period: string | null;
  totalScore: number;
  grade: string | null;
  template: string;
  evaluatorNotes: string | null;
  developmentPlan: string | null;
  recommendation: string | null;
  scores: PortalScore[];
};

export type PortalOverview = {
  period: { label: string; startStr: string; endStr: string; year: number; month: number };
  attendance: { summary: PortalAttendanceSummary; rows: PortalAttendanceRow[] };
  /** Estimasi lembur/uang makan periode ini (struk). */
  receipt: ReceiptData | null;
  assessment: {
    latest: PortalAssessment | null;
    history: { id: number; date: string; totalScore: number; grade: string | null; period: string | null }[];
    average: number;
  };
  publicFeedback: {
    average: number;
    count: number;
    items: { id: number; date: string; stars: number; raterName: string | null; comment: string | null }[];
  };
  /**
   * KPI dari PosPro (kasir) bila karyawan sudah dipetakan & PosPro bisa dihubungi.
   * null = belum dipetakan, integrasi mati, atau PosPro sedang tak bisa dihubungi —
   * halaman tetap tampil tanpa bagian ini.
   */
  pospro: PosproStaffKpi | null;
  /** Perbandingan kedisiplinan dengan periode sebelumnya (semakin tertib atau tidak). */
  discipline: DisciplineComparison;
  /** Total hasil kerja periode ini dari PosPro; null bila tak ada. */
  outputTotals: Omit<PosproDailyRow, "date"> | null;
  /**
   * Anak magang berjam khusus (mis. 09.00–17.00): jam yang dipakai menghitung telat di periode ini (hari terakhir yang
   * memakainya). null = karyawan biasa / jam toko.
   */
  jamKerja?: { label: string; masuk: string; pulang: string; toleransiMenit: number } | null;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Ringkas baris laporan absensi menjadi angka-angka kartu portal. */
export function summarizeRows(rows: PortalAttendanceRow[]): PortalAttendanceSummary {
  const present = rows.filter((r) => r.clockIn || r.clockOut).length;
  const leave = rows.filter((r) => LEAVE_STATUSES.has(r.status)).length;
  const holiday = rows.filter((r) => r.status === "holiday").length;
  const absent = rows.filter((r) => r.status === "absent").length;
  const workDays = rows.length - holiday;
  return {
    present,
    onTime: rows.filter((r) => r.status === "on_time").length,
    late: rows.filter((r) => r.status === "late").length,
    longshift: rows.filter((r) => r.status === "longshift").length,
    absent,
    leave,
    holiday,
    totalLateMinutes: rows.reduce((s, r) => s + r.lateMinutes, 0),
    totalOvertimeMinutes: rows.reduce((s, r) => s + r.overtimeMinutes, 0),
    attendanceRate: workDays > 0 ? Math.round((present / workDays) * 100) : 0,
  };
}

/**
 * Semua data satu karyawan untuk satu periode: absensi, struk lembur,
 * penilaian kinerja, dan feedback publik. Dipakai halaman portal /me/[token].
 */
export async function buildPortalOverview(
  prisma: PrismaClient,
  employeeId: number,
  period: ReceiptPeriod,
  posproUserId: number | null = null
): Promise<PortalOverview> {
  const prev = previousRange(period.startStr, period.endStr);
  const [attendance, receipt, assessments, publicAgg, publicItems, pospro, daily, prevAttendance, orang, magang] =
    await Promise.all([
    aggregateAttendance(prisma, {
      startStr: period.startStr,
      endStr: period.endStr,
      employeeId: String(employeeId),
    }),
    buildEmployeeReceipt(prisma, employeeId, period),
    prisma.assessment.findMany({
      where: { employeeId, deletedAt: null, isPublic: false, status: { in: ["completed", "approved"] } },
      orderBy: { assessmentDate: "desc" },
      take: 12,
      include: {
        template: { select: { name: true } },
        scores: { include: { indicator: true }, orderBy: { id: "asc" } },
      },
    }),
    prisma.assessment.aggregate({
      where: { employeeId, deletedAt: null, isPublic: true },
      _avg: { totalScore: true },
      _count: true,
    }),
    prisma.assessment.findMany({
      where: { employeeId, deletedAt: null, isPublic: true },
      orderBy: { assessmentDate: "desc" },
      take: 5,
      select: { id: true, totalScore: true, raterName: true, evaluatorNotes: true, assessmentDate: true },
    }),
    fetchPosproKpiForUser(posproUserId, period.startStr, period.endStr),
    fetchPosproDaily(posproUserId, period.startStr, period.endStr),
    // Periode sebelumnya — hanya untuk membandingkan kedisiplinan.
    aggregateAttendance(prisma, {
      startStr: prev.startStr,
      endStr: prev.endStr,
      employeeId: String(employeeId),
    }),
    prisma.employee.findUnique({ where: { id: employeeId }, select: { joinDate: true } }),
    prisma.magangPeserta.findMany({ where: { employeeId }, select: { mulai: true } }),
  ]);
  // Hari sebelum bergabung / sebelum masa magang tidak dihitung (lib/services/portal/awal-hitung.ts).
  const awal = awalHitung({ joinDate: orang?.joinDate ?? null, magangMulai: magang.map((m) => m.mulai) });

  const outputByDate = new Map((daily?.days ?? []).map((d) => [d.date, d]));
  const rows: PortalAttendanceRow[] = potongSebelum(attendance.rows, awal).map((r) => ({
    date: r.date,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    status: r.status,
    shift: r.shift,
    lateMinutes: r.lateMinutes,
    overtimeMinutes: r.overtimeMinutes,
    isHoliday: r.isHoliday,
    absenceReason: r.absenceReason,
    workedMinutes: workedMinutesOf(r.clockIn, r.clockOut),
    output: outputByDate.get(r.date) ?? null,
    ...(r.pulangAwalMinutes != null ? { pulangAwalMinutes: r.pulangAwalMinutes } : {}),
  }));
  const jamTerakhir = [...attendance.rows].reverse().find((r) => r.jamKerja)?.jamKerja ?? null;

  const discipline = compareDiscipline(
    summarizeDiscipline(rows),
    summarizeDiscipline(
      potongSebelum(prevAttendance.rows, awal).map((r) => ({
        clockIn: r.clockIn,
        lateMinutes: r.lateMinutes,
        workedMinutes: workedMinutesOf(r.clockIn, r.clockOut),
      }))
    )
  );

  const latestRaw = assessments[0] ?? null;
  const latest: PortalAssessment | null = latestRaw
    ? {
        id: latestRaw.id,
        date: ymd(latestRaw.assessmentDate),
        period: latestRaw.period,
        totalScore: Number(latestRaw.totalScore ?? 0),
        grade: latestRaw.grade,
        template: latestRaw.template.name,
        evaluatorNotes: latestRaw.evaluatorNotes,
        developmentPlan: latestRaw.developmentPlan,
        recommendation: latestRaw.recommendation,
        scores: latestRaw.scores.map((s) => ({
          indicator: s.indicator.name,
          category: s.indicator.category,
          weight: Number(s.indicator.weight),
          score: s.score,
          weightedValue: Number(s.weightedValue),
          notes: s.notes,
        })),
      }
    : null;

  const history = assessments
    .map((a) => ({
      id: a.id,
      date: ymd(a.assessmentDate),
      totalScore: Number(a.totalScore ?? 0),
      grade: a.grade,
      period: a.period,
    }))
    .reverse(); // urut lama -> baru untuk grafik tren

  const average = history.length
    ? round2(history.reduce((s, h) => s + h.totalScore, 0) / history.length)
    : 0;

  return {
    period: {
      label: period.label,
      startStr: period.startStr,
      endStr: period.endStr,
      year: period.year,
      month: period.month,
    },
    attendance: { summary: summarizeRows(rows), rows },
    receipt,
    assessment: { latest, history, average },
    publicFeedback: {
      average: publicAgg._avg.totalScore ? round2(Number(publicAgg._avg.totalScore)) : 0,
      count: publicAgg._count,
      items: publicItems.map((p) => ({
        id: p.id,
        date: ymd(p.assessmentDate),
        stars: Number(p.totalScore ?? 0),
        raterName: p.raterName,
        comment: p.evaluatorNotes,
      })),
    },
    pospro,
    discipline,
    outputTotals: daily?.totals ?? null,
    jamKerja: jamTerakhir ? { label: labelJamKerja(jamTerakhir.masuk, jamTerakhir.pulang), ...jamTerakhir } : null,
  };
}
