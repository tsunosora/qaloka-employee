"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/fetcher";
import { IconChevronLeft, IconChevronRight, IconCopy, IconPencil, IconSettings } from "@/components/ui/icons";
import { Judul, Kosong, Memuat, Pesan } from "@/components/magang/ui";
import { bentukYmd, labelTanggal, seninH, tambahHariH } from "@/lib/services/magang/harian";
import { LencanaLibur, LencanaTugas } from "@/components/magang/harian/ui";
import { DialogSel } from "@/components/magang/harian/DialogSel";
import { DialogPasangan } from "@/components/magang/harian/DialogPasangan";
import type { DataMinggu, HariJson, PasanganJson, SelJson } from "@/components/magang/harian/tipe";

/**
 * Magang → Jadwal Harian: pasangan anak bergantian KONTEN / PRODUKSI tiap hari kerja. Tabel tanggal × pasangan
 * (≥768 px & cetak), kartu per hari di HP. Klik kotak → ubah hari itu saja (tugas / libur / ganti pasangan satu anak).
 */
export default function JadwalHarianPage() {
  return (
    <Suspense fallback={<Memuat baris={2} tinggi="h-64" />}>
      <JadwalHarian />
    </Suspense>
  );
}

function rentangMinggu(senin: string): string {
  const sabtu = tambahHariH(senin, 5);
  return `${labelTanggal(senin)} – ${labelTanggal(sabtu)} ${sabtu.slice(0, 4)}`;
}

