"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconX, IconTrash } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { LeaveStatusBadge, longDate, soft } from "@/components/portal/ui";
import { DaftarLampiran } from "@/components/portal/LampiranIzin";
import type { LampiranMeta } from "@/components/portal/types";

const urlLampiran = (leaveId: number) => (id: number) => `/api/leave-requests/${leaveId}/lampiran/${id}`;

type Row = {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  startDate: string;
  endDate: string;
  days: number;
  type: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  source: string;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
  lampiran: LampiranMeta[];
};

type Payload = { items: Row[]; total: number; page: number; perPage: number; pending: number };

const FILTERS = [
  { key: "pending", label: "Menunggu" },
  { key: "approved", label: "Disetujui" },
  { key: "rejected", label: "Ditolak" },
  { key: "", label: "Semua" },
] as const;

const SOURCE_LABEL: Record<string, string> = {
  portal: "halaman karyawan",
  link: "form tautan",
  admin: "admin",
};

export default function LeaveRequestsPage() {
  const [filter, setFilter] = useState<string>("pending");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decide, setDecide] = useState<{ row: Row; action: "approve" | "reject" | "cancel" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [lihat, setLihat] = useState<{ row: Row; lampiran: LampiranMeta } | null>(null);

  const ambil = useCallback(
    () => api<Payload>(`/api/leave-requests${filter ? `?status=${filter}` : ""}`),
    [filter]
  );
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await ambil());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
  }, [ambil]);

  useEffect(() => {
    let hidup = true;
    ambil().then(
      (d) => {
        if (!hidup) return;
        setError("");
        setData(d);
      },
      (e) => hidup && setError(e instanceof Error ? e.message : "Gagal memuat data.")
    );
    return () => {
      hidup = false;
    };
  }, [ambil]);

  async function submitDecision() {
    if (!decide) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ applied: number; skipped: string[]; reverted: number }>(
        `/api/leave-requests/${decide.row.id}`,
        { method: "PATCH", body: JSON.stringify({ action: decide.action, note: note || null }) }
      );
      const parts: string[] = [];
      if (decide.action === "approve") {
        parts.push(`${res.applied} hari tercatat sebagai ${decide.row.type}`);
        if (res.skipped.length > 0) {
          parts.push(`${res.skipped.length} hari dilewati karena sudah ada absensi (${res.skipped.join(", ")})`);
        }
      }
      if (decide.action === "reject") parts.push("Pengajuan ditolak");
      if (decide.action === "cancel") {
        parts.push("Pengajuan dibatalkan");
        if (res.reverted > 0) parts.push(`${res.reverted} baris absensi ditarik kembali`);
      }
      setNotice(parts.join(" · "));
      setDecide(null);
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan keputusan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-fg">Izin &amp; Cuti</h1>
        <p className="mt-0.5 text-sm text-muted">
          Pengajuan karyawan menunggu persetujuan Anda. Absensi baru berubah setelah disetujui.
        </p>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-success" style={soft("var(--success)")}>
          <IconCheck className="text-[16px] shrink-0" /> {notice}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-danger" style={soft("var(--danger)")}>
          <IconAlert className="text-[16px] shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              filter === f.key
                ? "bg-gradient-to-r from-primary to-primary-2 text-on-primary shadow-lg shadow-primary/25"
                : "btn-ghost"
            }`}
          >
            {f.label}
            {f.key === "pending" && data && data.pending > 0 && (
              <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-xs text-warning">
                {data.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass h-28 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-subtle">
          Tidak ada pengajuan pada filter ini.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-fg">
                    {r.employeeName}
                    <span className="ml-2 text-xs font-normal text-subtle">{r.employeeCode}</span>
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    <b className="text-fg">{r.type}</b> · {longDate(r.startDate)}
                    {r.days > 1 && ` – ${longDate(r.endDate)} (${r.days} hari)`}
                    {r.department && ` · ${r.department}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.lampiran.length > 0 && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      {r.lampiran.length} lampiran
                    </span>
                  )}
                  <LeaveStatusBadge status={r.status} />
                </div>
              </div>

              <p className="mt-2 rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">
                {r.reason}
              </p>

              <DaftarLampiran
                lampiran={r.lampiran}
                urlDari={urlLampiran(r.id)}
                onBuka={(l) => setLihat({ row: r, lampiran: l })}
              />

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                <span>Diajukan {new Date(r.createdAt).toLocaleString("id-ID")}</span>
                <span>via {SOURCE_LABEL[r.source] ?? r.source}</span>
                {r.decidedBy && <span>Diputus oleh {r.decidedBy}</span>}
              </div>

              {r.decisionNote && (
                <p className="mt-2 text-xs text-muted">
                  <b className="text-fg">Catatan:</b> {r.decisionNote}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => { setDecide({ row: r, action: "approve" }); setNote(""); }}
                      className="btn-primary h-9 text-xs"
                    >
                      <IconCheck className="text-[15px]" /> Setujui
                    </button>
                    <button
                      onClick={() => { setDecide({ row: r, action: "reject" }); setNote(""); }}
                      className="btn-ghost h-9 text-xs"
                    >
                      <IconX className="text-[15px]" /> Tolak
                    </button>
                  </>
                )}
                {r.status === "approved" && (
                  <button
                    onClick={() => { setDecide({ row: r, action: "cancel" }); setNote(""); }}
                    className="btn-ghost h-9 text-xs"
                  >
                    <IconTrash className="text-[15px]" /> Batalkan persetujuan
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {lihat && (
        <Modal title={`Lampiran — ${lihat.row.employeeName}`} size="xl" onClose={() => setLihat(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- lampiran pribadi lewat rute ber-login */}
          <img
            src={urlLampiran(lihat.row.id)(lihat.lampiran.id)}
            alt={`Lampiran: ${lihat.lampiran.nama}`}
            className="mx-auto max-h-[65vh] w-auto rounded-xl border border-border object-contain"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
            <span className="min-w-0 truncate">{lihat.lampiran.nama}</span>
            <a
              href={urlLampiran(lihat.row.id)(lihat.lampiran.id)}
              target="_blank"
              rel="noopener"
              className="btn-ghost h-9 text-xs"
            >
              Buka di tab baru
            </a>
          </div>
        </Modal>
      )}

      {decide && (
        <Modal
          title={
            decide.action === "approve"
              ? "Setujui pengajuan"
              : decide.action === "reject"
                ? "Tolak pengajuan"
                : "Batalkan persetujuan"
          }
          onClose={() => setDecide(null)}
        >
          <p className="text-sm text-muted">
            <b className="text-fg">{decide.row.employeeName}</b> — {decide.row.type},{" "}
            {longDate(decide.row.startDate)}
            {decide.row.days > 1 && ` – ${longDate(decide.row.endDate)} (${decide.row.days} hari)`}.
          </p>

          <p className="mt-3 rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            {decide.action === "approve" &&
              "Tiap tanggal akan dicatat sebagai ketidakhadiran di absensi. Hari yang sudah punya scan mesin dilewati — data absensi asli tidak ditimpa."}
            {decide.action === "reject" && "Absensi tidak diubah sama sekali. Karyawan melihat status “Ditolak” di halamannya."}
            {decide.action === "cancel" &&
              "Baris absensi yang dibuat oleh persetujuan ini akan ditarik kembali. Scan mesin tidak tersentuh."}
          </p>

          <label className="mt-4 block space-y-1.5 text-sm">
            <span className="font-medium text-muted">Catatan untuk karyawan (opsional)</span>
            <textarea
              className="input"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDecide(null)} className="btn-ghost h-10">
              Batal
            </button>
            <button onClick={submitDecision} disabled={busy} className="btn-primary h-10">
              {busy ? "Menyimpan…" : "Konfirmasi"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
