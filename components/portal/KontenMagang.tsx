"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api, errorMessageFrom } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconChevronDown, IconClock, IconCopy, IconLink } from "@/components/ui/icons";
import { Card, soft } from "@/components/portal/ui";
import { FOKUS, latarWarna, titikWarna } from "@/components/magang/konten/tipe";
import { ChipPlatform } from "@/components/magang/konten/IkonPlatform";
import { namaTanggal, tautanPendek, tautanSah } from "@/lib/services/magang/konten";
import type { BarisAnakJson } from "@/lib/services/magang/konten-db";
import type { BriefKonten } from "@/lib/validators/magang-konten";

type Pilihan = { id: number; nama: string; warna: string };
/** Brief satu platform di HP (referensi khusus platform sudah dilebur ke baris.konsep.referensi oleh server). */
type BriefAnak = Omit<BriefKonten, "referensi">;
type Data =
  | { peserta: false }
  | { peserta: true; hariIni: string; kode: number | null; grup: string[]; brief: Record<string, BriefAnak>; pilihanStatus: Pilihan[]; baris: BarisAnakJson[] };

const BRIEF_KOSONG: BriefAnak = { drive: [], catatan: "", font: "", preset: "", caption: "", hashtag: "" };

const MAKS_DAFTAR = 6;

/**
 * Jadwal konten di tab Magang anak: konten hari ini (brief + formulir judul/link/status), lalu daftar
 * berikutnya & sebelumnya (satu terbuka sekaligus). Mode owner (bolehKirim=false) hanya melihat.
 */
