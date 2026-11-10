"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconDownload, IconPencil, IconCheck } from "@/components/ui/icons";

type Row = {
  /** Anak magang berjam khusus (lib/services/attendance/jam-magang.ts). */
  jamKerja?: { masuk: string; pulang: string; toleransiMenit: number };
  pulangAwalMinutes?: number;
  employeeId: number;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  lateMinutes: number;
  overtimeMinutes: number;
  status: string;
  fullName: string;
  department: string | null;
};
type Summary = {
  totalRows: number;
  late: number;
  absent: number;
  onTime: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
};
type Ref = { id: number; name?: string; fullName?: string };

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Rentang tanggal untuk satu bulan (0-11) atau "all" = satu tahun penuh. */
function rangeFor(year: number, month: number | "all") {
  if (month === "all") return { start: ymd(new Date(year, 0, 1)), end: ymd(new Date(year, 11, 31)) };
  return { start: ymd(new Date(year, month, 1)), end: ymd(new Date(year, month + 1, 0)) };
}

function softChip(color: string): React.CSSProperties {
  return { background: `color-mix(in oklab, ${color} 16%, transparent)`, color };
}

const ABSENCE = new Set(["Izin", "Sakit", "Cuti"]);

/** "izin" = gabungan Izin/Sakit/Cuti; lainnya cocok status persis. */
function filterByStatus(rows: Row[], status: string): Row[] {
  if (!status) return rows;
  if (status === "izin") return rows.filter((r) => ABSENCE.has(r.status));
  return rows.filter((r) => r.status === status);
}

const NOW = new Date();
const YEARS = Array.from({ length: 7 }, (_, i) => NOW.getFullYear() - 5 + i);
const INITIAL_RANGE = rangeFor(NOW.getFullYear(), NOW.getMonth());

