"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconX } from "@/components/ui/icons";
import { Card, longDate, soft } from "@/components/portal/ui";
import { tglPendek, warnaNilai } from "@/components/magang/ui";

type Soal = { id: number; pertanyaan: string; pilihan: string[] };
type Terbuka = { senin: string; buka: string; batas: string; keadaan: "buka" | "terlambat"; pos: string; mingguKe: number; dari: number; soal: Soal[] };
type Riwayat = {
  id: number;
  senin: string;
  pos: string;
  ingatan: string;
  kuis: { soalId: number; pertanyaan: string; pilihan: string[]; benar: number; dipilih: number | null }[];
  skorKuis: number | null;
  terlambat: boolean;
  nilai: number | null;
  catatanPembimbing: string | null;
  praktik: Record<string, number | null>;
  nilaiIngatan: number | null;
  dinilaiAt: string | null;
};
type Data =
  | { peserta: false }
  | {
      peserta: true;
      hariIni: string;
      mulai: string;
      selesai: string | null;
      posIni: { nama: string; deskripsi: string | null; pembimbing: string | null; mingguKe: number; dari: number; berbagi: boolean } | null;
      posBerikut: { nama: string; mulai: string } | null;
      jadwal: { mulai: string; minggu: number; pos: string }[];
      bukaBerikut: string | null;
      tugasTerbuka: Terbuka[];
      riwayat: Riwayat[];
      aspek: readonly { key: string; label: string }[];
      skala: readonly { nilai: number; label: string }[];
      minIngatan: number;
    };

const poin = (d: string | null) =>
  (d ?? "")
    .split("\n")
    .map((s) => s.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);

