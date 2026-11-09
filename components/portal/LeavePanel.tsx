"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconPlus, IconTrash, IconX } from "@/components/ui/icons";
import { kirimForm } from "@/components/reimbursement/ui";
import { Card, Empty, LeaveStatusBadge, longDate, soft } from "./ui";
import type { LampiranMeta, LeaveRequestItem } from "./types";
import {
  DaftarLampiran,
  LAMPIRAN_MAKS_JUMLAH,
  TERIMA_LAMPIRAN,
  PilihLampiran,
  kelompokkanKiriman,
  lepasPratinjau,
  siapkanLampiran,
  tambahKeForm,
  useLepasPratinjau,
  type LampiranBaru,
} from "./LampiranIzin";

const TYPES = ["Izin", "Sakit", "Cuti"] as const;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ajukan izin/sakit/cuti & lihat statusnya (menunggu, disetujui, ditolak). */
export function LeavePanel({ token, ownerQuery = "" }: { token: string; ownerQuery?: string }) {
  const [items, setItems] = useState<LeaveRequestItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]>("Izin");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [lampiran, setLampiran] = useState<LampiranBaru[]>([]);
  const [galatLampiran, setGalatLampiran] = useState<{ id: number; pesan: string } | null>(null);
  const [sibukLampiran, setSibukLampiran] = useState<number | null>(null);
  useLepasPratinjau(lampiran);
  // Mode owner (?owner=1) hanya melihat — tombol ubah lampiran disembunyikan (server juga menolak).
  const bolehUbah = !ownerQuery;
  const base = `/api/public/portal/${token}/leave`;
  const urlLampiran = (leaveId: number) => (id: number) => `${base}/${leaveId}/lampiran/${id}?v=1${ownerQuery}`;

  const ambil = useCallback(
    () =>
      api<{ items: LeaveRequestItem[] }>(`/api/public/portal/${token}/leave?v=1${ownerQuery}`).then((r) => r.items),
    [token, ownerQuery]
  );
  const load = useCallback(async () => setItems(await ambil()), [ambil]);

  useEffect(() => {
    let hidup = true;
    ambil().then(
      (r) => hidup && setItems(r),
      () => hidup && setItems([])
    );
    return () => {
      hidup = false;
    };
  }, [ambil]);

  async function submit() {
    setError("");
    setOk("");
    if (!reason.trim()) return setError("Tulis alasannya dulu.");
    setBusy(true);
    try {
      let pesanOk = "Pengajuan terkirim. Menunggu persetujuan owner.";
      if (lampiran.length === 0) {
        await api(base, {
          method: "POST",
          body: JSON.stringify({ type, startDate, endDate: endDate || null, reason }),
        });
      } else {
        // Kiriman dipecah per ≤9 MB: kelompok pertama ikut pengajuan, sisanya ditambahkan sesudahnya.
        const [pertama, ...lanjut] = kelompokkanKiriman(lampiran);
        const form = new FormData();
        form.set("type", type);
        form.set("startDate", startDate);
        if (endDate) form.set("endDate", endDate);
        form.set("reason", reason);
        tambahKeForm(form, pertama);
        const dibuat = await kirimForm<{ id: number }>(base, form);
        try {
          for (const kel of lanjut) {
            const f = new FormData();
            tambahKeForm(f, kel);
            await kirimForm(`${base}/${dibuat.id}/lampiran`, f);
          }
          pesanOk = `Pengajuan terkirim dengan ${lampiran.length} lampiran. Menunggu persetujuan owner.`;
        } catch (e) {
          const m = e instanceof Error ? e.message : "";
          setGalatLampiran({ id: dibuat.id, pesan: `Sebagian lampiran gagal terkirim${m ? `: ${m}` : "."} Tambahkan lagi di sini.` });
        }
        lepasPratinjau(lampiran);
        setLampiran([]);
      }
      setOk(pesanOk);
      setReason("");
      setEndDate("");
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim pengajuan.");
    } finally {
      setBusy(false);
    }
  }

  /** Tambah lampiran ke pengajuan yang masih menunggu (langsung terkirim). */
  async function tambahLampiran(leaveId: number, files: File[]) {
    setGalatLampiran(null);
    setSibukLampiran(leaveId);
    const siap: LampiranBaru[] = [];
    try {
      for (const f of files) siap.push(await siapkanLampiran(f));
      for (const kel of kelompokkanKiriman(siap)) {
        const f = new FormData();
        tambahKeForm(f, kel);
        await kirimForm(`${base}/${leaveId}/lampiran`, f);
      }
      await load();
    } catch (e) {
      setGalatLampiran({ id: leaveId, pesan: e instanceof Error ? e.message : "Gagal menambah lampiran." });
      await load().catch(() => undefined);
    } finally {
      lepasPratinjau(siap);
      setSibukLampiran(null);
    }
  }

  async function hapusLampiran(leaveId: number, l: LampiranMeta) {
    if (!window.confirm(`Hapus lampiran "${l.nama}"?`)) return;
    setGalatLampiran(null);
    setSibukLampiran(l.id);
    try {
      await api(`${base}/${leaveId}/lampiran/${l.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setGalatLampiran({ id: leaveId, pesan: e instanceof Error ? e.message : "Gagal menghapus lampiran." });
    } finally {
      setSibukLampiran(null);
    }
  }

  async function cancel(id: number) {
    setError("");
    try {
      await api(`/api/public/portal/${token}/leave/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membatalkan.");
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="Pengajuan izin"
        action={
          <button
            onClick={() => {
              setOpen((o) => !o);
              setOk("");
            }}
            className="btn-ghost h-9 text-xs"
          >
            {open ? <IconX className="text-[15px]" /> : <IconPlus className="text-[15px]" />} {open ? "Tutup" : "Ajukan"}
          </button>
        }
      >
        {ok && (
          <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-success" style={soft("var(--success)")}>
            <IconCheck className="text-[16px] shrink-0" /> {ok}
          </div>
        )}
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
            <IconAlert className="text-[16px] shrink-0" /> {error}
          </div>
        )}

        {open ? (
          <div className="space-y-3">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-muted">Jenis</span>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                      type === t
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border-strong text-muted hover:bg-surface-2"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-muted">Tanggal mulai *</span>
                <input
                  type="date"
                  className="input h-11"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-muted">Sampai (opsional)</span>
                <input
                  type="date"
                  className="input h-11"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-muted">Alasan *</span>
              <textarea
                className="input"
                rows={3}
                maxLength={1000}
                placeholder="Contoh: demam, perlu istirahat satu hari."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>

            <PilihLampiran nilai={lampiran} onUbah={setLampiran} disabled={busy} />

            <button onClick={submit} disabled={busy} className="btn-primary h-11 w-full">
              {busy ? (lampiran.length > 0 ? "Mengirim pengajuan & lampiran…" : "Mengirim…") : "Kirim Pengajuan"}
            </button>
            <p className="text-center text-xs text-subtle">
              Absensi Anda baru berubah setelah owner menyetujui pengajuan ini.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Tekan <b className="text-fg">Ajukan</b> untuk mengirim izin, sakit, atau cuti. Pengajuan
            masuk ke dashboard owner untuk disetujui.
          </p>
        )}
      </Card>

      <Card title="Riwayat pengajuan">
        {items === null ? (
          <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
        ) : items.length === 0 ? (
          <Empty>Belum pernah mengajukan izin.</Empty>
        ) : (
          <ul className="space-y-2.5">
            {items.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">
                    {r.type} · {longDate(r.startDate)}
                    {r.days > 1 && ` – ${longDate(r.endDate)} (${r.days} hari)`}
                  </span>
                  <LeaveStatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-muted">{r.reason}</p>
                <DaftarLampiran
                  lampiran={r.lampiran ?? []}
                  urlDari={urlLampiran(r.id)}
                  onHapus={bolehUbah && r.status === "pending" ? (l) => hapusLampiran(r.id, l) : undefined}
                  sibuk={sibukLampiran}
                />
                {bolehUbah && r.status === "pending" && (r.lampiran?.length ?? 0) < LAMPIRAN_MAKS_JUMLAH && (
                  <TambahLampiran
                    sisa={LAMPIRAN_MAKS_JUMLAH - (r.lampiran?.length ?? 0)}
                    sibuk={sibukLampiran === r.id}
                    onPilih={(files) => tambahLampiran(r.id, files)}
                  />
                )}
                {galatLampiran?.id === r.id && (
                  <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-danger">
                    <IconAlert className="mt-px shrink-0 text-[14px]" /> {galatLampiran.pesan}
                  </p>
                )}
                {r.decisionNote && (
                  <p className="mt-1.5 rounded-lg border border-border p-2 text-xs text-muted">
                    <b className="text-fg">Catatan owner:</b> {r.decisionNote}
                  </p>
                )}
                {r.status === "pending" && (
                  <button
                    onClick={() => cancel(r.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"
                  >
                    <IconTrash className="text-[13px]" /> Batalkan pengajuan
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Tombol kecil "Tambah lampiran" di riwayat (pengajuan yang masih menunggu). */
function TambahLampiran({ sisa, sibuk, onPilih }: { sisa: number; sibuk: boolean; onPilih: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={TERIMA_LAMPIRAN}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = [...(e.target.files ?? [])].slice(0, sisa);
          e.target.value = "";
          if (f.length) onPilih(f);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={sibuk}
        className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-60"
      >
        <IconPlus className="text-[13px]" /> {sibuk ? "Mengirim lampiran…" : `Tambah lampiran (foto/PDF, sisa ${sisa})`}
      </button>
    </>
  );
}
