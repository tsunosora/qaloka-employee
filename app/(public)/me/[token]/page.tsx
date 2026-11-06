"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import {
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconLogout,
  IconSettings,
} from "@/components/ui/icons";
import { PinGate } from "@/components/portal/PinGate";
import { OverviewPanel } from "@/components/portal/OverviewPanel";
import { AttendancePanel } from "@/components/portal/AttendancePanel";
import { AssessmentPanel } from "@/components/portal/AssessmentPanel";
import { LeavePanel } from "@/components/portal/LeavePanel";
import { PointsPanel } from "@/components/portal/PointsPanel";
import { ChangePinForm } from "@/components/portal/ChangePinForm";
import { LemburPanel } from "@/components/portal/LemburPanel";
import { ReimbursementPanel } from "@/components/portal/ReimbursementPanel";
import { KunjunganPanel } from "@/components/portal/KunjunganPanel";
import { TimesheetPanel } from "@/components/portal/TimesheetPanel";
import { MagangPanel } from "@/components/portal/MagangPanel";
import { soft } from "@/components/portal/ui";
import type { Overview, PortalState } from "@/components/portal/types";

// `fitur` = kode lisensi yang harus ada supaya tab tampil (lib/services/portal/keadaan.ts).
// `bulanan` = tab memakai pemilih bulan di atas; yang tidak punya rentangnya sendiri.
// `magang` = hanya tampil untuk peserta magang aktif (state.magang).
const TABS: readonly { key: string; label: string; fitur?: string; bulanan?: boolean; magang?: boolean }[] = [
  { key: "magang", label: "Magang", fitur: "hr.assessment", magang: true },
  { key: "overview", label: "Ringkasan", bulanan: true },
  { key: "attendance", label: "Absensi", bulanan: true },
  { key: "assessment", label: "Penilaian", bulanan: true },
  { key: "points", label: "Poin", bulanan: true },
  { key: "leave", label: "Izin" },
  { key: "lembur", label: "Lembur", fitur: "hr.overtime" },
  { key: "kunjungan", label: "Kunjungan", fitur: "hr.visits" },
  { key: "reimbursement", label: "Klaim", fitur: "hr.reimbursement" },
  { key: "timesheet", label: "Timesheet", fitur: "hr.timesheet" },
];
type TabKey = string;

