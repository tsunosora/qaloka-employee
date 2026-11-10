"use client";

import { useId, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconCheck, IconCopy, IconLink, IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";
import { tautanPendek, tautanSah } from "@/lib/services/magang/konten";
import { FOKUS, latarWarna, type BriefKonten, type KonsepJson } from "@/components/magang/konten/tipe";

type Tautan = { label: string; url: string };

/** Salin teks ke papan klip + umpan balik singkat. */
export function TombolSalin({ teks, label = "Salin", className = "" }: { teks: string; label?: string; className?: string }) {
  const [hasil, setHasil] = useState<"" | "ok" | "gagal">("");
  async function salin() {
    try {
      await navigator.clipboard.writeText(teks);
      setHasil("ok");
    } catch {
      setHasil("gagal");
    }
    setTimeout(() => setHasil(""), 2000);
  }
  return (
    <button type="button" onClick={salin} disabled={!teks} className={`btn-ghost h-9 px-3 text-xs ${FOKUS} ${className}`}>
      {hasil === "ok" ? <IconCheck className="text-[14px] text-success" aria-hidden="true" /> : <IconCopy className="text-[14px]" aria-hidden="true" />}
      <span role="status">{hasil === "ok" ? "Tersalin" : hasil === "gagal" ? "Gagal menyalin" : label}</span>
    </button>
  );
}

/** Chip tautan ringkas (buka di tab baru). URL kosong → label saja + keterangan. */
export function ChipTautan({ t, kecil = false }: { t: Tautan; kecil?: boolean }) {
  const label = t.label.trim() || (t.url ? tautanPendek(t.url) : "Tautan");
  if (!t.url || !tautanSah(t.url))
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted" title="Tautan belum diisi">
        <IconLink className="text-[12px]" aria-hidden="true" /> {label} <span className="italic">(belum ada tautan)</span>
      </span>
    );
  return (
    <a
      href={t.url}
      target="_blank"
      rel="noopener noreferrer"
      title={t.url}
      className={`inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2.5 ${kecil ? "py-0.5" : "py-1"} text-xs font-medium text-primary underline-offset-2 hover:underline ${FOKUS}`}
    >
      <IconLink className="shrink-0 text-[12px]" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </a>
  );
}

