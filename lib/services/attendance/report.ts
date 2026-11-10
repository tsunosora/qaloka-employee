import { computeShift, type ShiftConfig, type ShiftKind } from "./shift";
import { computeFlexible } from "./flexible";
import { computeJamMagang, type JamMagangHari } from "./jam-magang";

export type ScheduleInfo = {
  startTime: string | null;
  endTime: string | null;
  lateToleranceMinutes: number;
  isHoliday: boolean;
  /** Mode "jam masuk bebas": lembur dihitung dari durasi kerja (8 jam), bukan jam dinding. */
  flexibleHours?: boolean;
};

export type ScanInput = {
  scanDate: string | Date;
  scanType: string | null;
  status?: string | null;
  absenceReason?: string | null;
};

export type DayInput = {
  employeeId: number;
  date: string; // YYYY-MM-DD
  schedule: ScheduleInfo | null;
  isHoliday: boolean;
  scans: ScanInput[];
  /** Bila diisi, status/telat/lembur dihitung dari jam toko & shift (bukan jadwal per-karyawan). */
  shiftConfig?: ShiftConfig | null;
  /**
   * Jam kerja khusus anak magang hari itu (peserta aktif dalam masanya; lib/services/magang/jam-kerja.ts).
   * Bila diisi, menang atas shiftConfig & jadwal per-karyawan. Karyawan biasa: tidak diisi / null → tak berubah.
   */
  jamMagang?: JamMagangHari | null;
};

export type ReportRow = {
  employeeId: number;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  lateMinutes: number;
  overtimeMinutes: number;
  status: string;
  absenceReason: string | null;
  /** Jenis shift (mode shift otomatis); null bila tak terhitung (mis. tanpa scan/absence). */
  shift: ShiftKind | null;
  /** Apakah tanggal ini hari libur (dari holiday/auto-sunday atau jadwal karyawan). */
  isHoliday: boolean;
  /** Mode flexible: hari ini berhak uang makan (durasi kerja di atas 10 jam). */
  mealEligible: boolean;
  /** Mode flexible: menit kekurangan jam bila durasi kerja di bawah 8 jam. */
  undertimeMinutes: number;
  /** Mode flexible: durasi kerja kotor (menit) — dipakai untuk lembur hari libur (semua jam). */
  workedMinutes: number;
  /** Hanya baris anak magang berjam khusus: jam yang dipakai menghitung telat (untuk ditampilkan). */
  jamKerja?: { masuk: string; pulang: string; toleransiMenit: number };
  /** Hanya baris anak magang berjam khusus: menit pulang sebelum jam pulang (info, tidak mengubah status). */
  pulangAwalMinutes?: number;
};

const ABSENCE_STATUSES = new Set(["Izin", "Sakit", "Cuti"]);

/**
 * Apakah satu tanggal layak dibuatkan baris laporan?
 *
 * Hari yang BELUM dilalui tidak boleh muncul sebagai "tidak berangkat" — orangnya
 * memang belum sempat absen. Tapi tanggal depan yang sudah punya catatan (mis. cuti
 * yang sudah disetujui untuk minggu depan) tetap ditampilkan.
 * Semua tanggal berformat "YYYY-MM-DD" sehingga bisa dibandingkan sebagai teks.
 */
export function shouldEmitDate(date: string, hasRecords: boolean, todayStr: string): boolean {
  return date <= todayStr || hasRecords;
}

