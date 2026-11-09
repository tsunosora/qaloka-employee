"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api, errorMessageFrom } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconChevronDown, IconClock, IconPlus, IconX } from "@/components/ui/icons";
import { Card, soft } from "@/components/portal/ui";
import { kecilkanFoto } from "@/components/reimbursement/ui";
import { MAKS_TEKS_MISI, type JenisBukti } from "@/lib/services/magang/misi";
import {
  STATUS_MISI_META,
  galatBukti,
  persen,
  petakanGalatServer,
  ringkasBukti,
  statusMisi,
  type GalatBukti,
  type StatusMisiTampil,
} from "@/components/portal/sideQuest";

type Kiriman = {
  id: number;
  teks: string | null;
  tautan: string | null;
  jumlahFoto: number;
  status: "menunggu" | "disetujui" | "ditolak";
  catatan: string | null;
  kirimKe: number;
  dikirimAt: string;
  diputusAt: string | null;
  diputusOleh: string | null;
};
type Misi = {
  id: number;
  kategori: string;
  kategoriLabel: string;
  level: string;
  levelLabel: string;
  judul: string;
  deskripsi: string | null;
  bukti: JenisBukti[];
  poin: number;
  kiriman: Kiriman | null;
};
type ProgresKategori = { kategori: string; label: string; prioritas: string; selesai: number; menunggu: number; ditolak: number; total: number; poin: number; poinMaks: number };
type Data =
  | { peserta: false }
  | {
      peserta: true;
      kategori: { kunci: string; nama: string; prioritas: string | null; ringkas: string | null }[];
      maksFoto: number;
      minTeks: number;
      progres: { kategori: ProgresKategori[]; selesai: number; total: number; poin: number; poinMaks: number; menunggu: number };
      misi: Misi[];
    };

/** Cincin fokus yang jelas untuk tombol buatan sendiri (btn-* belum punya gaya fokus). */
export const FOKUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const tglSingkat = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

export function Bar({ nilai, dari, label }: { nilai: number; dari: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={dari}
      aria-valuenow={nilai}
      className="h-2 overflow-hidden rounded-full"
      style={soft("var(--fg-subtle)", 22)}
    >
      <div className="h-full rounded-full transition-[width]" style={{ width: `${persen(nilai, dari)}%`, background: "var(--success)" }} />
    </div>
  );
}

export function ChipStatus({ status }: { status: StatusMisiTampil }) {
  const m = STATUS_MISI_META[status];
  const Ikon = status === "selesai" ? IconCheck : status === "ditolak" ? IconAlert : status === "menunggu" ? IconClock : null;
  return (
    <span className="badge shrink-0" style={{ ...soft(m.color, 18), color: m.color }}>
      {Ikon && <Ikon className="text-[12px]" aria-hidden="true" />}
      {m.label}
    </span>
  );
}

/**
 * Side quest di tab Magang anak: misi wajib di luar rotasi pos (kategorinya diatur admin). Progres di
 * atas, misi dikelompokkan per kategori (tertutup), satu misi terbuka sekaligus berisi formulir bukti.
 * Mode owner (bolehKirim=false) hanya melihat — server juga menolak 403.
 */