export function MagangPanel({ token, ownerQuery }: { token: string; ownerQuery: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const q = ownerQuery ? `?${ownerQuery.slice(1)}` : "";

  const ambil = useCallback(() => api<Data>(`/api/public/portal/${token}/magang${q}`), [token, q]);
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat data magang.");
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
      <div className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-danger" style={soft("var(--danger)")}>
        <IconAlert className="shrink-0 text-[16px]" /> {galat}
      </div>
    );
  if (!data) return <div className="glass h-64 animate-pulse rounded-2xl" />;
  if (!data.peserta) return <Card>Kamu tidak terdaftar sebagai peserta magang.</Card>;

  const p = data.posIni;
  return (
    <div className="space-y-4">
      <Card title="Pos kamu minggu ini">
        {p ? (
          <div className="space-y-3">
            <div>
              <p className="font-display text-xl font-bold text-fg">{p.nama}</p>
              <p className="text-sm text-muted">
                Minggu {p.mingguKe} dari {p.dari}
                {p.dari === 2 && (p.mingguKe === 1 ? " — perhatikan & tanya sebanyak-banyaknya" : " — saatnya mengerjakan sendiri")}
                {p.pembimbing && <> · pembimbing {p.pembimbing}</>}
              </p>
            </div>
            {poin(p.deskripsi).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Target yang harus kamu kuasai</p>
                <ul className="mt-1.5 space-y-1 text-sm text-fg">
                  {poin(p.deskripsi).map((x) => (
                    <li key={x} className="flex gap-2">
                      <IconCheck className="mt-0.5 shrink-0 text-primary" /> {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.posBerikut && (
              <p className="border-t border-border pt-3 text-sm text-muted">
                Berikutnya: <b className="text-fg">{data.posBerikut.nama}</b> mulai {longDate(data.posBerikut.mulai)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Minggu ini kamu belum dijadwalkan di pos mana pun. Tanyakan ke pembimbing.</p>
        )}
      </Card>

      {data.tugasTerbuka.length === 0 ? (
        <Card title="Tugas mengingat">
          <p className="text-sm text-muted">
            {data.bukaBerikut
              ? `Tugas minggu ini dibuka hari Jumat, ${longDate(data.bukaBerikut)}. Sambil menunggu, catat hal-hal penting yang kamu pelajari — tapi saat mengisi nanti, tulis dari ingatan.`
              : "Tidak ada tugas yang perlu diisi sekarang."}
          </p>
        </Card>
      ) : (
        data.tugasTerbuka.map((t) => (
          <FormTugas key={t.senin} token={token} q={q} tugas={t} minIngatan={data.minIngatan} bolehKirim={!ownerQuery} onSelesai={muat} />
        ))
      )}

      {data.riwayat.length > 0 && (
        <Card title="Nilai dari pembimbing">
          <ul className="space-y-3">
            {data.riwayat.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-fg">
                      {r.pos} · minggu {tglPendek(r.senin)}
                    </p>
                    <p className="text-xs text-muted">
                      Kuis {r.skorKuis ?? "—"}
                      {r.terlambat && <span className="text-danger"> · dikirim terlambat</span>}
                    </p>
                  </div>
                  <p className="font-display text-xl font-bold" style={{ color: warnaNilai(r.nilai) }}>
                    {r.nilai ?? <span className="text-xs font-normal text-muted">belum dinilai</span>}
                  </p>
                </div>
                {r.dinilaiAt && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-4">
                    {data.aspek.map((a) => (
                      <div key={a.key}>
                        <dt className="text-muted">{a.label}</dt>
                        <dd className="font-semibold text-fg">{data.skala.find((s) => s.nilai === r.praktik[a.key])?.label ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {r.catatanPembimbing && <p className="mt-2 whitespace-pre-wrap border-t border-border pt-2 text-fg">{r.catatanPembimbing}</p>}
                {r.kuis.some((k) => k.dipilih !== k.benar) && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-primary">Lihat jawaban kuis yang salah</summary>
                    <ul className="mt-1 space-y-1">
                      {r.kuis
                        .filter((k) => k.dipilih !== k.benar)
                        .map((k) => (
                          <li key={k.soalId}>
                            {k.pertanyaan}
                            <span className="block text-muted">Jawaban benar: {k.pilihan[k.benar]}</span>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.jadwal.length > 0 && (
        <Card title="Jadwal rotasi kamu">
          <ol className="space-y-1 text-sm">
            {data.jadwal.map((j) => {
              const sekarang = p && j.pos === p.nama && j.mulai <= data.hariIni;
              return (
                <li key={j.mulai} className={`flex justify-between gap-3 rounded-lg px-2 py-1 ${sekarang ? "bg-primary/10 font-semibold text-fg" : "text-muted"}`}>
                  <span>{j.pos}</span>
                  <span>
                    {tglPendek(j.mulai)} · {j.minggu} mgg
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}

function FormTugas({
  token,
  q,
  tugas,
  minIngatan,
  bolehKirim,
  onSelesai,
}: {
  token: string;
  q: string;
  tugas: Terbuka;
  minIngatan: number;
  bolehKirim: boolean;
  onSelesai: () => void;
}) {
  const [ingatan, setIngatan] = useState("");
  const [jawaban, setJawaban] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<{ skorKuis: number | null; kuis: { soalId: number; benar: number; dipilih: number | null }[] } | null>(null);

  const panjang = ingatan.trim().length;
  const terjawab = tugas.soal.filter((s) => jawaban[String(s.id)] != null).length;
  const siap = panjang >= minIngatan && terjawab === tugas.soal.length;

  async function kirim() {
    setBusy(true);
    setGalat("");
    try {
      setHasil(
        await api(`/api/public/portal/${token}/magang${q}`, { method: "POST", body: JSON.stringify({ senin: tugas.senin, ingatan, jawaban }) })
      );
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal mengirim tugas.");
    } finally {
      setBusy(false);
    }
  }

  if (hasil) {
    const benar = new Map(hasil.kuis.map((k) => [k.soalId, k]));
    return (
      <Card title={`Tugas minggu ${tglPendek(tugas.senin)} terkirim`}>
        <p className="text-sm text-fg">
          {hasil.skorKuis != null ? (
            <>
              Skor kuis kamu <b className="font-display text-lg">{hasil.skorKuis}</b>. Pembimbing akan menilai praktik & tulisanmu.
            </>
          ) : (
            "Terima kasih. Pembimbing akan menilai praktik & tulisanmu."
          )}
        </p>
        {tugas.soal.length > 0 && (
          <ol className="mt-3 space-y-2 text-sm">
            {tugas.soal.map((s, i) => {
              const k = benar.get(s.id);
              const ok = k && k.dipilih === k.benar;
              return (
                <li key={s.id} className="flex gap-2">
                  {ok ? <IconCheck className="mt-0.5 shrink-0 text-success" /> : <IconX className="mt-0.5 shrink-0 text-danger" />}
                  <span>
                    {i + 1}. {s.pertanyaan}
                    {!ok && k && <span className="block text-xs text-muted">Jawaban benar: {s.pilihan[k.benar]}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <button className="btn-primary mt-4 h-10 text-sm" onClick={onSelesai}>
          Selesai
        </button>
      </Card>
    );
  }

  return (
    <Card title={`Tugas mengingat · ${tugas.pos} · minggu ${tglPendek(tugas.senin)}`}>
      <div className="space-y-5">
        {tugas.keadaan === "terlambat" ? (
          <p className="rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
            Batasnya {longDate(tugas.batas)} sudah lewat — tetap kirim sekarang, tapi akan ditandai terlambat.
          </p>
        ) : (
          <p className="text-sm text-muted">Kirim paling lambat {longDate(tugas.batas)}. Sekali kirim tidak bisa diubah.</p>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-fg">1. Tulis dari ingatanmu (tanpa melihat catatan)</span>
          <span className="block text-xs text-muted">
            Apa saja yang kamu kerjakan & pelajari minggu ini? Langkah-langkahnya, alat yang dipakai, kesalahan yang terjadi dan cara mengatasinya.
          </span>
          <textarea
            className="input mt-1.5 min-h-40 py-2"
            value={ingatan}
            onChange={(e) => setIngatan(e.target.value)}
            maxLength={4000}
            disabled={!bolehKirim}
          />
          <span className={`mt-1 block text-xs ${panjang >= minIngatan ? "text-success" : "text-muted"}`}>
            {panjang >= minIngatan ? "Cukup — boleh ditambah lagi" : `${panjang}/${minIngatan} huruf minimal`}
          </span>
        </label>

        {tugas.soal.length > 0 && (
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-fg">2. Kuis ({terjawab}/{tugas.soal.length} terjawab)</legend>
            {tugas.soal.map((s, i) => (
              <div key={s.id}>
                <p className="text-sm text-fg">
                  {i + 1}. {s.pertanyaan}
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {s.pilihan.map((pil, j) => {
                    const dipilih = jawaban[String(s.id)] === j;
                    return (
                      <label
                        key={j}
                        className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                          dipilih ? "border-primary bg-primary/10 text-fg" : "border-border text-muted hover:border-border-strong"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`soal-${tugas.senin}-${s.id}`}
                          className="mt-0.5"
                          checked={dipilih}
                          disabled={!bolehKirim}
                          onChange={() => setJawaban((x) => ({ ...x, [String(s.id)]: j }))}
                        />
                        {pil}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </fieldset>
        )}

        {galat && (
          <p className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
            <IconAlert className="shrink-0" /> {galat}
          </p>
        )}

        {bolehKirim ? (
          <button className="btn-primary h-11 w-full text-sm sm:w-auto" disabled={!siap || busy} onClick={kirim}>
            {busy ? "Mengirim…" : siap ? "Kirim tugas" : panjang < minIngatan ? "Lengkapi tulisanmu dulu" : "Jawab semua soal dulu"}
          </button>
        ) : (
          <p className="text-xs text-muted">Mode owner — hanya anaknya yang bisa mengirim tugas.</p>
        )}
      </div>
    </Card>
  );
}