export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function toDate(d: string | Date): Date {
  return d instanceof Date ? d : new Date(d);
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function fmt(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Hitung satu baris laporan untuk satu karyawan pada satu tanggal. */
export function computeAttendanceRow(input: DayInput): ReportRow {
  const base: ReportRow = {
    employeeId: input.employeeId,
    date: input.date,
    clockIn: null,
    clockOut: null,
    lateMinutes: 0,
    overtimeMinutes: 0,
    status: "absent",
    absenceReason: null,
    shift: null,
    isHoliday: input.isHoliday || (input.schedule?.isHoliday ?? false),
    mealEligible: false,
    undertimeMinutes: 0,
    workedMinutes: 0,
    // Kunci tambahan HANYA untuk anak magang berjam khusus — baris karyawan biasa tetap berbentuk sama persis.
    ...(input.jamMagang
      ? { jamKerja: { masuk: input.jamMagang.jamMasuk, pulang: input.jamMagang.jamPulang, toleransiMenit: input.jamMagang.toleransiMenit } }
      : {}),
  };

  // 1) Record ketidakhadiran eksplisit (Izin/Sakit/Cuti) menang.
  const absence = input.scans.find(
    (s) => s.scanType === "absence" || (s.status && ABSENCE_STATUSES.has(s.status))
  );
  if (absence) {
    return { ...base, status: absence.status ?? "Izin", absenceReason: absence.absenceReason ?? null };
  }

  // 2) Kumpulkan scan in/out.
  const timed = input.scans
    .filter((s) => s.scanType !== "absence")
    .map((s) => ({ ...s, dt: toDate(s.scanDate) }))
    .sort((a, b) => a.dt.getTime() - b.dt.getTime());

  if (timed.length === 0) {
    return { ...base, status: input.isHoliday || input.schedule?.isHoliday ? "holiday" : "absent" };
  }

  const ins = timed.filter((s) => s.scanType === "in");
  const outs = timed.filter((s) => s.scanType === "out");

  // Jam masuk HANYA dari scan bertipe "in"; jam pulang dari scan "out". Tidak ada masuk palsu:
  // baris yang cuma punya scan pulang (mis. lupa absen masuk) => masuk kosong, bukan jam yang sama.
  let clockInDt: Date | null = ins.length ? ins[0].dt : null;
  let clockOutDt: Date | null = outs.length ? outs[outs.length - 1].dt : null;

  // Fallback data lama tanpa label in/out: pertama = masuk, terakhir = pulang.
  if (!clockInDt && !clockOutDt) {
    clockInDt = timed[0].dt;
    clockOutDt = timed.length > 1 ? timed[timed.length - 1].dt : null;
  }

  const clockIn = clockInDt ? fmt(clockInDt) : null;
  const clockOut = clockOutDt ? fmt(clockOutDt) : null;

  // Anak magang berjam khusus: satu shift tetap jamMasuk–jamPulang (lib/services/attendance/jam-magang.ts).
  if (input.jamMagang) {
    const inMin = clockInDt ? minutesOfDay(clockInDt) : null;
    const outMin = clockOutDt ? minutesOfDay(clockOutDt) : null;
    const jm = computeJamMagang(inMin, outMin, input.jamMagang);
    return {
      ...base,
      clockIn,
      clockOut,
      lateMinutes: jm.lateMinutes,
      overtimeMinutes: jm.overtimeMinutes,
      status: jm.status,
      absenceReason: null,
      shift: "pagi",
      pulangAwalMinutes: jm.pulangAwalMinutes,
    };
  }

  // Mode "jam masuk bebas" (per-jadwal): lembur & uang makan dari DURASI kerja, bukan jam dinding.
  // Menang atas shiftConfig global agar toko flexible tak ikut aturan shift pagi/siang/longshift.
  if (input.schedule?.flexibleHours) {
    const inMin = clockInDt ? minutesOfDay(clockInDt) : null;
    const outMin = clockOutDt ? minutesOfDay(clockOutDt) : null;
    const fc = computeFlexible(inMin, outMin);
    return {
      ...base,
      clockIn,
      clockOut,
      lateMinutes: 0,
      overtimeMinutes: fc.overtimeMinutes,
      status: fc.status,
      absenceReason: null,
      shift: "flexible",
      mealEligible: fc.mealEligible,
      undertimeMinutes: fc.undertimeMinutes,
      workedMinutes: fc.workedMinutes,
    };
  }

  // Mode shift otomatis: status/telat/lembur dari jam toko & shift (abaikan jadwal per-karyawan).
  if (input.shiftConfig) {
    const inMin = clockInDt ? minutesOfDay(clockInDt) : null;
    const outMin = clockOutDt ? minutesOfDay(clockOutDt) : null;
    const sc = computeShift(inMin, outMin, input.shiftConfig);
    return {
      ...base,
      clockIn,
      clockOut,
      lateMinutes: sc.lateMinutes,
      overtimeMinutes: sc.overtimeMinutes,
      status: sc.status,
      absenceReason: null,
      shift: sc.shift,
    };
  }

  let lateMinutes = 0;
  let overtimeMinutes = 0;
  let status = "on_time";

  const startMin = parseTimeToMinutes(input.schedule?.startTime ?? null);
  const endMin = parseTimeToMinutes(input.schedule?.endTime ?? null);
  const tolerance = input.schedule?.lateToleranceMinutes ?? 0;

  if (startMin !== null && clockInDt) {
    const inMin = minutesOfDay(clockInDt);
    if (inMin > startMin + tolerance) {
      lateMinutes = inMin - startMin;
      status = "late";
    }
  }

  if (endMin !== null && clockOutDt) {
    const outMin = minutesOfDay(clockOutDt);
    if (outMin > endMin) overtimeMinutes = outMin - endMin;
  }

  return { ...base, clockIn, clockOut, lateMinutes, overtimeMinutes, status, absenceReason: null };
}

/** Bangun laporan untuk banyak input hari (satu per karyawan-tanggal). */
export function buildReport(days: DayInput[]): ReportRow[] {
  return days.map(computeAttendanceRow);
}