export default function AttendanceReportPage() {
  const [month, setMonth] = useState<number | "all">(NOW.getMonth());
  const [year, setYear] = useState(NOW.getFullYear());
  const [startDate, setStartDate] = useState(INITIAL_RANGE.start);
  const [endDate, setEndDate] = useState(INITIAL_RANGE.end);
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [departments, setDepartments] = useState<Ref[]>([]);
  const [employees, setEmployees] = useState<Ref[]>([]);
  const [machines, setMachines] = useState<Ref[]>([]);
  const [machineId, setMachineId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ clockIn: "", clockOut: "" });
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  const reqId = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    const q = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (departmentId) q.set("department_id", departmentId);
    if (employeeId) q.set("employee_id", employeeId);
    if (machineId) q.set("machine_id", machineId);
    try {
      const res = await api<{ rows: Row[]; summary: Summary }>(`/api/attendance/report?${q}`);
      if (id !== reqId.current) return; // respons usang — abaikan
      setRows(filterByStatus(res.rows, statusFilter));
      setSummary(res.summary);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [startDate, endDate, departmentId, employeeId, statusFilter, machineId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    api<Ref[]>("/api/departments").then(setDepartments);
    api<Ref[]>("/api/assessments/employees").then(setEmployees);
    api<Ref[]>("/api/machines").then(setMachines).catch(() => {});
  }, []);
  // Terapkan filter dari URL (mis. dari kartu dashboard karyawan).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const emp = p.get("employee_id");
    const st = p.get("status");
    const sd = p.get("start_date");
    const ed = p.get("end_date");
    if (emp) setEmployeeId(emp);
    if (st) setStatusFilter(st);
    if (sd) setStartDate(sd);
    if (ed) setEndDate(ed);
  }, []);

  const exportUrl = (() => {
    const q = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (departmentId) q.set("department_id", departmentId);
    if (employeeId) q.set("employee_id", employeeId);
    if (machineId) q.set("machine_id", machineId);
    return `/api/attendance/report/export-excel?${q}`;
  })();

  function applyMonth(m: number | "all", y: number) {
    const r = rangeFor(y, m);
    setStartDate(r.start);
    setEndDate(r.end);
  }

  function openEditRow(r: Row) {
    setEditRow(r);
    setEditForm({ clockIn: r.clockIn ?? "", clockOut: r.clockOut ?? "" });
    setEditError("");
  }

  async function saveEdit() {
    if (!editRow) return;
    setSaving(true);
    setEditError("");
    try {
      await api("/api/attendance/manual", {
        method: "POST",
        body: JSON.stringify({
          employeeId: editRow.employeeId,
          date: editRow.date,
          clockIn: editForm.clockIn || null,
          clockOut: editForm.clockOut || null,
        }),
      });
      setEditRow(null);
      load();
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Laporan Absensi</h1>
          <p className="mt-0.5 text-sm text-muted">Rekap kehadiran per bulan atau rentang tanggal.</p>
        </div>
        <a href={exportUrl} className="btn-ghost h-10">
          <IconDownload className="text-[17px]" /> Export Excel
        </a>
      </div>

      <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4 text-sm">
        <label className="space-y-1.5">
          <span className="block font-medium text-muted">Bulan</span>
          <select
            className="input h-10 w-auto"
            value={String(month)}
            onChange={(e) => {
              const v = e.target.value === "all" ? "all" : Number(e.target.value);
              setMonth(v);
              applyMonth(v, year);
            }}
          >
            <option value="all">Semua bulan</option>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block font-medium text-muted">Tahun</span>
          <select
            className="input h-10 w-auto"
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value);
              setYear(y);
              applyMonth(month, y);
            }}
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block font-medium text-muted">Dari</span>
          <input type="date" className="input h-10 w-auto" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="block font-medium text-muted">Sampai</span>
          <input type="date" className="input h-10 w-auto" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="block font-medium text-muted">Departemen</span>
          <select className="input h-10 w-auto" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Semua dept</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        {machines.length > 1 && (
          <label className="space-y-1.5">
            <span className="block font-medium text-muted">Mesin / Cabang</span>
            <select className="input h-10 w-auto" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
              <option value="">Semua mesin</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        <label className="space-y-1.5">
          <span className="block font-medium text-muted">Karyawan</span>
          <select className="input h-10 w-auto" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Semua karyawan</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block font-medium text-muted">Status</span>
          <select className="input h-10 w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua status</option>
            <option value="on_time">Tepat waktu</option>
            <option value="late">Terlambat</option>
            <option value="izin">Izin/Sakit/Cuti</option>
            <option value="absent">Absen</option>
          </select>
        </label>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Tepat waktu" value={summary.onTime} tone="var(--success)" />
          <Stat label="Terlambat" value={`${summary.late} (${summary.totalLateMinutes}m)`} tone="var(--warning)" />
          <Stat label="Absen" value={summary.absent} tone="var(--danger)" />
          <Stat label="Total lembur" value={`${summary.totalOvertimeMinutes}m`} tone="var(--info)" />
        </div>
      )}

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-subtle">
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Karyawan</th>
                <th className="px-4 py-3 font-medium">Masuk</th>
                <th className="px-4 py-3 font-medium">Pulang</th>
                <th className="px-4 py-3 font-medium">Telat</th>
                <th className="px-4 py-3 font-medium">Lembur</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-subtle">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-subtle">Tidak ada data.</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={`${r.employeeId}-${r.date}-${i}`} className="border-t border-border transition hover:bg-surface">
                    <td className="px-4 py-3 tabular text-muted">{r.date}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-fg">{r.fullName}</div>
                      <div className="text-xs text-subtle">{r.department ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 tabular text-muted">{r.clockIn ?? "—"}</td>
                    <td className="px-4 py-3 tabular text-muted">{r.clockOut ?? "—"}</td>
                    <td className="px-4 py-3 tabular text-muted">{r.lateMinutes ? `${r.lateMinutes}m` : "—"}</td>
                    <td className="px-4 py-3 tabular text-muted">{r.overtimeMinutes ? `${r.overtimeMinutes}m` : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.jamKerja && (
                        <div className="tabular mt-0.5 text-[11px] text-subtle">
                          Jam magang {r.jamKerja.masuk.replace(":", ".")}–{r.jamKerja.pulang.replace(":", ".")}
                          {(r.pulangAwalMinutes ?? 0) > 0 && ` · pulang ${r.pulangAwalMinutes}m lebih awal`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEditRow(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-2.5 py-1.5 text-xs text-muted transition hover:border-primary hover:text-primary">
                        <IconPencil className="text-[14px]" /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && (
        <Modal title="Edit Absensi" onClose={() => setEditRow(null)}>
          {editError && <div className="mb-3 rounded-xl px-3 py-2.5 text-sm text-danger" style={softChip("var(--danger)")}>{editError}</div>}
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
              <span className="text-muted">Karyawan: </span>
              <span className="font-medium text-fg">{editRow.fullName}</span>
              <span className="text-subtle"> · {editRow.date}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="font-medium text-muted">Jam masuk</span>
                <input type="time" className="input" value={editForm.clockIn} onChange={(e) => setEditForm({ ...editForm, clockIn: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="font-medium text-muted">Jam pulang</span>
                <input type="time" className="input" value={editForm.clockOut} onChange={(e) => setEditForm({ ...editForm, clockOut: e.target.value })} />
              </label>
            </div>
            <p className="text-xs text-subtle">Status, telat, lembur &amp; shift (mis. longshift) dihitung ulang otomatis dari jam ini.</p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setEditRow(null)} className="btn-ghost">Batal</button>
            <button onClick={saveEdit} disabled={saving || (!editForm.clockIn && !editForm.clockOut)} className="btn-primary disabled:opacity-40">
              <IconCheck className="text-[16px]" /> {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="tabular mt-1 font-display text-2xl font-extrabold" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { v: string; t: string }> = {
    on_time: { v: "var(--success)", t: "Tepat waktu" },
    late: { v: "var(--warning)", t: "Terlambat" },
    absent: { v: "var(--danger)", t: "Absen" },
    longshift: { v: "var(--primary-2)", t: "Long shift" },
    holiday: { v: "var(--fg-subtle)", t: "Libur" },
    Izin: { v: "var(--info)", t: "Izin" },
    Sakit: { v: "var(--info)", t: "Sakit" },
    Cuti: { v: "var(--info)", t: "Cuti" },
  };
  const m = map[status] ?? { v: "var(--fg-subtle)", t: status };
  return <span className="badge" style={softChip(m.v)}>{m.t}</span>;
}
