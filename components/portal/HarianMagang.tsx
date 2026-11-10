"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { labelTanggal, hariDalamMinggu, type HarianAnakJson } from "@/lib/services/magang/harian";
import { LencanaLibur, LencanaTugas } from "@/components/magang/harian/ui";

type Data = { peserta: false } | { peserta: true; hariIni: HarianAnakJson | null; berikut: (HarianAnakJson & { besok: boolean }) | null };

/** Teks keadaan tanpa tugas (untuk anak: singkat & jelas). */
function teksKosong(h: HarianAnakJson): string {
  if (h.keadaan === "libur") return "Libur";
  if (h.keadaan === "bukan-hari-kerja") return hariDalamMinggu(h.tanggal) === 0 ? "Hari Minggu — libur" : "Tanggal merah — libur";
  if (h.keadaan === "di-luar-masa") return "Di luar masa magang";
  return "Belum ada jadwal — tanya pembina";
}

function teksRekan(h: HarianAnakJson): string {
  return h.rekan ? `bersama ${h.rekan}` : h.sendiri ? "sendiri" : "";
}

/**
 * Kartu paling atas tab Magang: "Hari ini: KONTEN bersama <rekan>" + hari kerja berikutnya. Tidak ada isi lain.
 * Sumber: GET /api/public/portal/<token>/magang/harian (hanya jadwal anak sendiri).
 */
export function HarianMagang({ token, q }: { token: string; q: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState(false);
  useEffect(() => {
    let hidup = true;
    api<Data>(`/api/public/portal/${token}/magang/harian${q}`).then(
      (d) => hidup && setData(d),
      () => hidup && setGalat(true)
    );
    return () => {
      hidup = false;
    };
  }, [token, q]);

  if (galat) return null;
  if (!data) return <div className="glass h-40 animate-pulse rounded-3xl" />;
  if (!data.peserta || !data.hariIni) return null;
  const h = data.hariIni;
  const b = data.berikut;

  return (
    <section aria-labelledby="harian-judul" className="glass rounded-3xl p-5 sm:p-6">
      <h2 id="harian-judul" className="text-base font-semibold text-muted">
        Hari ini · {labelTanggal(h.tanggal)}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {h.tugas ? (
          <>
            <LencanaTugas tugas={h.tugas} ukuran="besar" />
            {teksRekan(h) && <span className="font-display text-2xl font-bold text-fg">{teksRekan(h)}</span>}
          </>
        ) : h.keadaan === "libur" ? (
          <LencanaLibur ukuran="besar" />
        ) : (
          <p className="font-display text-2xl font-bold text-fg">{teksKosong(h)}</p>
        )}
      </div>
      {b && (
        <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-lg text-fg">
          <span className="font-semibold">
            {b.besok ? `Besok (${labelTanggal(b.tanggal)})` : labelTanggal(b.tanggal)}:
          </span>
          {b.tugas ? (
            <>
              <LencanaTugas tugas={b.tugas} ukuran="sedang" />
              <span>{teksRekan(b)}</span>
            </>
          ) : (
            <span>{teksKosong(b)}</span>
          )}
        </p>
      )}
    </section>
  );
}
