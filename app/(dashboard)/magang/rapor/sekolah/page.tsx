"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconChevronLeft, IconDownload } from "@/components/ui/icons";
import { RaporIsi, type RaporPayload } from "@/components/magang/RaporIsi";
import { Judul, Kosong, Memuat, Pesan } from "@/components/magang/ui";
import { daftarSekolah, kunciSekolah, sekolahSama } from "@/lib/services/magang/sekolah";

type PesertaRingkas = { id: number; nama: string; sekolah: string | null; aktif: boolean };

/** Ambil rapor beberapa anak, paling banyak 4 permintaan sekaligus (urutan hasil = urutan id). */
async function ambilRapor(ids: number[]): Promise<RaporPayload[]> {
  const hasil: RaporPayload[] = new Array(ids.length);
  let i = 0;
  const pekerja = async () => {
    while (i < ids.length) {
      const k = i++;
      hasil[k] = await api<RaporPayload>(`/api/magang/peserta/${ids[k]}/rapor`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, pekerja));
  return hasil;
}

/** Cetak rapor satu sekolah sekaligus: tiap anak satu (atau lebih) halaman, dipisah page break. */
function CetakPerSekolah() {
  const awal = useSearchParams().get("sekolah") ?? "";
  const [peserta, setPeserta] = useState<PesertaRingkas[] | null>(null);
  const [kunci, setKunci] = useState(kunciSekolah(awal));
  const [ikutNonaktif, setIkutNonaktif] = useState(false);
  const [rapor, setRapor] = useState<{ kunci: string; nonaktif: boolean; items: RaporPayload[] } | null>(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let hidup = true;
    api<{ peserta: PesertaRingkas[] }>("/api/magang/peserta").then(
      (d) => hidup && setPeserta(d.peserta),
      (e) => hidup && setGalat(e instanceof Error ? e.message : "Gagal memuat peserta.")
    );
    return () => {
      hidup = false;
    };
  }, []);

  const pilihan = peserta ? daftarSekolah(peserta.map((p) => p.sekolah)) : [];
  const dipilih = pilihan.find((s) => s.kunci === kunci) ?? null;
  const anak = dipilih && peserta ? peserta.filter((p) => sekolahSama(p.sekolah, dipilih.kunci) && (ikutNonaktif || p.aktif)) : [];
  const nonaktifDiSekolah = dipilih && peserta ? peserta.filter((p) => sekolahSama(p.sekolah, dipilih.kunci) && !p.aktif).length : 0;
  const idsKunci = anak.map((p) => p.id).join(",");

  useEffect(() => {
    if (!idsKunci) return;
    let hidup = true;
    const k = kunci;
    const n = ikutNonaktif;
    ambilRapor(idsKunci.split(",").map(Number)).then(
      (items) => hidup && setRapor({ kunci: k, nonaktif: n, items }),
      (e) => hidup && setGalat(e instanceof Error ? e.message : "Gagal memuat rapor.")
    );
    return () => {
      hidup = false;
    };
  }, [idsKunci, kunci, ikutNonaktif]);

  const siap = rapor && rapor.kunci === kunci && rapor.nonaktif === ikutNonaktif ? rapor.items : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-4 print:hidden">
        <Link href="/magang" className="btn-ghost h-11 px-3 text-sm">
          <IconChevronLeft /> Minggu Ini
        </Link>
        <Judul
          judul="Cetak rapor per sekolah"
          keterangan="Pilih sekolah, lalu cetak. Rapor tiap anak dimulai di halaman baru — cocok untuk diserahkan ke guru pembimbing sekaligus."
        />
        {galat && <Pesan jenis="galat">{galat}</Pesan>}
        {!peserta ? (
          !galat && <Memuat baris={1} tinggi="h-20" />
        ) : pilihan.length === 0 ? (
          <Kosong>Belum ada peserta yang mengisi nama sekolah. Isi sekolah di Magang → Peserta.</Kosong>
        ) : (
          <div className="glass flex flex-wrap items-end gap-4 rounded-2xl p-4">
            <label className="block min-w-60 flex-1">
              <span className="text-sm font-semibold text-fg">Sekolah</span>
              <select className="input mt-1.5 h-11" value={dipilih?.kunci ?? ""} onChange={(e) => setKunci(e.target.value)}>
                <option value="">— pilih sekolah —</option>
                {pilihan.map((s) => (
                  <option key={s.kunci} value={s.kunci}>
                    {s.label} ({s.jumlah} anak)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={ikutNonaktif} onChange={(e) => setIkutNonaktif(e.target.checked)} />
              Ikut sertakan peserta nonaktif{dipilih ? ` (${nonaktifDiSekolah})` : ""}
            </label>
            <button className="btn-primary h-11 text-sm" disabled={!siap || siap.length === 0} onClick={() => window.print()}>
              <IconDownload /> Cetak / simpan PDF{siap && siap.length > 0 ? ` (${siap.length} rapor)` : ""}
            </button>
          </div>
        )}
        {dipilih && anak.length === 0 && <Kosong>Tidak ada peserta aktif dari sekolah ini. Centang &quot;Ikut sertakan peserta nonaktif&quot; untuk peserta yang sudah selesai.</Kosong>}
      </div>

      {dipilih && anak.length > 0 && !siap && !galat && (
        <div role="status" className="print:hidden">
          <p className="mb-2 text-sm text-muted">Menyiapkan {anak.length} rapor…</p>
          <Memuat baris={2} tinggi="h-48" />
        </div>
      )}

      {siap && siap.length > 0 && (
        <div className="space-y-8 print:space-y-0">
          {siap.map((d, i) => (
            // break-after: page → tiap anak mulai di halaman baru saat dicetak (kecuali yang terakhir).
            <div key={d.peserta.id} style={i < siap.length - 1 ? { breakAfter: "page" } : undefined}>
              <RaporIsi data={d} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CetakRaporSekolahPage() {
  return (
    <Suspense fallback={<Memuat baris={1} tinggi="h-20" />}>
      <CetakPerSekolah />
    </Suspense>
  );
}