export function KontenMagang({ token, q, bolehKirim }: { token: string; q: string; bolehKirim: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<number | null>(null);
  const [lihatLama, setLihatLama] = useState(false);
  const [tersimpan, setTersimpan] = useState<number | null>(null);
  const url = `/api/public/portal/${token}/magang/konten`;

  const ambil = useCallback(() => api<Data>(`${url}${q}`), [url, q]);
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat jadwal konten.");
  const muat = () => ambil().then(setData, gagal);
  useEffect(() => {
    let hidup = true;
    ambil().then(
      (d) => hidup && setData(d),
      (e) => hidup && gagal(e)
    );
    return () => {
      hidup = false;
    };
  }, [ambil]);

  if (galat)
    return (
      <p className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-danger" style={soft("var(--danger)")}>
        <IconAlert className="shrink-0" /> {galat}
      </p>
    );
  if (!data) return <div className="glass h-40 animate-pulse rounded-2xl" />;
  if (!data.peserta) return null;

  const hari = data.hariIni;
  const hariIni = data.baris.filter((b) => b.tanggal === hari);
  const semuaBerikut = data.baris.filter((b) => b.tanggal > hari);
  const berikut = semuaBerikut.slice(0, MAKS_DAFTAR);
  const lama = data.baris
    .filter((b) => b.tanggal < hari)
    .reverse()
    .slice(0, MAKS_DAFTAR);
  const ganti = (baru: BarisAnakJson) => {
    setData((d) => (d && d.peserta ? { ...d, baris: d.baris.map((b) => (b.id === baru.id ? baru : b)) } : d));
    setTersimpan(baru.id);
  };
  const briefDari = (b: BarisAnakJson) => data.brief[String(b.platform.id)] ?? BRIEF_KOSONG;
  const detail = (b: BarisAnakJson) => (
    <Detail
      baris={b}
      brief={briefDari(b)}
      pilihan={data.pilihanStatus}
      bolehKirim={bolehKirim}
      url={url}
      q={q}
      tersimpan={tersimpan === b.id}
      onTersimpan={ganti}
      onBasi={muat}
    />
  );
  const item = (b: BarisAnakJson) => (
    <ItemBaris
      key={b.id}
      baris={b}
      terbuka={buka === b.id}
      onToggle={() => {
        setBuka(buka === b.id ? null : b.id);
        setTersimpan(null);
      }}
    >
      {detail(b)}
    </ItemBaris>
  );

  return (
    <Card
      title="Jadwal Konten"
      action={
        (data.kode != null || data.grup.length > 0) && (
          <span className="text-right text-xs text-muted">
            {data.kode != null && <b className="tabular font-semibold text-fg">Kode kamu: {data.kode}</b>}
            {data.grup.length > 0 && <span className="block">{data.grup.join(", ")}</span>}
          </span>
        )
      }
    >
      {data.baris.length === 0 ? (
        <p className="text-sm text-muted">Belum ada jadwal konten untukmu.</p>
      ) : (
        <div className="space-y-5">
          {hariIni.length > 0 ? (
            <section className="rounded-xl border border-primary p-3" style={soft("var(--primary)", 8)} aria-labelledby="konten-hari-ini">
              <h3 id="konten-hari-ini" className="font-display text-base font-bold text-fg">
                Konten hari ini
              </h3>
              <p className="mt-1 flex items-start gap-2 text-sm text-fg">
                <IconClock className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Hari ini jadwal kontenmu untuk {[...new Set(hariIni.map((b) => b.platform.nama))].join(" & ")} —{" "}
                  {akhiriTitik(briefDari(hariIni[0]).catatan || "absen di Xposer untuk brief konten")}
                </span>
              </p>
              <div className="mt-3 space-y-4 divide-y divide-border">
                {hariIni.map((b) => (
                  <div key={b.id} className="pt-3 first:pt-0">
                    {detail(b)}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="text-sm text-muted">
              <p>Hari ini tidak ada jadwal konten untukmu.</p>
              {semuaBerikut[0] && (
                <p className="mt-1">
                  Jadwal berikutnya: <b className="text-fg">{namaTanggal(semuaBerikut[0].tanggal)}</b> — {semuaBerikut[0].konsep.label} ({semuaBerikut[0].platform.nama})
                </p>
              )}
            </div>
          )}

          {berikut.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Berikutnya</h3>
              <ul className="mt-2 space-y-1.5">{berikut.map(item)}</ul>
            </div>
          )}

          {lama.length > 0 && (
            <div className="border-t border-border pt-3">
              <button
                type="button"
                aria-expanded={lihatLama}
                aria-controls="konten-sebelumnya"
                onClick={() => setLihatLama(!lihatLama)}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left text-xs font-semibold uppercase tracking-wide text-muted hover:text-fg ${FOKUS}`}
              >
                Sebelumnya ({lama.length})
                <IconChevronDown className={`shrink-0 text-[18px] transition-transform ${lihatLama ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {lihatLama && (
                <ul id="konten-sebelumnya" className="mt-1 space-y-1.5">
                  {lama.map(item)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ChipKonsep({ konsep }: { konsep: BarisAnakJson["konsep"] }) {
  return (
    <span className="badge shrink-0 border border-border text-fg" style={latarWarna(konsep.warna, 30)}>
      {konsep.label}
    </span>
  );
}

function ChipStatus({ status }: { status: BarisAnakJson["status"] }) {
  return (
    <span className="badge shrink-0 border border-border text-fg">
      {status.final ? (
        <IconCheck className="text-[12px] text-success" aria-hidden="true" />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full" style={titikWarna(status.warna)} aria-hidden="true" />
      )}
      {status.nama}
    </span>
  );
}

function ItemBaris({ baris, terbuka, onToggle, children }: { baris: BarisAnakJson; terbuka: boolean; onToggle: () => void; children: React.ReactNode }) {
  const idDetail = `konten-baris-${baris.id}`;
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (terbuka) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [terbuka]);
  return (
    <li ref={ref} className={`rounded-xl border border-border ${terbuka ? "bg-surface-2" : ""}`}>
      <button
        type="button"
        aria-expanded={terbuka}
        aria-controls={idDetail}
        onClick={onToggle}
        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-2 ${FOKUS}`}
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-medium text-fg">{namaTanggal(baris.tanggal)}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <ChipPlatform p={baris.platform} kecil className="shrink-0" />
            <ChipKonsep konsep={baris.konsep} />
            {baris.milik !== "kamu" && <span className="badge shrink-0 border border-border text-fg">{baris.milik}</span>}
            <ChipStatus status={baris.status} />
            {baris.usulan && <span className="badge shrink-0 border border-dashed border-border-strong text-muted">Usulan — bisa berubah</span>}
          </span>
        </span>
        <IconChevronDown className={`shrink-0 text-[18px] text-muted transition-transform ${terbuka ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {terbuka && (
        <div id={idDetail} className="px-3 pb-3">
          {children}
        </div>
      )}
    </li>
  );
}

function Tautan({ url, label }: { url: string; label?: string }) {
  if (!tautanSah(url)) return <span className="break-all text-sm text-fg">{label || url}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-primary hover:bg-surface-2 ${FOKUS}`}
    >
      <IconLink className="shrink-0" aria-hidden="true" />
      <span className="truncate">{label || tautanPendek(url)}</span>
    </a>
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Detail({
  baris: b,
  brief,
  pilihan,
  bolehKirim,
  url,
  q,
  tersimpan,
  onTersimpan,
  onBasi,
}: {
  baris: BarisAnakJson;
  brief: BriefAnak;
  pilihan: Pilihan[];
  bolehKirim: boolean;
  url: string;
  q: string;
  tersimpan: boolean;
  onTersimpan: (b: BarisAnakJson) => void;
  onBasi: () => void;
}) {
  const caption = b.caption?.trim() || [brief.caption, brief.hashtag].filter(Boolean).join("\n\n");
  const referensi = b.konsep.referensi.filter((r) => r.url);

  return (
    <div className="space-y-3 pt-1 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-muted">Platform</span>
        <ChipPlatform p={b.platform} className="shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ChipKonsep konsep={b.konsep} />
        <span className="badge shrink-0 border border-border text-fg">{b.milik === "kamu" ? "Kamu" : b.milik}</span>
        <ChipStatus status={b.status} />
        {b.usulan && <span className="badge shrink-0 border border-dashed border-border-strong text-muted">Usulan — bisa berubah</span>}
      </div>

      {b.catatan && (
        <div className="rounded-xl border-l-4 border-primary px-3 py-2" style={soft("var(--primary)", 10)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Catatan pembina</p>
          <p className="mt-0.5 whitespace-pre-wrap text-fg">{b.catatan}</p>
        </div>
      )}

      {(referensi.length > 0 || b.ref) && (
        <Baris label="Referensi">
          <div className="flex flex-wrap gap-2">
            {referensi.map((r, i) => (
              <Tautan key={i} url={r.url} label={r.label} />
            ))}
            {b.ref && <Tautan url={b.ref} label="Referensi khusus" />}
          </div>
        </Baris>
      )}

      {(brief.font || brief.preset) && (
        <dl className="grid grid-cols-2 gap-3">
          {brief.font && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Font</dt>
              <dd className="mt-0.5 text-fg">{brief.font}</dd>
            </div>
          )}
          {brief.preset && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Preset</dt>
              <dd className="mt-0.5 text-fg">{brief.preset}</dd>
            </div>
          )}
        </dl>
      )}

      {brief.drive.length > 0 && (
        <Baris label="Drive">
          <ul className="flex flex-wrap gap-2">
            {brief.drive.map((d, i) => (
              <li key={i}>
                {d.url ? (
                  <Tautan url={d.url} label={d.label} />
                ) : (
                  <span className="text-fg">
                    {d.label} <span className="text-muted">(tautan belum diisi pembina)</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Baris>
      )}

      {caption && <SalinCaption teks={caption} />}

      {b.status.final ? (
        <>
          <p className="flex items-center gap-2 rounded-xl px-3 py-2.5 font-semibold text-success" style={soft("var(--success)", 14)}>
            <IconCheck className="shrink-0" aria-hidden="true" /> Divalidasi pembina
          </p>
          <IsianBaca baris={b} />
        </>
      ) : bolehKirim ? (
        <>
          <p role="status" className={tersimpan ? "flex items-center gap-2 rounded-xl px-3 py-2 font-semibold text-success" : "sr-only"} style={tersimpan ? soft("var(--success)") : undefined}>
            {tersimpan && (
              <>
                <IconCheck className="shrink-0" aria-hidden="true" /> Tersimpan.
              </>
            )}
          </p>
          <FormKonten key={`${b.id}-${b.status.id}`} baris={b} pilihan={pilihan} url={url} q={q} onTersimpan={onTersimpan} onBasi={onBasi} />
        </>
      ) : (
        <>
          <IsianBaca baris={b} />
          <p className="text-xs text-muted">Mode owner — hanya anaknya yang bisa mengisi.</p>
        </>
      )}
    </div>
  );
}

function SalinCaption({ teks }: { teks: string }) {
  const [hasil, setHasil] = useState<"" | "ok" | "gagal">("");
  const id = useId();
  async function salin() {
    try {
      await navigator.clipboard.writeText(teks);
      setHasil("ok");
    } catch {
      setHasil("gagal");
    }
  }
  return (
    <div>
      <p id={id} className="text-xs font-semibold uppercase tracking-wide text-muted">
        Caption
      </p>
      <pre
        tabIndex={0}
        aria-labelledby={id}
        className={`mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3 font-sans text-sm text-fg ${FOKUS}`}
      >
        {teks}
      </pre>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={salin} className={`btn-ghost h-11 gap-2 text-sm ${FOKUS}`}>
          <IconCopy className="shrink-0" aria-hidden="true" /> Salin caption
        </button>
        <span role="status" className={`text-xs font-semibold ${hasil === "gagal" ? "text-danger" : "text-success"}`}>
          {hasil === "ok" ? "Tersalin" : hasil === "gagal" ? "Gagal menyalin — tekan lama teksnya lalu salin manual." : ""}
        </span>
      </div>
    </div>
  );
}

function IsianBaca({ baris: b }: { baris: BarisAnakJson }) {
  if (!b.judul && !b.linkFootage && !b.linkEkspor) return <p className="text-xs text-muted">Belum ada isian.</p>;
  return (
    <div className="space-y-3">
      {b.judul && (
        <Baris label="Judul postingan">
          <p className="text-fg">{b.judul}</p>
        </Baris>
      )}
      {b.linkFootage && (
        <Baris label="Folder footage">
          <Tautan url={b.linkFootage} />
        </Baris>
      )}
      {b.linkEkspor && (
        <Baris label="Ekspor konten">
          <Tautan url={b.linkEkspor} />
        </Baris>
      )}
    </div>
  );
}

type Medan = "judul" | "linkFootage" | "linkEkspor" | "statusId";
type GalatForm = Partial<Record<Medan, string>> & { umum?: string };

function FormKonten({
  baris: b,
  pilihan,
  url,
  q,
  onTersimpan,
  onBasi,
}: {
  baris: BarisAnakJson;
  pilihan: Pilihan[];
  url: string;
  q: string;
  onTersimpan: (b: BarisAnakJson) => void;
  onBasi: () => void;
}) {
  const id = useId();
  const [judul, setJudul] = useState(b.judul ?? "");
  const [footage, setFootage] = useState(b.linkFootage ?? "");
  const [ekspor, setEkspor] = useState(b.linkEkspor ?? "");
  const [statusId, setStatusId] = useState(b.status.id);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState<GalatForm>({});
  const refFootage = useRef<HTMLInputElement>(null);
  const refEkspor = useRef<HTMLInputElement>(null);
  const statusLain = !pilihan.some((p) => p.id === b.status.id);
  const lepas = (k: Medan) =>
    setGalat((g) => {
      const r = { ...g };
      delete r[k];
      return r;
    });

  async function simpan() {
    const dini: GalatForm = {};
    const pesanTautan = "Tautan harus diawali http:// atau https://";
    if (footage.trim() && !tautanSah(footage)) dini.linkFootage = pesanTautan;
    if (ekspor.trim() && !tautanSah(ekspor)) dini.linkEkspor = pesanTautan;
    setGalat(dini);
    if (dini.linkFootage) return refFootage.current?.focus();
    if (dini.linkEkspor) return refEkspor.current?.focus();

    setBusy(true);
    try {
      const isi: Record<string, unknown> = { judul: judul.trim() || null, linkFootage: footage.trim() || null, linkEkspor: ekspor.trim() || null };
      if (statusId !== b.status.id) isi.statusId = statusId;
      const res = await fetch(`${url}/${b.id}${q}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isi) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const pesan = errorMessageFrom(body, res.status);
        if (res.status === 422) {
          const fe = (body?.errors?.fieldErrors ?? {}) as Partial<Record<string, string[]>>;
          const m: GalatForm = {};
          for (const k of ["judul", "linkFootage", "linkEkspor", "statusId"] as const) if (fe[k]?.[0]) m[k] = fe[k]![0];
          setGalat(Object.keys(m).length ? m : { umum: pesan });
        } else {
          setGalat({ umum: pesan });
          if (res.status === 409 || res.status === 404) onBasi();
        }
        return;
      }
      onTersimpan(body as BarisAnakJson);
    } catch {
      setGalat({ umum: "Gagal menyimpan. Periksa sinyal lalu coba lagi." });
    } finally {
      setBusy(false);
    }
  }

  const medanTautan = (kunci: "linkFootage" | "linkEkspor", label: string, nilai: string, ubah: (v: string) => void, ref: React.RefObject<HTMLInputElement | null>) => (
    <div>
      <label htmlFor={`${id}-${kunci}`} className="text-sm font-semibold text-fg">
        {label}
      </label>
      <input
        ref={ref}
        id={`${id}-${kunci}`}
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://…"
        maxLength={500}
        value={nilai}
        onChange={(e) => {
          ubah(e.target.value);
          lepas(kunci);
        }}
        aria-invalid={!!galat[kunci]}
        aria-describedby={galat[kunci] ? `${id}-${kunci}-galat` : undefined}
        className={`input mt-1.5 h-11 ${galat[kunci] ? "border-danger" : ""}`}
      />
      <Galat id={`${id}-${kunci}-galat`} pesan={galat[kunci]} />
    </div>
  );

  return (
    <div className="space-y-4 border-t border-border pt-3">
      <div>
        <label htmlFor={`${id}-judul`} className="text-sm font-semibold text-fg">
          Judul postingan
        </label>
        <input
          id={`${id}-judul`}
          type="text"
          maxLength={200}
          value={judul}
          onChange={(e) => {
            setJudul(e.target.value);
            lepas("judul");
          }}
          aria-invalid={!!galat.judul}
          aria-describedby={galat.judul ? `${id}-judul-galat` : undefined}
          className={`input mt-1.5 h-11 ${galat.judul ? "border-danger" : ""}`}
        />
        <Galat id={`${id}-judul-galat`} pesan={galat.judul} />
      </div>
      {medanTautan("linkFootage", "Link folder footage", footage, setFootage, refFootage)}
      {medanTautan("linkEkspor", "Link hasil kerja (ekspor konten)", ekspor, setEkspor, refEkspor)}
      <div>
        <label htmlFor={`${id}-status`} className="text-sm font-semibold text-fg">
          Status
        </label>
        <select
          id={`${id}-status`}
          value={statusId}
          onChange={(e) => {
            setStatusId(Number(e.target.value));
            lepas("statusId");
          }}
          aria-invalid={!!galat.statusId}
          aria-describedby={galat.statusId ? `${id}-status-galat` : undefined}
          className={`input mt-1.5 h-11 ${galat.statusId ? "border-danger" : ""}`}
        >
          {statusLain && (
            <option value={b.status.id} disabled>
              {b.status.nama} (saat ini)
            </option>
          )}
          {pilihan.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
            </option>
          ))}
        </select>
        <Galat id={`${id}-status-galat`} pesan={galat.statusId} />
      </div>

      {galat.umum && (
        <p role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
          <IconAlert className="shrink-0" aria-hidden="true" /> {galat.umum}
        </p>
      )}

      <button type="button" className={`btn-primary h-11 w-full text-sm sm:w-auto ${FOKUS}`} disabled={busy} aria-busy={busy} onClick={simpan}>
        {busy ? "Menyimpan…" : "Simpan"}
      </button>
    </div>
  );
}

function Galat({ id, pesan }: { id: string; pesan?: string }) {
  if (!pesan) return null;
  return (
    <p id={id} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-danger">
      <IconAlert className="shrink-0" aria-hidden="true" /> {pesan}
    </p>
  );
}

/** "… brief konten" → "… brief konten." (catatan pembina sering tanpa titik). */
function akhiriTitik(t: string): string {
  const s = t.trim();
  return /[.!?]$/.test(s) ? s : `${s}.`;
}