function JadwalHarian() {
  const sp = useSearchParams();
  const awal = sp.get("minggu");
  const [senin, setSenin] = useState<string | null>(() => (awal && bentukYmd(awal) ? seninH(awal) : null));
  const [data, setData] = useState<DataMinggu | null>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [notice, setNotice] = useState("");
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<{ tanggal: string; sel: SelJson; pasangan: PasanganJson } | null>(null);
  const [kelola, setKelola] = useState(false);

  const muat = useCallback(
    () =>
      api<DataMinggu>(`/api/magang/harian${senin ? `?minggu=${senin}` : ""}`).then(
        (d) => {
          setData(d);
          setGalatMuat("");
        },
        (e: unknown) => setGalatMuat(e instanceof Error ? e.message : "Gagal memuat jadwal.")
      ),
    [senin]
  );
  useEffect(() => {
    let hidup = true;
    api<DataMinggu>(`/api/magang/harian${senin ? `?minggu=${senin}` : ""}`).then(
      (d) => {
        if (!hidup) return;
        setData(d);
        setGalatMuat("");
      },
      (e: unknown) => hidup && setGalatMuat(e instanceof Error ? e.message : "Gagal memuat jadwal.")
    );
    return () => {
      hidup = false;
    };
  }, [senin]);
  useEffect(() => {
    if (senin) window.history.replaceState(null, "", `?minggu=${senin}`);
  }, [senin]);

  const sekarang = data?.senin ?? senin;
  const geser = (k: number) => sekarang && setSenin(tambahHariH(sekarang, 7 * k));
  const berubah = (pesan: string) => {
    setBuka(null);
    setGalat("");
    setNotice(pesan);
    void muat();
  };

  async function salinWA() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.teks);
      setGalat("");
      setNotice("Teks jadwal minggu ini tersalin — tempel di grup WhatsApp.");
    } catch {
      setNotice("");
      setGalat("Peramban menolak menyalin. Pilih teks di bawah lalu salin manual.");
    }
  }

  const aktif = data?.pasangan.filter((p) => p.aktif) ?? [];
  const petaPasangan = new Map((data?.pasangan ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Judul
          judul="Jadwal Harian"
          keterangan="Pasangan anak bergantian KONTEN dan PRODUKSI tiap hari kerja (Senin–Sabtu; Minggu & tanggal merah dilewati). Klik kotak untuk mengubah satu hari saja."
          aksi={
            <>
              <button type="button" className="btn-ghost inline-flex h-11 items-center gap-1.5 px-4 text-sm" onClick={() => setKelola(true)}>
                <IconSettings aria-hidden="true" /> Kelola pasangan
              </button>
              <button type="button" className="btn-ghost inline-flex h-11 items-center gap-1.5 px-4 text-sm" onClick={salinWA} disabled={!data || !data.teks}>
                <IconCopy aria-hidden="true" /> Salin untuk WA
              </button>
              <button type="button" className="btn-ghost inline-flex h-11 items-center gap-1.5 px-4 text-sm" onClick={() => window.print()} disabled={!data}>
                <IkonCetak /> Cetak
              </button>
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" className="btn-ghost inline-flex h-11 items-center gap-1 px-3 text-sm" onClick={() => geser(-1)} aria-label="Minggu sebelumnya">
          <IconChevronLeft aria-hidden="true" /> <span className="hidden sm:inline">Sebelumnya</span>
        </button>
        <p className="min-w-0 flex-1 text-center font-display text-base font-bold text-fg sm:flex-none sm:px-2" aria-live="polite">
          {sekarang ? rentangMinggu(sekarang) : "…"}
        </p>
        <button type="button" className="btn-ghost inline-flex h-11 items-center gap-1 px-3 text-sm" onClick={() => geser(1)} aria-label="Minggu berikutnya">
          <span className="hidden sm:inline">Berikutnya</span> <IconChevronRight aria-hidden="true" />
        </button>
        {data && seninH(data.hariIni) !== data.senin && (
          <button type="button" className="btn-ghost h-11 px-3 text-sm" onClick={() => setSenin(seninH(data.hariIni))}>
            Minggu ini
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted print:hidden">
        <LencanaTugas tugas="konten" ukuran="kecil" /> <LencanaTugas tugas="produksi" ukuran="kecil" /> <LencanaLibur ukuran="kecil" />
        <span className="inline-flex items-center gap-1">
          <IconPencil aria-hidden="true" /> = diubah pembina untuk hari itu
        </span>
      </div>

      {notice && <Pesan jenis="ok">{notice}</Pesan>}
      {galat && <Pesan jenis="galat">{galat}</Pesan>}
      {galatMuat && <Pesan jenis="galat">{galatMuat}</Pesan>}
      {!data && !galatMuat && <Memuat baris={2} tinggi="h-48" />}

      {data && aktif.length === 0 && (
        <Kosong>
          Belum ada pasangan aktif.{" "}
          <button type="button" className="font-semibold text-primary underline" onClick={() => setKelola(true)}>
            Buat pasangan
          </button>
        </Kosong>
      )}

      {data && aktif.length > 0 && (
        <>
          <h2 className="hidden font-display text-xl font-bold text-fg print:block">Jadwal harian magang · {rentangMinggu(data.senin)}</h2>
          {/* ≥768 px & cetak: tabel */}
          <div className="glass hidden overflow-x-auto rounded-2xl md:block print:block print:overflow-visible print:rounded-none print:border-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-solid px-3 py-3 text-left font-semibold text-muted print:static">
                    Pasangan
                  </th>
                  {data.hari.map((h) => (
                    <th
                      key={h.tanggal}
                      scope="col"
                      className={`min-w-32 px-2 py-3 text-left font-semibold ${h.tanggal === data.hariIni ? "bg-primary/10 text-fg print:bg-transparent" : "text-muted"}`}
                      aria-current={h.tanggal === data.hariIni ? "date" : undefined}
                    >
                      <span className="block font-display text-sm text-fg">{labelTanggal(h.tanggal)}</span>
                      {h.tanggal === data.hariIni && <span className="block text-xs font-bold text-primary print:hidden">Hari ini</span>}
                      {h.libur && <span className="block text-xs text-danger">{h.libur}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aktif.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <th scope="row" className="sticky left-0 z-10 bg-solid px-3 py-3 text-left align-top print:static">
                      <span className="block font-semibold text-fg">{p.nama || (p.namaB ? `${p.namaA} & ${p.namaB}` : p.namaA)}</span>
                      <span className="block text-xs font-normal text-muted">{p.nama ? (p.namaB ? `${p.namaA} & ${p.namaB}` : `${p.namaA} (sendiri)`) : p.namaB ? "" : "sendiri"}</span>
                    </th>
                    {data.hari.map((h) => {
                      const sel = h.sel.find((s) => s.pasanganId === p.id);
                      return (
                        <td key={h.tanggal} className={`px-1.5 py-1.5 align-top ${h.tanggal === data.hariIni ? "bg-primary/5 print:bg-transparent" : ""}`}>
                          {sel && <IsiSel sel={sel} hari={h} onBuka={() => setBuka({ tanggal: h.tanggal, sel, pasangan: p })} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* <768 px: kartu per hari */}
          <div className="space-y-3 md:hidden print:hidden">
            {data.hari.map((h) => (
              <section key={h.tanggal} className={`glass rounded-2xl p-3 ${h.tanggal === data.hariIni ? "ring-2 ring-primary" : ""}`} aria-current={h.tanggal === data.hariIni ? "date" : undefined}>
                <h3 className="flex flex-wrap items-baseline justify-between gap-2 px-1 pb-2">
                  <span className="font-display text-base font-bold text-fg">{labelTanggal(h.tanggal)}</span>
                  {h.tanggal === data.hariIni && <span className="text-xs font-bold text-primary">Hari ini</span>}
                  {h.libur && <span className="text-xs text-danger">{h.libur}</span>}
                </h3>
                <ul className="space-y-2">
                  {aktif.map((p) => {
                    const sel = h.sel.find((s) => s.pasanganId === p.id);
                    if (!sel) return null;
                    return (
                      <li key={p.id}>
                        <p className="px-1 pb-1 text-sm font-semibold text-fg">{p.nama || (p.namaB ? `${p.namaA} & ${p.namaB}` : `${p.namaA} (sendiri)`)}</p>
                        <IsiSel sel={sel} hari={h} onBuka={() => setBuka({ tanggal: h.tanggal, sel, pasangan: p })} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {data.teks && (
            <details className="glass rounded-2xl p-4 text-sm print:hidden">
              <summary className="min-h-11 cursor-pointer content-center font-semibold text-fg">Lihat teks untuk WhatsApp</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-muted">{data.teks}</pre>
            </details>
          )}
        </>
      )}

      {buka && data && (
        <DialogSel
          tanggal={buka.tanggal}
          sel={buka.sel}
          pasangan={petaPasangan.get(buka.pasangan.id) ?? buka.pasangan}
          anak={data.anak}
          onClose={() => setBuka(null)}
          onBerubah={berubah}
        />
      )}
      {kelola && data && (
        <DialogPasangan
          pasangan={data.pasangan}
          anak={data.anak}
          hariIni={data.hariIni}
          onClose={() => setKelola(false)}
          onBerubah={(p) => {
            setNotice(p);
            setGalat("");
            void muat();
          }}
        />
      )}
    </div>
  );
}

/** Isi satu kotak: lencana tugas pasangan + penyimpangan per anak (ganti rekan / sendiri / libur). Tombol ≥44 px. */
function IsiSel({ sel, hari, onBuka }: { sel: SelJson; hari: HariJson; onBuka: () => void }) {
  const bisa = hari.hariKerja && sel.keadaan !== "di-luar-masa";
  const catatanAnak = sel.anggota.filter((a) => a.diubah || a.sendiri || (a.keadaan !== "tugas" && sel.keadaan === "tugas"));
  const isi = (
    <>
      <span className="flex items-center gap-1.5">
        {sel.keadaan === "tugas" && sel.tugas ? (
          <LencanaTugas tugas={sel.tugas} />
        ) : sel.keadaan === "libur" ? (
          <LencanaLibur />
        ) : sel.keadaan === "bukan-hari-kerja" ? (
          <LencanaLibur label={hari.libur ? "TANGGAL MERAH" : "LIBUR"} />
        ) : (
          <span className="text-xs text-subtle">di luar masa magang</span>
        )}
        {sel.sumber === "pengecualian" && <IconPencil aria-label="diubah pembina" className="shrink-0 text-muted" />}
      </span>
      {catatanAnak.map((a) => (
        <span key={a.pesertaId} className="block text-xs text-muted">
          <b className="text-fg">{a.panggilan}</b>:{" "}
          {a.keadaan === "libur" ? "libur" : a.keadaan === "di-luar-masa" ? "di luar masa" : a.keadaan !== "tugas" ? "—" : a.rekan ? `bersama ${a.rekan}` : "sendiri"}
          {a.keadaan === "tugas" && a.tugas && a.tugas !== sel.tugas && ` · ${a.tugas === "konten" ? "KONTEN" : "PRODUKSI"}`}
        </span>
      ))}
      {sel.catatan && <span className="block truncate text-xs italic text-muted" title={sel.catatan}>{sel.catatan}</span>}
    </>
  );
  if (!bisa) return <div className="min-h-11 space-y-1 px-1.5 py-1.5">{isi}</div>;
  return (
    <button type="button" onClick={onBuka} className="block min-h-11 w-full space-y-1 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-surface-2 focus-visible:bg-surface-2 print:p-0">
      {isi}
    </button>
  );
}

const IkonCetak = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 9V3h10v6" />
    <rect x="3" y="9" width="18" height="8" rx="1.5" />
    <path d="M7 14h10v7H7z" />
  </svg>
);