function currentMonth(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function EmployeePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  // Mode owner harus diminta tegas lewat ?owner=1 (tombol di Direktori menambahkannya).
  // Tanpa itu, halaman ini berperilaku persis seperti yang dilihat karyawan.
  const ownerQuery =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("owner") === "1"
      ? "&owner=1"
      : "";

  const [state, setState] = useState<PortalState | null>(null);
  // Pesan bila tautan tidak bisa dibuka (null = tidak ada galat). Pendaftar magang yang belum
  // disetujui mendapat pesan dari server ("menunggu persetujuan"), bukan pesan umum.
  const [invalid, setInvalid] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [{ year, month }, setPeriod] = useState(currentMonth);
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [showPinForm, setShowPinForm] = useState(false);
  // Deret tab lebih lebar dari layar HP: tab yang aktif digulir masuk ke pandangan. Yang disentuh
  // cuma scrollLeft deret itu — scrollIntoView ikut menggulir seluruh halaman.
  const deretTab = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = deretTab.current;
    const aktif = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (!nav || !aktif) return;
    const kiri = aktif.offsetLeft - nav.offsetLeft;
    if (kiri < nav.scrollLeft || kiri + aktif.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollLeft = Math.max(0, kiri - (nav.clientWidth - aktif.offsetWidth) / 2);
    }
  }, [tab, state?.authenticated]);

  const loadState = useCallback(async () => {
    try {
      const s = await api<PortalState>(`/api/public/portal/${token}?v=1${ownerQuery}`);
      setState(s);
      // Anak magang membuka halaman ini terutama untuk pos & tugas mingguannya.
      if (s.magang && s.fitur?.["hr.assessment"] !== false) setTab((t) => (t === "overview" ? "magang" : t));
    } catch (e) {
      setInvalid(e instanceof Error && e.message ? e.message : "Tautan tidak valid atau karyawan sudah tidak aktif.");
    }
  }, [token, ownerQuery]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Data periode hanya ditarik setelah lolos PIN.
  useEffect(() => {
    if (!state?.authenticated) return;
    setData(null);
    setLoadError("");
    api<Overview>(`/api/public/portal/${token}/overview?year=${year}&month=${month}${ownerQuery}`)
      .then(setData)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Gagal memuat data."));
  }, [token, state?.authenticated, year, month, ownerQuery]);

  function shiftMonth(delta: number) {
    setPeriod(({ year: y, month: m }) => {
      const d = new Date(y, m - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }

  async function logout() {
    await api(`/api/public/portal/${token}/session`, { method: "DELETE" }).catch(() => {});
    setData(null);
    setState((s) => (s ? { ...s, authenticated: false } : s));
  }

  if (invalid) {
    return (
      <Centered>
        <div className="glass-2 relative z-10 w-full max-w-md rounded-3xl p-8 text-center shadow-2xl">
          <span
            className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-danger"
            style={soft("var(--danger)")}
          >
            <IconAlert className="text-[26px]" />
          </span>
          <p className="text-muted">{invalid}</p>
        </div>
      </Centered>
    );
  }

  if (!state) {
    return (
      <Centered>
        <div className="relative z-10 h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-primary" />
      </Centered>
    );
  }

  if (!state.authenticated) {
    return (
      <Centered>
        <PinGate
          token={token}
          employee={state.employee}
          pinSet={state.pinSet}
          posproPin={state.posproPin}
          onSuccess={() => setState({ ...state, authenticated: true })}
        />
      </Centered>
    );
  }

  const monthValue = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <main className="ambient relative min-h-screen bg-bg">
      <div className="relative z-10 mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <header className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-2 font-display text-lg font-extrabold text-on-primary shadow-lg shadow-primary/30">
            {state.employee.fullName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold text-fg">
              {state.employee.fullName}
            </h1>
            <p className="truncate text-xs text-muted">
              {[state.employee.position, state.employee.department].filter(Boolean).join(" · ") ||
                "Karyawan"}
            </p>
          </div>
          {!state.asManager && (
            <>
              <button
                onClick={() => setShowPinForm((v) => !v)}
                className="btn-ghost h-9 px-3 text-xs"
                aria-label="Ganti PIN"
              >
                <IconSettings className="text-[15px]" /> <span className="hidden sm:inline">PIN</span>
              </button>
              <button onClick={logout} className="btn-ghost h-9 px-3 text-xs" aria-label="Keluar">
                <IconLogout className="text-[15px]" /> <span className="hidden sm:inline">Keluar</span>
              </button>
            </>
          )}
        </header>

        {state.asManager && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm"
            style={{ background: "color-mix(in oklab, var(--info) 14%, transparent)" }}
          >
            <IconAlert className="text-[16px] shrink-0 text-info" />
            <span className="text-fg">
              Mode owner — Anda melihat halaman milik <b>{state.employee.fullName}</b> tanpa PIN.
            </span>
            <a href="/employees" className="ml-auto text-xs font-semibold text-info hover:underline">
              Kembali ke Direktori
            </a>
          </div>
        )}

        {showPinForm && <ChangePinForm token={token} onDone={() => setShowPinForm(false)} />}

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab di barisnya sendiri: kalau berbagi baris dengan pemilih bulan, di HP cuma satu tab yang terlihat. */}
          <nav ref={deretTab} className="glass flex w-full gap-1 overflow-x-auto rounded-2xl p-1">
            {TABS.filter((t) => (!t.fitur || state.fitur?.[t.fitur] !== false) && (!t.magang || state.magang)).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                  tab === t.key
                    ? "bg-gradient-to-r from-primary to-primary-2 text-on-primary shadow-lg shadow-primary/25"
                    : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {TABS.find((t) => t.key === tab)?.bulanan && (
            <div className="glass ml-auto flex items-center gap-1 rounded-2xl p-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
                aria-label="Bulan sebelumnya"
              >
                <IconChevronLeft className="text-[16px]" />
              </button>
              <input
                type="month"
                className="input h-8 w-[9.5rem] border-0 bg-transparent text-xs"
                value={monthValue}
                onChange={(e) => {
                  const [y, m] = e.target.value.split("-").map(Number);
                  if (y && m) setPeriod({ year: y, month: m });
                }}
              />
              <button
                onClick={() => shiftMonth(1)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
                aria-label="Bulan berikutnya"
              >
                <IconChevronRight className="text-[16px]" />
              </button>
            </div>
          )}
        </div>

        {tab === "magang" && state.magang ? (
          <MagangPanel token={token} ownerQuery={ownerQuery} />
        ) : tab === "leave" ? (
          <LeavePanel token={token} ownerQuery={ownerQuery} />
        ) : tab === "lembur" ? (
          <LemburPanel token={token} ownerQuery={ownerQuery} />
        ) : tab === "kunjungan" ? (
          <KunjunganPanel token={token} ownerQuery={ownerQuery} />
        ) : tab === "reimbursement" ? (
          <ReimbursementPanel token={token} ownerQuery={ownerQuery} />
        ) : tab === "timesheet" ? (
          <TimesheetPanel token={token} ownerQuery={ownerQuery} />
        ) : tab === "points" ? (
          <PointsPanel token={token} year={year} month={month} ownerQuery={ownerQuery} />
        ) : loadError ? (
          <div
            className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-danger"
            style={soft("var(--danger)")}
          >
            <IconAlert className="text-[16px] shrink-0" /> {loadError}
          </div>
        ) : !data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass h-24 animate-pulse rounded-2xl" />
              ))}
            </div>
            <div className="glass h-64 animate-pulse rounded-2xl" />
          </div>
        ) : tab === "overview" ? (
          <OverviewPanel data={data} />
        ) : tab === "attendance" ? (
          <AttendancePanel data={data} />
        ) : (
          <AssessmentPanel data={data} />
        )}

        <p className="pb-2 text-center text-xs text-subtle">
          Qaloka Employee · halaman pribadi. Jangan bagikan tautan &amp; PIN ini.
        </p>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="ambient relative flex min-h-screen items-center justify-center bg-bg p-4">
      {children}
    </main>
  );
}