/** Penyunting daftar tautan berlabel (drive, referensi konsep). */
export function EditorTautan({ nilai, onChange, labelTambah, contohLabel }: { nilai: Tautan[]; onChange: (v: Tautan[]) => void; labelTambah: string; contohLabel: string }) {
  const id = useId();
  const ubah = (i: number, p: Partial<Tautan>) => onChange(nilai.map((t, j) => (j === i ? { ...t, ...p } : t)));
  return (
    <div className="space-y-2">
      {nilai.map((t, i) => {
        const salah = !!t.url.trim() && !tautanSah(t.url.trim());
        return (
          <div key={i} className="space-y-1 rounded-xl border border-border p-2">
            <label htmlFor={`${id}-l${i}`} className="text-xs font-semibold text-muted">
              Label
            </label>
            <input id={`${id}-l${i}`} className="input h-9" value={t.label} maxLength={80} placeholder={contohLabel} onChange={(e) => ubah(i, { label: e.target.value })} />
            <label htmlFor={`${id}-u${i}`} className="text-xs font-semibold text-muted">
              Tautan
            </label>
            <div className="flex gap-1.5">
              <input
                id={`${id}-u${i}`}
                className={`input h-9 min-w-0 flex-1 ${salah ? "border-danger" : ""}`}
                type="url"
                inputMode="url"
                value={t.url}
                maxLength={500}
                placeholder="https://…"
                aria-invalid={salah}
                aria-describedby={salah ? `${id}-g${i}` : undefined}
                onChange={(e) => ubah(i, { url: e.target.value })}
              />
              <button type="button" onClick={() => onChange(nilai.filter((_, j) => j !== i))} className={`btn-ghost h-9 w-9 shrink-0 px-0 ${FOKUS}`} aria-label={`Hapus tautan ${t.label || i + 1}`}>
                <IconTrash className="text-[14px]" aria-hidden="true" />
              </button>
            </div>
            {salah && (
              <p id={`${id}-g${i}`} className="text-xs font-medium text-danger">
                Tautan harus diawali http:// atau https://
              </p>
            )}
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...nilai, { label: "", url: "" }])} className={`btn-ghost h-9 px-3 text-xs ${FOKUS}`}>
        <IconPlus className="text-[14px]" aria-hidden="true" /> {labelTambah}
      </button>
    </div>
  );
}

const tautanBeres = (l: Tautan[]) => l.map((t) => ({ label: t.label.trim(), url: t.url.trim() })).filter((t) => t.label || t.url);
const adaSalah = (l: Tautan[]) => l.some((t) => t.url.trim() && !tautanSah(t.url.trim()));

/**
 * Panel kiri "Catatan & Brief" seperti sheet pembina: drive pengumpulan, note, font, preset, referensi per
 * konsep (dari konsep.referensi), caption + hashtag (tombol Salin). Mode baca ↔ mode ubah.
 */
export function PanelBrief({ brief, konsep, onTersimpan }: { brief: BriefKonten; konsep: KonsepJson[]; onTersimpan: () => void }) {
  const id = useId();
  const [ubah, setUbah] = useState(false);
  const [form, setForm] = useState(brief);
  const [refs, setRefs] = useState<Record<number, Tautan[]>>({});
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const [ok, setOk] = useState("");
  const konsepAktif = konsep.filter((k) => k.aktif);

  function mulai() {
    setForm(brief);
    setRefs(Object.fromEntries(konsepAktif.map((k) => [k.id, k.referensi])));
    setGalat("");
    setOk("");
    setUbah(true);
  }

  async function simpan() {
    if (adaSalah(form.drive) || Object.values(refs).some(adaSalah)) return setGalat("Ada tautan yang belum benar (harus http:// atau https://).");
    setBusy(true);
    setGalat("");
    try {
      await api("/api/magang/konten/brief", { method: "PUT", body: JSON.stringify({ ...form, drive: tautanBeres(form.drive) }) });
      for (const k of konsepAktif) {
        const baru = tautanBeres(refs[k.id] ?? []);
        if (JSON.stringify(baru) !== JSON.stringify(k.referensi)) await api(`/api/magang/konten/konsep/${k.id}`, { method: "PATCH", body: JSON.stringify({ referensi: baru }) });
      }
      setUbah(false);
      setOk("Catatan & brief tersimpan.");
      onTersimpan();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const captionLengkap = [brief.caption, brief.hashtag].filter((s) => s.trim()).join("\n\n");
  const judul = (t: string) => <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted">{t}</h3>;

  if (ubah)
    return (
      <section aria-labelledby={`${id}-j`} className="glass space-y-4 rounded-2xl p-4">
        <h2 id={`${id}-j`} className="font-display text-sm font-bold text-fg">
          Ubah catatan & brief
        </h2>
        <div>
          {judul("Drive pengumpulan file")}
          <div className="mt-1.5">
            <EditorTautan nilai={form.drive} onChange={(drive) => setForm({ ...form, drive })} labelTambah="Tambah drive" contohLabel="mis. 1. Drive tim" />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-c`} className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Note
          </label>
          <textarea id={`${id}-c`} className="input mt-1 min-h-20 py-2" maxLength={1000} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
          <p className="mt-0.5 text-xs text-muted">Tampil sebagai pengingat di HP anak pada hari jadwalnya.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <label htmlFor={`${id}-f`} className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Font
            </label>
            <input id={`${id}-f`} className="input mt-1 h-9" maxLength={120} value={form.font} onChange={(e) => setForm({ ...form, font: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${id}-p`} className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Preset style
            </label>
            <input id={`${id}-p`} className="input mt-1 h-9" maxLength={120} value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })} />
          </div>
        </div>
        {konsepAktif.length > 0 && (
          <div className="space-y-3">
            {judul("Referensi konten")}
            {konsepAktif.map((k) => (
              <div key={k.id}>
                <p className="mb-1 text-xs font-semibold text-fg">{k.label}</p>
                <EditorTautan nilai={refs[k.id] ?? []} onChange={(v) => setRefs({ ...refs, [k.id]: v })} labelTambah="Tambah referensi" contohLabel="mis. Contoh video" />
              </div>
            ))}
          </div>
        )}
        <div>
          <label htmlFor={`${id}-cap`} className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Caption (templat)
          </label>
          <textarea id={`${id}-cap`} className="input mt-1 min-h-40 py-2" maxLength={5000} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${id}-h`} className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Hashtag
          </label>
          <textarea id={`${id}-h`} className="input mt-1 min-h-24 py-2" maxLength={2000} value={form.hashtag} onChange={(e) => setForm({ ...form, hashtag: e.target.value })} />
        </div>
        {galat && (
          <p role="alert" className="text-sm font-medium text-danger">
            {galat}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn-primary h-10 px-4 text-sm ${FOKUS}`} disabled={busy} aria-busy={busy} onClick={simpan}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
          <button type="button" className={`btn-ghost h-10 px-4 text-sm ${FOKUS}`} disabled={busy} onClick={() => setUbah(false)}>
            Batal
          </button>
        </div>
      </section>
    );

  return (
    <section aria-labelledby={`${id}-j`} className="glass space-y-4 rounded-2xl p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-j`} className="font-display text-sm font-bold text-fg">
          Catatan & brief
        </h2>
        <button type="button" onClick={mulai} className={`btn-ghost h-9 px-3 text-xs ${FOKUS}`}>
          <IconPencil className="text-[14px]" aria-hidden="true" /> Ubah
        </button>
      </div>
      {ok && (
        <p role="status" className="text-xs font-medium text-success">
          {ok}
        </p>
      )}
      <div className="space-y-1.5">
        {judul("Drive pengumpulan file")}
        {brief.drive.length ? (
          <div className="flex flex-wrap gap-1.5">
            {brief.drive.map((t, i) => (
              <ChipTautan key={i} t={t} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">Belum diisi.</p>
        )}
      </div>
      <div className="space-y-1">
        {judul("Note")}
        <p className="whitespace-pre-wrap text-fg">{brief.catatan || <span className="text-muted">Belum diisi.</span>}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Font</dt>
        <dd className="text-fg">{brief.font || "–"}</dd>
        <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Preset</dt>
        <dd className="text-fg">{brief.preset || "–"}</dd>
      </dl>
      <div className="space-y-2">
        {judul("Referensi konten")}
        {konsepAktif.length === 0 && <p className="text-xs text-muted">Belum ada konsep. Tambahkan di Setelan.</p>}
        {konsepAktif.map((k) => (
          <div key={k.id} className="space-y-1">
            <p className="inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold text-fg" style={latarWarna(k.warna, 35)}>
              {k.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {k.referensi.length ? k.referensi.map((t, i) => <ChipTautan key={i} t={t} kecil />) : <span className="text-xs text-muted">Belum ada referensi.</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          {judul("Caption")}
          <TombolSalin teks={captionLengkap} label="Salin caption" />
        </div>
        {captionLengkap ? (
          <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-fg">{captionLengkap}</p>
        ) : (
          <p className="text-xs text-muted">Belum diisi.</p>
        )}
      </div>
    </section>
  );
}