export function SideQuestMagang({ token, q, bolehKirim }: { token: string; q: string; bolehKirim: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [kategoriBuka, setKategoriBuka] = useState<string | null>(null);
  const [misiBuka, setMisiBuka] = useState<number | null>(null);
  const [terkirim, setTerkirim] = useState<number | null>(null);
  const url = `/api/public/portal/${token}/magang/misi`;

  const ambil = useCallback(() => api<Data>(`${url}${q}`), [url, q]);
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat side quest.");
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
  if (!data.peserta || data.misi.length === 0) return null;

  const pr = data.progres;
  const perbaiki = data.misi.filter((m) => statusMisi(m.kiriman) === "ditolak");
  const bukaMisi = (m: Misi) => {
    setKategoriBuka(m.kategori);
    setMisiBuka(m.id);
    setTerkirim(null);
  };

  return (
    <Card
      title="Side Quest"
      action={
        <span className="tabular text-xs font-semibold text-muted">
          {pr.poin}/{pr.poinMaks} poin
        </span>
      }
    >
      <p className="-mt-2 text-sm text-muted">Misi wajib di luar pos. Kerjakan di sela-sela tugas utama, lalu kirim buktinya di sini.</p>

      <div className="mt-3 space-y-1.5">
        <p className="text-sm text-fg">
          <b className="font-display text-lg">{pr.selesai}</b> dari {pr.total} misi selesai
          {pr.menunggu > 0 && <span className="text-muted"> · {pr.menunggu} menunggu dicek</span>}
        </p>
        <Bar nilai={pr.selesai} dari={pr.total} label="Misi selesai" />
      </div>

      {perbaiki.length > 0 && (
        <div className="mt-4 rounded-xl px-3 py-2.5 text-sm" style={soft("var(--danger)", 12)}>
          <p className="flex items-center gap-2 font-semibold text-danger">
            <IconAlert className="shrink-0" aria-hidden="true" /> {perbaiki.length} misi perlu diperbaiki
          </p>
          <ul className="mt-1">
            {perbaiki.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => bukaMisi(m)}
                  className={`flex min-h-11 w-full items-center gap-1 rounded-lg text-left font-medium text-fg underline underline-offset-2 ${FOKUS}`}
                >
                  {m.judul}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!bolehKirim && <p className="mt-3 text-xs text-muted">Mode owner — hanya anaknya yang bisa mengirim bukti.</p>}

      <ul className="mt-4 space-y-2">
        {pr.kategori.map((k) => {
          const terbuka = kategoriBuka === k.kategori;
          const info = data.kategori.find((x) => x.kunci === k.kategori);
          const misi = data.misi.filter((m) => m.kategori === k.kategori || (k.kategori === "lain" && !data.kategori.some((x) => x.kunci === m.kategori)));
          const idPanel = `sq-kat-${k.kategori}`;
          return (
            <li key={k.kategori} className="rounded-xl border border-border">
              <button
                type="button"
                aria-expanded={terbuka}
                aria-controls={idPanel}
                onClick={() => {
                  setKategoriBuka(terbuka ? null : k.kategori);
                  setMisiBuka(null);
                }}
                className={`flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-3 text-left ${FOKUS}`}
              >
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="font-semibold text-fg">{k.label}</span>
                    <span className="tabular text-sm font-semibold text-fg">
                      {k.selesai}/{k.total}
                    </span>
                  </span>
                  <span className="block text-xs text-muted">
                    {[k.prioritas !== "—" ? `Prioritas ${k.prioritas}` : null, info?.ringkas].filter(Boolean).join(" · ")}
                  </span>
                  <Bar nilai={k.selesai} dari={k.total} label={`${k.label}: misi selesai`} />
                </span>
                <IconChevronDown className={`mt-0.5 shrink-0 text-[18px] text-muted transition-transform ${terbuka ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {terbuka && (
                <ul id={idPanel} className="space-y-1.5 border-t border-border p-2">
                  {misi.map((m) => (
                    <BarisMisi
                      key={m.id}
                      misi={m}
                      terbuka={misiBuka === m.id}
                      onToggle={() => {
                        setMisiBuka(misiBuka === m.id ? null : m.id);
                        setTerkirim(null);
                      }}
                    >
                      <DetailMisi
                        misi={m}
                        url={url}
                        q={q}
                        token={token}
                        bolehKirim={bolehKirim}
                        maksFoto={data.maksFoto}
                        minTeks={data.minTeks}
                        terkirim={terkirim === m.id}
                        onTerkirim={() => {
                          setTerkirim(m.id);
                          muat();
                        }}
                        onBasi={muat}
                      />
                    </BarisMisi>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function BarisMisi({ misi, terbuka, onToggle, children }: { misi: Misi; terbuka: boolean; onToggle: () => void; children: React.ReactNode }) {
  const idDetail = `sq-misi-${misi.id}`;
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (terbuka) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [terbuka]);
  return (
    <li ref={ref} className={`rounded-lg ${terbuka ? "bg-surface-2" : ""}`}>
      <button
        type="button"
        aria-expanded={terbuka}
        aria-controls={idDetail}
        onClick={onToggle}
        className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2 ${FOKUS}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg">{misi.judul}</span>
          <span className="block text-xs text-muted">
            {misi.levelLabel} · {misi.poin} poin
          </span>
        </span>
        <ChipStatus status={statusMisi(misi.kiriman)} />
      </button>
      {terbuka && (
        <div id={idDetail} className="px-2.5 pb-3">
          {children}
        </div>
      )}
    </li>
  );
}

function DetailMisi({
  misi,
  url,
  q,
  token,
  bolehKirim,
  maksFoto,
  minTeks,
  terkirim,
  onTerkirim,
  onBasi,
}: {
  misi: Misi;
  url: string;
  q: string;
  token: string;
  bolehKirim: boolean;
  maksFoto: number;
  minTeks: number;
  terkirim: boolean;
  onTerkirim: () => void;
  onBasi: () => void;
}) {
  const k = misi.kiriman;
  const status = statusMisi(k);
  const fotoUrl = (n: number) => `/api/public/portal/${token}/magang/misi/${k?.id}/foto/${n}${q}`;

  return (
    <div className="space-y-3 pt-1 text-sm">
      {misi.deskripsi && <p className="whitespace-pre-wrap text-fg">{misi.deskripsi}</p>}
      <p className="text-xs font-semibold text-muted">{ringkasBukti(misi.bukti)}</p>

      <p role="status" className={terkirim ? "flex items-center gap-2 rounded-xl px-3 py-2 font-semibold text-success" : "sr-only"} style={terkirim ? soft("var(--success)") : undefined}>
        {terkirim && (
          <>
            <IconCheck className="shrink-0" aria-hidden="true" /> Bukti terkirim. Pembimbing akan mengeceknya.
          </>
        )}
      </p>

      {status === "ditolak" && k && (
        <div className="rounded-xl border-l-4 px-3 py-2.5" style={{ ...soft("var(--danger)", 12), borderColor: "var(--danger)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-danger">Catatan pembimbing{k.diputusOleh ? ` (${k.diputusOleh})` : ""}</p>
          <p className="mt-1 whitespace-pre-wrap text-fg">{k.catatan || "Perbaiki buktimu lalu kirim ulang."}</p>
          {bolehKirim && <p className="mt-1.5 text-xs text-muted">Perbaiki sesuai catatan di atas, lalu kirim ulang.</p>}
        </div>
      )}

      {status === "menunggu" && k && !terkirim && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <IconClock className="shrink-0" aria-hidden="true" /> Dikirim {tglSingkat(k.dikirimAt)} — menunggu dicek.
          {bolehKirim && " Masih bisa kamu perbaiki sebelum dicek."}
        </p>
      )}

      {status === "selesai" && k && (
        <div className="rounded-xl px-3 py-2.5" style={soft("var(--success)", 14)}>
          <p className="flex items-center gap-2 font-semibold text-success">
            <IconCheck className="shrink-0" aria-hidden="true" /> Disetujui{k.diputusOleh ? ` oleh ${k.diputusOleh}` : ""} · +{misi.poin} poin
          </p>
          {k.catatan && <p className="mt-1 whitespace-pre-wrap text-fg">{k.catatan}</p>}
        </div>
      )}

      {bolehKirim && status !== "selesai" ? (
        <FormMisi
          key={`${misi.id}-${k?.id ?? 0}-${k?.dikirimAt ?? ""}`}
          misi={misi}
          url={url}
          q={q}
          maksFoto={maksFoto}
          minTeks={minTeks}
          fotoUrl={fotoUrl}
          onTerkirim={onTerkirim}
          onBasi={onBasi}
        />
      ) : k ? (
        <BuktiTerkirim kiriman={k} fotoUrl={fotoUrl} />
      ) : (
        <p className="text-xs text-muted">Belum ada bukti yang dikirim.</p>
      )}
    </div>
  );
}

export function BuktiTerkirim({ kiriman, fotoUrl }: { kiriman: Pick<Kiriman, "teks" | "tautan" | "jumlahFoto">; fotoUrl: (n: number) => string }) {
  return (
    <div className="space-y-2">
      {kiriman.teks && <p className="whitespace-pre-wrap text-fg">{kiriman.teks}</p>}
      {kiriman.tautan && (
        <a href={kiriman.tautan} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center break-all font-medium text-primary underline underline-offset-2 ${FOKUS}`}>
          {kiriman.tautan}
        </a>
      )}
      {kiriman.jumlahFoto > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: kiriman.jumlahFoto }, (_, n) => (
            <a key={n} href={fotoUrl(n)} target="_blank" rel="noopener noreferrer" className={`rounded-xl ${FOKUS}`} aria-label={`Buka foto ${n + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-PIN, bukan aset statis */}
              <img src={fotoUrl(n)} alt="" loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function FormMisi({
  misi,
  url,
  q,
  maksFoto,
  minTeks,
  fotoUrl,
  onTerkirim,
  onBasi,
}: {
  misi: Misi;
  url: string;
  q: string;
  maksFoto: number;
  minTeks: number;
  fotoUrl: (n: number) => string;
  onTerkirim: () => void;
  onBasi: () => void;
}) {
  const k = misi.kiriman;
  const id = useId();
  const minta = (b: JenisBukti) => misi.bukti.includes(b);
  const [teks, setTeks] = useState(k?.teks ?? "");
  const [tautan, setTautan] = useState(k?.tautan ?? "");
  const [buang, setBuang] = useState<number[]>([]);
  const [baru, setBaru] = useState<{ blob: Blob; url: string }[]>([]);
  const [menyiapkan, setMenyiapkan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dicoba, setDicoba] = useState(false);
  const [galatServer, setGalatServer] = useState<GalatBukti & { umum?: string }>({});
  const refFoto = useRef<HTMLInputElement>(null);
  const refTautan = useRef<HTMLInputElement>(null);
  const refTeks = useRef<HTMLTextAreaElement>(null);

  const lama = k ? Array.from({ length: k.jumlahFoto }, (_, n) => n).filter((n) => !buang.includes(n)) : [];
  const jumlahFoto = minta("foto") ? lama.length + baru.length : 0;
  const sisa = maksFoto - lama.length - baru.length;
  const panjang = teks.trim().length;
  const cekDini = galatBukti(misi.bukti, { teks, tautan, jumlahFoto }, { minTeks, maksFoto });
  const galat: GalatBukti = { ...(dicoba ? cekDini : {}), ...galatServer };
  const lepas = (kunci: keyof GalatBukti) =>
    setGalatServer((g) => {
      const r = { ...g };
      delete r[kunci];
      return r;
    });

  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const berkas = [...(e.target.files ?? [])].slice(0, Math.max(0, sisa));
    e.target.value = "";
    if (!berkas.length) return;
    setMenyiapkan(true);
    try {
      const kecil = await Promise.all(berkas.map(async (f) => ({ blob: await kecilkanFoto(f), url: URL.createObjectURL(f) })));
      setBaru((b) => [...b, ...kecil]);
      lepas("foto");
    } finally {
      setMenyiapkan(false);
    }
  }

  async function kirim() {
    setDicoba(true);
    setGalatServer({});
    const dini = galatBukti(misi.bukti, { teks, tautan, jumlahFoto }, { minTeks, maksFoto });
    const pertama = (["foto", "tautan", "teks"] as const).find((b) => dini[b]);
    if (pertama) {
      ({ foto: refFoto, tautan: refTautan, teks: refTeks })[pertama].current?.focus();
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("misiId", String(misi.id));
      if (minta("teks") && teks.trim()) form.set("teks", teks);
      if (minta("tautan") && tautan.trim()) form.set("tautan", tautan.trim());
      // Foto lama yang dibuang — atau semua foto lama bila misi ini (sekarang) tidak meminta foto.
      const hapus = minta("foto") ? buang : k ? Array.from({ length: k.jumlahFoto }, (_, n) => n) : [];
      if (hapus.length) form.set("hapusFoto", hapus.join(","));
      if (minta("foto")) baru.forEach((b, i) => form.append("foto", b.blob, `bukti-${i + 1}.jpg`));
      const res = await fetch(`${url}${q}`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const pesan = errorMessageFrom(body, res.status);
        if (res.status === 422) {
          const m = petakanGalatServer(body.errors);
          setGalatServer(m.foto || m.tautan || m.teks || m.umum ? m : { umum: pesan });
        } else {
          setGalatServer({ umum: pesan });
          if (res.status === 409 || res.status === 404) onBasi();
        }
        return;
      }
      baru.forEach((b) => URL.revokeObjectURL(b.url));
      onTerkirim();
    } catch {
      setGalatServer({ umum: "Gagal mengirim. Periksa sinyal lalu coba lagi." });
    } finally {
      setBusy(false);
    }
  }

  const label = k?.status === "ditolak" ? "Kirim perbaikan" : k ? "Perbarui bukti" : "Kirim bukti";

  return (
    <div className="space-y-4 border-t border-border pt-3">
      {minta("foto") && (
        <fieldset aria-describedby={`${id}-foto-bantu ${galat.foto ? `${id}-foto-galat` : ""}`}>
          <legend className="text-sm font-semibold text-fg">
            Foto hasil kerja <span className="text-xs font-normal text-muted">(wajib, maks {maksFoto})</span>
          </legend>
          <p id={`${id}-foto-bantu`} className="text-xs text-muted">
            Foto yang jelas menunjukkan hasilmu. Foto otomatis diperkecil supaya hemat kuota.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {lama.map((n) => (
              <div key={`l${n}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-PIN */}
                <img src={fotoUrl(n)} alt={`Foto ${n + 1}`} className="h-24 w-24 rounded-xl object-cover" />
                <TombolBuang label={`Buang foto ${n + 1}`} onClick={() => setBuang((b) => [...b, n])} />
              </div>
            ))}
            {baru.map((b, i) => (
              <div key={b.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau berkas lokal */}
                <img src={b.url} alt={`Foto baru ${i + 1}`} className="h-24 w-24 rounded-xl object-cover" />
                <TombolBuang
                  label={`Batalkan foto baru ${i + 1}`}
                  onClick={() => {
                    URL.revokeObjectURL(b.url);
                    setBaru((x) => x.filter((_, j) => j !== i));
                  }}
                />
              </div>
            ))}
            {sisa > 0 && (
              <label
                className={`grid h-24 w-24 cursor-pointer place-items-center rounded-xl border border-dashed text-muted hover:text-fg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary ${
                  galat.foto ? "border-danger" : "border-border-strong"
                }`}
              >
                <span className="flex flex-col items-center gap-1 text-xs">
                  <IconPlus className="text-[20px]" aria-hidden="true" />
                  {menyiapkan ? "Menyiapkan…" : "Tambah foto"}
                </span>
                <input ref={refFoto} type="file" accept="image/*" multiple className="sr-only" disabled={menyiapkan || busy} onChange={pilihFoto} />
              </label>
            )}
          </div>
          <Galat id={`${id}-foto-galat`} pesan={galat.foto} />
        </fieldset>
      )}

      {minta("tautan") && (
        <div>
          <label htmlFor={`${id}-tautan`} className="text-sm font-semibold text-fg">
            Tautan hasil kerja <span className="text-xs font-normal text-muted">(wajib)</span>
          </label>
          <p id={`${id}-tautan-bantu`} className="text-xs text-muted">
            Tautan Instagram, Google Drive, atau Canva. Pastikan bisa dibuka orang lain.
          </p>
          <input
            ref={refTautan}
            id={`${id}-tautan`}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            maxLength={500}
            value={tautan}
            onChange={(e) => {
              setTautan(e.target.value);
              lepas("tautan");
            }}
            aria-invalid={!!galat.tautan}
            aria-describedby={`${id}-tautan-bantu ${galat.tautan ? `${id}-tautan-galat` : ""}`}
            className={`input mt-1.5 h-11 ${galat.tautan ? "border-danger" : ""}`}
          />
          <Galat id={`${id}-tautan-galat`} pesan={galat.tautan} />
        </div>
      )}

      {minta("teks") && (
        <div>
          <label htmlFor={`${id}-teks`} className="text-sm font-semibold text-fg">
            Ceritakan hasil kerjamu <span className="text-xs font-normal text-muted">(wajib)</span>
          </label>
          <p id={`${id}-teks-bantu`} className="text-xs text-muted">
            Apa yang kamu kerjakan, bagaimana caranya, dan apa hasilnya.
          </p>
          <textarea
            ref={refTeks}
            id={`${id}-teks`}
            className={`input mt-1.5 min-h-28 py-2 ${galat.teks ? "border-danger" : ""}`}
            value={teks}
            maxLength={MAKS_TEKS_MISI}
            onChange={(e) => {
              setTeks(e.target.value);
              lepas("teks");
            }}
            aria-invalid={!!galat.teks}
            aria-describedby={`${id}-teks-bantu ${id}-teks-hitung ${galat.teks ? `${id}-teks-galat` : ""}`}
          />
          <span id={`${id}-teks-hitung`} className={`mt-1 block text-xs ${panjang >= minTeks ? "text-success" : "text-muted"}`}>
            {panjang >= minTeks ? `Cukup (${panjang} huruf)` : `${panjang}/${minTeks} huruf minimal`}
          </span>
          <Galat id={`${id}-teks-galat`} pesan={galat.teks} />
        </div>
      )}

      {galatServer.umum && (
        <p role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
          <IconAlert className="shrink-0" aria-hidden="true" /> {galatServer.umum}
        </p>
      )}

      <button type="button" className={`btn-primary h-11 w-full text-sm sm:w-auto ${FOKUS}`} disabled={busy || menyiapkan} aria-busy={busy} onClick={kirim}>
        {busy ? "Mengirim…" : label}
      </button>
    </div>
  );
}

function TombolBuang({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`absolute -right-3 -top-3 grid h-11 w-11 place-items-center rounded-full ${FOKUS}`}>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-danger text-white shadow">
        <IconX className="text-[14px]" aria-hidden="true" />
      </span>
    </button>
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
