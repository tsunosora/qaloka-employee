"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconArrowRight, IconCheck } from "@/components/ui/icons";
import { NilaiTugas, type TugasAdmin } from "@/components/magang/NilaiTugas";
import { ChipStatus, Judul, Kosong, Memuat, Pesan, tglPendek, warnaNilai, type StatusTugas } from "@/components/magang/ui";

type Anak = {
  id: number;
  nama: string;
  namaLengkap: string;
  publicToken: string | null;
  mulai: string;
  selesai: string | null;
  posIni: { nama: string; pembimbing: string | null; mingguKe: number; dari: number; berbagi: boolean } | null;
  posBerikut: { nama: string; mulai: string } | null;
  tugasIni: StatusTugas;
  tugasLalu: StatusTugas;
  rataNilai: number | null;
  adaRotasi: boolean;
};
type Ringkasan = { hariIni: string; seninIni: string; jumlahPos: number; belumDinilai: number; peserta: Anak[] };

export default function MagangPage() {
  const [data, setData] = useState<Ringkasan | null>(null);
  const [tugas, setTugas] = useState<TugasAdmin[] | null>(null);
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [dinilai, setDinilai] = useState<TugasAdmin | null>(null);

  const ambil = useCallback(
    () => Promise.all([api<Ringkasan>("/api/magang"), api<{ items: TugasAdmin[] }>("/api/magang/tugas?status=belum")]),
    []
  );
  const pasang = ([r, t]: [Ringkasan, { items: TugasAdmin[] }]) => {
    setData(r);
    setTugas(t.items);
  };
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat data.");
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

  const tanpaRotasi = data?.peserta.filter((p) => !p.adaRotasi).length ?? 0;
  const langkah = data
    ? [
        { selesai: data.jumlahPos > 0, teks: "Atur pos kerja & bank soal", href: "/magang/pos" },
        { selesai: data.peserta.length > 0, teks: "Daftarkan anak magang (dari Direktori)", href: "/magang/peserta" },
        { selesai: data.peserta.length > 0 && tanpaRotasi === 0, teks: "Susun rotasi pos", href: "/magang/rotasi" },
      ]
    : [];
  const siap = langkah.every((l) => l.selesai);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Judul
        judul="Magang — Minggu Ini"
        keterangan="Siapa memegang pos apa minggu ini, dan tugas mengingat akhir minggu yang perlu dinilai. Tugas dibuka untuk anak tiap Jumat lewat halaman pribadinya."
      />
      {notice && <Pesan jenis="ok">{notice}</Pesan>}
      {galat && <Pesan jenis="galat">{galat}</Pesan>}

      {!data ? (
        <Memuat />
      ) : (
        <>
          {!siap && (
            <section className="glass rounded-2xl p-5">
              <h2 className="font-display font-bold text-fg">Mulai program magang</h2>
              <ol className="mt-3 space-y-2">
                {langkah.map((l, i) => (
                  <li key={l.href}>
                    <Link href={l.href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-surface-2">
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          l.selesai ? "bg-success text-white" : "border border-border-strong text-muted"
                        }`}
                      >
                        {l.selesai ? <IconCheck /> : i + 1}
                      </span>
                      <span className={l.selesai ? "text-muted line-through" : "font-medium text-fg"}>{l.teks}</span>
                      {!l.selesai && <IconArrowRight className="ml-auto text-muted" />}
                    </Link>
                  </li>
                ))}
              </ol>
              {data.peserta.length > 0 && tanpaRotasi > 0 && (
                <p className="mt-2 text-xs text-muted">{tanpaRotasi} anak belum punya jadwal rotasi.</p>
              )}
            </section>
          )}

          {data.peserta.length === 0 ? (
            siap ? <Kosong>Belum ada anak magang aktif.</Kosong> : null
          ) : (
            <section>
              <h2 className="mb-2 text-sm font-bold text-fg">Pos minggu ini · mulai {tglPendek(data.seninIni)}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.peserta.map((p) => (
                  <li key={p.id} className="glass rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold text-fg" title={p.namaLengkap}>
                          {p.nama}
                        </p>
                        {p.posIni ? (
                          <p className="text-sm text-fg">
                            {p.posIni.nama}
                            <span className="text-muted">
                              {" "}
                              · minggu {p.posIni.mingguKe} dari {p.posIni.dari}
                              {p.posIni.dari === 2 && (p.posIni.mingguKe === 1 ? " (didampingi)" : " (mandiri)")}
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted">Tidak memegang pos minggu ini</p>
                        )}
                        {p.posIni?.pembimbing && <p className="text-xs text-muted">Pembimbing: {p.posIni.pembimbing}</p>}
                        {p.posIni?.berbagi && <p className="text-xs text-warning">Berbagi pos dengan anak lain</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-2xl font-bold leading-none" style={{ color: warnaNilai(p.rataNilai) }}>
                          {p.rataNilai ?? "—"}
                        </p>
                        <p className="text-[11px] text-subtle">rata-rata</p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-subtle">Tugas minggu lalu</dt>
                        <dd className="mt-0.5">
                          <ChipStatus status={p.tugasLalu} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-subtle">Tugas minggu ini</dt>
                        <dd className="mt-0.5">
                          <ChipStatus status={p.tugasIni} />
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                      <span className="text-muted">{p.posBerikut ? `Berikutnya: ${p.posBerikut.nama} (${tglPendek(p.posBerikut.mulai)})` : "Pos terakhir"}</span>
                      <Link href={`/magang/rapor/${p.id}`} className="font-semibold text-primary hover:underline">
                        Rapor
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-bold text-fg">
              Perlu dinilai {tugas && tugas.length > 0 && <span className="text-warning">({tugas.length})</span>}
            </h2>
            {!tugas ? (
              <Memuat baris={2} tinggi="h-16" />
            ) : tugas.length === 0 ? (
              <Kosong>Semua tugas yang masuk sudah dinilai.</Kosong>
            ) : (
              <ul className="space-y-2">
                {tugas.map((t) => (
                  <li key={t.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-fg">
                        {t.nama} <span className="font-normal text-muted">· {t.pos} · minggu {tglPendek(t.senin)}</span>
                      </p>
                      <p className="line-clamp-2 text-sm text-muted">{t.ingatan}</p>
                    </div>
                    <span className="text-xs text-muted">
                      Kuis {t.skorKuis ?? "—"}
                      {t.terlambat && <span className="ml-1 text-danger">· terlambat</span>}
                    </span>
                    <button onClick={() => setDinilai(t)} className="btn-primary h-9 text-sm">
                      Nilai
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {dinilai && (
        <NilaiTugas
          tugas={dinilai}
          onClose={() => setDinilai(null)}
          onSaved={() => {
            setNotice(`Nilai ${dinilai.nama} minggu ${tglPendek(dinilai.senin)} tersimpan.`);
            setDinilai(null);
            muat();
          }}
        />
      )}
    </div>
  );
}
