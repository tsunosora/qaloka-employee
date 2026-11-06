"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconPlus, IconX } from "@/components/ui/icons";
import { Card, shortDate, soft } from "@/components/portal/ui";
import { kecilkanFoto, kirimForm } from "@/components/reimbursement/ui";

type Isian = {
  id: number;
  tanggal: string;
  pos: string | null;
  kegiatan: string;
  kendala: string | null;
  jumlahFoto: number;
  komentar: string | null;
  dicek: boolean;
  bolehSunting: boolean;
};
type Data =
  | { peserta: false }
  | { peserta: true; hariIni: string; bolehIsi: string[]; riwayatDitahan: boolean; maksFoto: number; minKegiatan: number; isian: Isian[] };

/** Jurnal harian anak magang di halaman pribadinya (tab Magang). */
export function JurnalMagang({ token, q, bolehKirim }: { token: string; q: string; bolehKirim: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [tersimpan, setTersimpan] = useState("");

  const ambil = useCallback(() => api<Data>(`/api/public/portal/${token}/magang/jurnal${q}`), [token, q]);
  const pasang = (d: Data) => {
    setData(d);
    if (d.peserta) setTanggal((t) => (t && d.bolehIsi.includes(t) ? t : d.bolehIsi[0] ?? ""));
  };
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat jurnal.");
  const muat = () => ambil().then(pasang, gagal);
  useEffect(() => {
    let hidup = true;
    ambil().then(
      (d) => hidup && pasang(d),
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

  const per = new Map(data.isian.map((i) => [i.tanggal, i]));
  const ini = per.get(tanggal) ?? null;
  const fotoUrl = (id: number, n: number) => `/api/public/portal/${token}/magang/jurnal/${id}/foto/${n}${q}`;
  const riwayat = data.riwayatDitahan ? [] : data.isian.filter((i) => !data.bolehIsi.includes(i.tanggal) || i.dicek);

  return (
    <Card title="Jurnal harian">
      {data.bolehIsi.length === 0 ? (
        <p className="text-sm text-muted">Di luar masa magangmu — jurnal tidak bisa diisi.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pilih tanggal">
            {data.bolehIsi.map((t) => {
              const i = per.get(t);
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tanggal === t}
                  onClick={() => {
                    setTanggal(t);
                    setTersimpan("");
                  }}
                  className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    tanggal === t ? "border-primary bg-primary/10 text-fg" : "border-border text-muted hover:border-border-strong"
                  }`}
                >
                  {i ? <IconCheck className="text-success" /> : null}
                  {t === data.hariIni ? "Hari ini" : shortDate(t)}
                </button>
              );
            })}
          </div>
          {tersimpan === tanggal && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-success">
              <IconCheck /> Jurnal tersimpan. Pembimbing akan mengeceknya.
            </p>
          )}
          <FormJurnal
            key={`${tanggal}-${ini?.id ?? 0}-${ini?.jumlahFoto ?? 0}`}
            token={token}
            q={q}
            tanggal={tanggal}
            isian={ini}
            maksFoto={data.maksFoto}
            minKegiatan={data.minKegiatan}
            bolehKirim={bolehKirim}
            fotoUrl={fotoUrl}
            onTersimpan={() => {
              setTersimpan(tanggal);
              muat();
            }}
          />
        </>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Jurnal sebelumnya</p>
        {data.riwayatDitahan ? (
          <p className="mt-1.5 text-sm text-muted">Disembunyikan sampai kamu mengirim tugas mengingat minggu ini — tulis tugasnya dari ingatan, ya.</p>
        ) : riwayat.length === 0 ? (
          <p className="mt-1.5 text-sm text-subtle">Belum ada.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {riwayat.map((i) => (
              <li key={i.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-fg">
                    {shortDate(i.tanggal)}
                    {i.pos && <span className="font-normal text-muted"> · {i.pos}</span>}
                  </p>
                  {i.dicek ? <span className="text-xs font-semibold text-success">Dicek</span> : <span className="text-xs text-subtle">Belum dicek</span>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-fg">{i.kegiatan}</p>
                {i.jumlahFoto > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {Array.from({ length: i.jumlahFoto }, (_, n) => (
                      // eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-PIN, bukan aset statis
                      <img key={n} src={fotoUrl(i.id, n)} alt={`Foto ${n + 1}`} loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                {i.komentar && <p className="mt-2 border-t border-border pt-2 text-xs text-fg">Pembimbing: {i.komentar}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function FormJurnal({
  token,
  q,
  tanggal,
  isian,
  maksFoto,
  minKegiatan,
  bolehKirim,
  fotoUrl,
  onTersimpan,
}: {
  token: string;
  q: string;
  tanggal: string;
  isian: Isian | null;
  maksFoto: number;
  minKegiatan: number;
  bolehKirim: boolean;
  fotoUrl: (id: number, n: number) => string;
  onTersimpan: () => void;
}) {
  const [kegiatan, setKegiatan] = useState(isian?.kegiatan ?? "");
  const [kendala, setKendala] = useState(isian?.kendala ?? "");
  const [buang, setBuang] = useState<number[]>([]);
  const [baru, setBaru] = useState<{ blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");

  const terkunci = !!isian && !isian.bolehSunting;
  const lama = isian ? Array.from({ length: isian.jumlahFoto }, (_, n) => n).filter((n) => !buang.includes(n)) : [];
  const sisa = maksFoto - lama.length - baru.length;
  const siap = kegiatan.trim().length >= minKegiatan;

  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const berkas = [...(e.target.files ?? [])].slice(0, Math.max(0, sisa));
    e.target.value = "";
    const kecil = await Promise.all(berkas.map(async (f) => ({ blob: await kecilkanFoto(f), url: URL.createObjectURL(f) })));
    setBaru((b) => [...b, ...kecil]);
  }

  async function simpan() {
    setBusy(true);
    setGalat("");
    try {
      const form = new FormData();
      form.set("tanggal", tanggal);
      form.set("kegiatan", kegiatan);
      if (kendala.trim()) form.set("kendala", kendala);
      if (buang.length) form.set("hapusFoto", buang.join(","));
      baru.forEach((b, i) => form.append("foto", b.blob, `foto-${i + 1}.jpg`));
      await kirimForm(`/api/public/portal/${token}/magang/jurnal${q}`, form);
      onTersimpan();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Gagal menyimpan jurnal.");
    } finally {
      setBusy(false);
    }
  }

  if (terkunci && isian) {
    return (
      <div className="mt-3 space-y-2 text-sm">
        <p className="whitespace-pre-wrap text-fg">{isian.kegiatan}</p>
        {isian.kendala && <p className="text-muted">Kendala: {isian.kendala}</p>}
        <p className="text-xs font-semibold text-success">Sudah dicek pembimbing{isian.komentar ? `: ${isian.komentar}` : "."}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <label className="block">
        <span className="text-sm font-semibold text-fg">Apa yang kamu kerjakan?</span>
        <textarea
          className="input mt-1.5 min-h-28 py-2"
          value={kegiatan}
          maxLength={3000}
          disabled={!bolehKirim}
          placeholder="mis. Memotong 20 lembar stiker, memasang keling 6 banner, belajar setting file kartu nama."
          onChange={(e) => setKegiatan(e.target.value)}
        />
        <span className={`mt-1 block text-xs ${siap ? "text-success" : "text-muted"}`}>
          {siap ? "Cukup" : `${kegiatan.trim().length}/${minKegiatan} huruf minimal`}
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-fg">Kendala / yang ingin ditanyakan</span>
        <textarea className="input mt-1.5 min-h-16 py-2" value={kendala} maxLength={2000} disabled={!bolehKirim} onChange={(e) => setKendala(e.target.value)} />
      </label>
      <div>
        <span className="text-sm font-semibold text-fg">Foto hasil kerja</span>
        <span className="text-xs text-muted"> (boleh, maks {maksFoto})</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {lama.map((n) => (
            <div key={`l${n}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-PIN */}
              <img src={fotoUrl(isian!.id, n)} alt={`Foto ${n + 1}`} className="h-20 w-20 rounded-xl object-cover" />
              {bolehKirim && (
                <button
                  type="button"
                  aria-label={`Buang foto ${n + 1}`}
                  onClick={() => setBuang((b) => [...b, n])}
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-danger text-white"
                >
                  <IconX className="text-[12px]" />
                </button>
              )}
            </div>
          ))}
          {baru.map((b, i) => (
            <div key={b.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau berkas lokal */}
              <img src={b.url} alt={`Foto baru ${i + 1}`} className="h-20 w-20 rounded-xl object-cover" />
              <button
                type="button"
                aria-label={`Batalkan foto baru ${i + 1}`}
                onClick={() => setBaru((x) => x.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-danger text-white"
              >
                <IconX className="text-[12px]" />
              </button>
            </div>
          ))}
          {bolehKirim && sisa > 0 && (
            <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed border-border-strong text-muted hover:text-fg">
              <IconPlus className="text-[20px]" />
              <span className="sr-only">Tambah foto</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={pilihFoto} />
            </label>
          )}
        </div>
      </div>
      {galat && (
        <p className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
          <IconAlert className="shrink-0" /> {galat}
        </p>
      )}
      {bolehKirim ? (
        <button className="btn-primary h-11 w-full text-sm sm:w-auto" disabled={!siap || busy} onClick={simpan}>
          {busy ? "Menyimpan…" : isian ? "Simpan perubahan" : "Simpan jurnal"}
        </button>
      ) : (
        <p className="text-xs text-muted">Mode owner — hanya anaknya yang bisa mengisi jurnal.</p>
      )}
    </div>
  );
}
