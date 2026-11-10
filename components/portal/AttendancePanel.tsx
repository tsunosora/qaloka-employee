"use client";

import { Card, Empty, StatusBadge, hm, shortDate } from "./ui";
import type { Overview } from "./types";
import { JamKerjaMagang } from "./JamKerjaMagang";

/** Rincian absensi harian satu periode. */
export function AttendancePanel({ data }: { data: Overview }) {
  const rows = data.attendance.rows;

  return (
    <Card title={`Absensi harian — ${data.period.label}`}>
      {data.jamKerja && (
        <div className="mb-3">
          <JamKerjaMagang jam={data.jamKerja} />
        </div>
      )}
      {rows.length === 0 ? (
        <Empty>Belum ada data absensi di periode ini.</Empty>
      ) : (
        <>
          {/* Ponsel: kartu per hari. Desktop: tabel. */}
          <ul className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <li key={r.date} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">{shortDate(r.date)}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="tabular mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                  <span>Masuk {r.clockIn ?? "—"}</span>
                  <span>Pulang {r.clockOut ?? "—"}</span>
                  {r.lateMinutes > 0 && <span className="text-warning">Telat {hm(r.lateMinutes)}</span>}
                  {r.overtimeMinutes > 0 && <span className="text-info">Lembur {hm(r.overtimeMinutes)}</span>}
                  {(r.pulangAwalMinutes ?? 0) > 0 && <span className="text-warning">Pulang awal {hm(r.pulangAwalMinutes ?? 0)}</span>}
                </div>
                {r.absenceReason && (
                  <p className="mt-1.5 text-xs italic text-subtle">“{r.absenceReason}”</p>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-subtle">
                  <th className="pb-2 pr-3 font-medium">Tanggal</th>
                  <th className="pb-2 pr-3 font-medium">Masuk</th>
                  <th className="pb-2 pr-3 font-medium">Pulang</th>
                  <th className="pb-2 pr-3 font-medium">Telat</th>
                  <th className="pb-2 pr-3 font-medium">Lembur</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-fg">
                      {shortDate(r.date)}
                      {r.isHoliday && <span className="ml-1.5 text-[11px] text-subtle">libur</span>}
                    </td>
                    <td className="tabular py-2 pr-3 text-muted">{r.clockIn ?? "—"}</td>
                    <td className="tabular py-2 pr-3 text-muted">{r.clockOut ?? "—"}</td>
                    <td className="tabular py-2 pr-3 text-muted">
                      {r.lateMinutes > 0 ? hm(r.lateMinutes) : "—"}
                    </td>
                    <td className="tabular py-2 pr-3 text-muted">
                      {r.overtimeMinutes > 0 ? hm(r.overtimeMinutes) : "—"}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={r.status} />
                      {(r.pulangAwalMinutes ?? 0) > 0 && (
                        <div className="mt-0.5 text-[11px] text-warning">Pulang awal {hm(r.pulangAwalMinutes ?? 0)}</div>
                      )}
                      {r.absenceReason && (
                        <div className="mt-0.5 text-[11px] italic text-subtle">“{r.absenceReason}”</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
