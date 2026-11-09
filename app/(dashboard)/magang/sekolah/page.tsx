"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Judul, Kosong, Memuat, Pesan } from "@/components/magang/ui";
import { KartuSekolah, type SekolahAdmin } from "@/components/pantau/KartuSekolah";

/** Magang → Sekolah: sekolah asal peserta, rapor per sekolah, dan tautan pantauan (hanya-baca) untuk guru. */
export default function SekolahMagangPage() {
  const [data, setData] = useState<SekolahAdmin[] | null>(null);
  const [galat, setGalat] = useState("");

  const muat = useCallback(() => {
    api<{ sekolah: SekolahAdmin[] }>("/api/magang/pantau").then(
      (d) => {
        setData(d.sekolah);
        setGalat("");
      },
      (e) => setGalat(e instanceof Error ? e.message : "Gagal memuat sekolah.")
    );
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Judul
        judul="Sekolah"
        keterangan="Sekolah asal anak magang. Buat tautan + PIN supaya guru pembimbing bisa memantau anak sekolahnya sendiri (absensi, jurnal, izin, jadwal pos, nilai) — hanya melihat."
      />
      {galat && <Pesan jenis="galat">{galat}</Pesan>}
      {!data ? (
        !galat && <Memuat baris={2} tinggi="h-40" />
      ) : data.length === 0 ? (
        <Kosong>Belum ada peserta yang mengisi nama sekolah. Isi sekolah di Magang → Peserta.</Kosong>
      ) : (
        data.map((s) => <KartuSekolah key={s.kunci} s={s} onBerubah={muat} />)
      )}
    </div>
  );
}
