"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconChevronLeft, IconDownload } from "@/components/ui/icons";
import { NilaiTugas, type TugasAdmin } from "@/components/magang/NilaiTugas";
import { DaftarJurnal } from "@/components/magang/DaftarJurnal";
import { RaporIsi, type RaporPayload } from "@/components/magang/RaporIsi";
import { Memuat, Pesan } from "@/components/magang/ui";

export default function RaporMagangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<RaporPayload | null>(null);
  const [galat, setGalat] = useState("");
  const [dinilai, setDinilai] = useState<TugasAdmin | null>(null);

  const ambil = useCallback(() => api<RaporPayload>(`/api/magang/peserta/${id}/rapor`), [id]);
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat rapor.");
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

  if (galat) return <Pesan jenis="galat">{galat}</Pesan>;
  if (!data) return <Memuat baris={2} tinggi="h-48" />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/magang/peserta" className="btn-ghost h-11 px-3 text-sm">
          <IconChevronLeft /> Peserta
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={data.peserta.sekolah ? `/magang/rapor/sekolah?sekolah=${encodeURIComponent(data.peserta.sekolah)}` : "/magang/rapor/sekolah"}
            className="btn-ghost h-11 px-3 text-sm"
          >
            Cetak rapor per sekolah
          </Link>
          <button className="btn-primary h-11 text-sm" onClick={() => window.print()}>
            <IconDownload /> Cetak / simpan PDF
          </button>
        </div>
      </div>

      <RaporIsi data={data} onNilai={setDinilai} />

      <section className="print:hidden">
        <h2 className="mb-2 text-sm font-bold text-fg">Jurnal harian ({data.daftarJurnal.length})</h2>
        {data.daftarJurnal.length === 0 ? (
          <p className="text-sm text-subtle">Belum ada jurnal.</p>
        ) : (
          <DaftarJurnal items={data.daftarJurnal} tampilNama={false} onDicek={() => muat()} />
        )}
      </section>

      {dinilai && (
        <NilaiTugas
          tugas={dinilai}
          onClose={() => setDinilai(null)}
          onSaved={() => {
            setDinilai(null);
            muat();
          }}
        />
      )}
    </div>
  );
}
