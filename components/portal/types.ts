/** Bentuk data yang dikirim API portal karyawan (/api/public/portal/[token]/*). */

export type PortalEmployeeInfo = {
  fullName: string;
  nickname: string | null;
  position: string | null;
  department: string | null;
  photoPath: string | null;
};

export type PortalState = {
  employee: PortalEmployeeInfo;
  /** PIN khusus portal sudah dibuat. */
  pinSet: boolean;
  /** Karyawan punya PIN PosPro (PIN desainer/piket) yang juga bisa dipakai masuk. */
  posproPin: boolean;
  /** Dibuka oleh owner/HR/admin yang sedang login — tanpa PIN, hanya bisa melihat. */
  asManager: boolean;
  authenticated: boolean;
  /** Kode fitur tab portal → termasuk paket atau tidak (lib/services/portal/keadaan.ts). */
  fitur?: Record<string, boolean>;
  /** Peserta magang aktif → tab Magang tampil. */
  magang?: boolean;
  /** Pembimbing pos magang aktif → tab Bimbingan tampil. */
  pembimbing?: boolean;
  /** Absen lewat HP menyala untuk karyawan ini (+ add-on termasuk lisensi) → tombol "Absen sekarang". */
  absenHp?: boolean;
  /** Portal /me termasuk lisensi → halaman absen menautkan balik ke /me. */
  portal?: boolean;
};

export type AttendanceRow = {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  shift: string | null;
  lateMinutes: number;
  overtimeMinutes: number;
  isHoliday: boolean;
  absenceReason: string | null;
  workedMinutes: number;
  output: DailyOutput | null;
};

export type DailyOutput = {
  date: string;
  transactions: number;
  /** Omzet sebagai kasir. */
  omzet: number;
  designJobs: number;
  /** Omzet sebagai desainer. */
  designOmzet: number;
  /** Jasa desain terjual per jenjang. */
  designServices: { level: string; qty: number; value: number }[];
  designServiceCount: number;
  designServiceValue: number;
  operatorJobs: number;
  /** Omzet sebagai operator. */
  operatorOmzet: number;
  tasksOnTime: number;
  tasksLate: number;
  /** Jumlah ketiga peran. */
  totalOmzet: number;
};

export type OutputTotals = Omit<DailyOutput, "date">;

export type DisciplineSummary = {
  workedDays: number;
  totalWorkedMinutes: number;
  avgWorkedMinutes: number;
  lateDays: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
  onTimeRate: number;
};

export type Discipline = {
  current: DisciplineSummary;
  previous: DisciplineSummary;
  lateDelta: number;
  onTimeDelta: number;
  workedDelta: number;
  trend: "membaik" | "memburuk" | "sama" | "baru";
};

export type AttendanceSummary = {
  present: number;
  onTime: number;
  late: number;
  longshift: number;
  absent: number;
  leave: number;
  holiday: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
  attendanceRate: number;
};

export type ScoreRow = {
  indicator: string;
  category: string;
  weight: number;
  score: number;
  weightedValue: number;
  notes: string | null;
};

export type Assessment = {
  id: number;
  date: string;
  period: string | null;
  totalScore: number;
  grade: string | null;
  template: string;
  evaluatorNotes: string | null;
  developmentPlan: string | null;
  recommendation: string | null;
  scores: ScoreRow[];
};

export type ReceiptTotals = {
  lsCount: number;
  lcHours: number;
  llCount: number;
  dailyAmount: number;
  holidayAmount: number;
  cetakAmount: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  holidayOvertimeMinutes: number;
  holidayOvertimeAmount: number;
  mealCount: number;
  mealAmount: number;
  undertimeMinutes: number;
  grandTotal: number;
};

export type Receipt = {
  monthLabel: string;
  flexible: boolean;
  labels: {
    daily: string;
    holiday: string;
    cetak: string;
    flexOvertime: string;
    flexHoliday: string;
    meal: string;
  };
  totals: ReceiptTotals;
};

export type PosproKpi = {
  userId: number;
  name: string;
  branchId: number | null;
  isActive: boolean;
  csRating: { count: number; avgStars: number; satisfiedCount: number; satisfactionRate: number };
  tasks: { assigned: number; done: number; late: number; completionRate: number };
  sales: { transactions: number; grandTotal: number; averageTicket: number };
};

export type Overview = {
  period: { label: string; startStr: string; endStr: string; year: number; month: number };
  attendance: { summary: AttendanceSummary; rows: AttendanceRow[] };
  receipt: Receipt | null;
  assessment: {
    latest: Assessment | null;
    history: { id: number; date: string; totalScore: number; grade: string | null; period: string | null }[];
    average: number;
  };
  publicFeedback: {
    average: number;
    count: number;
    items: { id: number; date: string; stars: number; raterName: string | null; comment: string | null }[];
  };
  /** null = karyawan belum dipetakan ke akun PosPro, atau PosPro tak bisa dihubungi. */
  pospro: PosproKpi | null;
  discipline: Discipline;
  outputTotals: OutputTotals | null;
};

export type LeaveRequestItem = {
  id: number;
  startDate: string;
  endDate: string;
  days: number;
  type: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  /** Foto surat dokter / PDF (metadata saja; berkasnya lewat rute ber-PIN). */
  lampiran: LampiranMeta[];
};

export type LampiranMeta = { id: number; nama: string; tipe: string; ukuran: number };
