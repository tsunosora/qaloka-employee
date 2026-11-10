"use client";

import { AttendanceDonut } from "@/components/attendance/AttendanceDonut";
import { IconCheck, IconClock, IconStar, IconAlert } from "@/components/ui/icons";
import { Card, Stat, Empty, hm, rupiah, soft } from "./ui";
import { WorkChart } from "./WorkChart";
import { DisciplineCard } from "./DisciplineCard";
import { DailyOutputPanel } from "./DailyOutputPanel";
import { JamKerjaMagang } from "./JamKerjaMagang";
import type { Overview } from "./types";

/** Ringkasan satu periode: kehadiran, skor, feedback tamu, dan estimasi lembur. */
export function OverviewPanel({ data }: { data: Overview }) {
  const s = data.attendance.summary;
  const a = data.assessment;
  const f = data.publicFeedback;

  return (
    <div className="space-y-4">
      {data.jamKerja && <JamKerjaMagang jam={data.jamKerja} />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Kehadiran"
          value={`${s.attendanceRate}%`}
          hint={`${s.present} hari masuk`}
          icon={IconCheck}
          tone="var(--success)"
        />
        <Stat
          label="Terlambat"
          value={s.late}
          hint={s.totalLateMinutes > 0 ? `total ${hm(s.totalLateMinutes)}` : "tidak ada"}
          icon={IconClock}
          tone="var(--warning)"
        />
        <Stat
          label="Lembur"
          value={hm(s.totalOvertimeMinutes)}
          hint={`${s.longshift} hari longshift`}
          icon={IconClock}
          tone="var(--info)"
        />
        <Stat
          label="Skor penilaian"
          value={a.latest ? a.latest.totalScore.toFixed(2) : "—"}
          hint={a.latest?.grade ?? "belum dinilai"}
          icon={IconStar}
          tone="var(--primary)"
        />
      </div>

      <WorkChart rows={data.attendance.rows} periodLabel={data.period.label} />

      <DisciplineCard d={data.discipline} />

      {data.outputTotals && (
        <DailyOutputPanel
          rows={data.attendance.rows}
          totals={data.outputTotals}
          periodLabel={data.period.label}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Kehadiran ${data.period.label}`}>
          <AttendanceDonut present={s.onTime + s.longshift} late={s.late} absent={s.absent} />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <MiniStat label="Izin/Sakit/Cuti" value={s.leave} />
            <MiniStat label="Hari libur" value={s.holiday} />
            <MiniStat label="Longshift" value={s.longshift} />
          </div>
        </Card>

        <Card title="Penilaian & masukan">
          {a.latest ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="tabular font-display text-4xl font-extrabold text-fg">
                  {a.latest.totalScore.toFixed(2)}
                </span>
                <span
                  className="badge"
                  style={{ ...soft("var(--primary)", 18), color: "var(--primary)" }}
                >
                  {a.latest.grade ?? "—"}
                </span>
              </div>
              <p className="text-xs text-muted">
                {a.latest.template} · {a.latest.period ?? a.latest.date}
                {a.history.length > 1 && ` · rata-rata ${a.average.toFixed(2)} dari ${a.history.length} penilaian`}
              </p>
              {a.latest.evaluatorNotes && (
                <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm leading-relaxed text-muted">
                  {a.latest.evaluatorNotes}
                </p>
              )}
            </div>
          ) : (
            <Empty>Belum ada penilaian kinerja untuk Anda.</Empty>
          )}

          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Rating tamu (QR)</span>
              <span className="tabular font-semibold text-fg">
                {f.count > 0 ? `${f.average.toFixed(2)} ★ · ${f.count} masukan` : "belum ada"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {data.receipt && (
        <Card title={`Estimasi lembur — ${data.receipt.monthLabel}`}>
          <p
            className="mb-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed text-muted"
            style={soft("var(--info)", 10)}
          >
            <IconAlert className="mt-0.5 text-[14px] shrink-0 text-info" />
            Angka di bawah adalah <b className="text-fg">estimasi</b> dari data absensi, bukan slip gaji
            resmi. Bila ada selisih, konfirmasikan ke admin.
          </p>
          <ul className="space-y-2 text-sm">
            {data.receipt.flexible ? (
              <>
                <Line
                  label={data.receipt.labels.flexOvertime}
                  detail={hm(data.receipt.totals.overtimeMinutes)}
                  amount={data.receipt.totals.overtimeAmount}
                />
                <Line
                  label={data.receipt.labels.flexHoliday}
                  detail={hm(data.receipt.totals.holidayOvertimeMinutes)}
                  amount={data.receipt.totals.holidayOvertimeAmount}
                />
                <Line
                  label={data.receipt.labels.meal}
                  detail={`${data.receipt.totals.mealCount} hari`}
                  amount={data.receipt.totals.mealAmount}
                />
              </>
            ) : (
              <>
                <Line
                  label={data.receipt.labels.daily}
                  detail={`${data.receipt.totals.lsCount} hari`}
                  amount={data.receipt.totals.dailyAmount}
                />
                <Line
                  label={data.receipt.labels.holiday}
                  detail={`${data.receipt.totals.llCount} hari`}
                  amount={data.receipt.totals.holidayAmount}
                />
                <Line
                  label={data.receipt.labels.cetak}
                  detail={`${data.receipt.totals.lcHours} jam`}
                  amount={data.receipt.totals.cetakAmount}
                />
              </>
            )}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold text-fg">Total</span>
            <span className="tabular font-display text-xl font-extrabold text-fg">
              {rupiah(data.receipt.totals.grandTotal)}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="tabular font-display text-lg font-bold text-fg">{value}</div>
      <div className="text-[11px] text-subtle">{label}</div>
    </div>
  );
}

function Line({ label, detail, amount }: { label: string; detail: string; amount: number }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted">
        {label} <span className="text-subtle">· {detail}</span>
      </span>
      <span className="tabular font-medium text-fg">{rupiah(amount)}</span>
    </li>
  );
}
