"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Judul, Kosong, Memuat, Pesan } from "@/components/magang/ui";
import { KartuSekolah, type SekolahAdmin } from "@/components/pantau/KartuSekolah";
import type { JamSekolahData } from "@/components/magang/JamKerjaSekolah";

type DataJam = {
  toleransiUmum: number;
  jamToko: { masuk: string; pulang: string };
  sekolah: { kunci: string; label: string; jumlah: number; jam: JamSekolahData }[];
};

/** Magang → Sekolah: sekolah asal peserta, jam kerja per sekolah, rapor per sekolah, dan tautan pantauan (hanya-baca) untuk guru. */
export default function SekolahMagangPage() {
  const [data, setData] = useState<SekolahAdmin[] | null>(null);
  const [jam, setJam] = useState<DataJam | null>(null);
  const [galat, setGalat] = useState("");

  const muat = useCallback(() => {
    Promise.all([api<{ sekolah: SekolahAdmin[] }>("/api/magang/pantau"), api<DataJam>("/api/magang/jam")]).then(
      ([d, j]) => {
        setData(d.sekolah);
        setJam(j);
        setGalat("");
      },
      (e) => setGalat(e instanceof Error ? e.message : "Gagal memuat sekolah.")
    );
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const jamPer = new Map((jam?.sekolah ?? []).map((s) => [s.kunci, s.jam]));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Judul
        judul="Sekolah"
        keterangan="Sekolah asal anak magang. Atur jam kerja tiap rombongan sekolah, dan buat tautan + PIN supaya guru pembimbing bisa memantau anak sekolahnya sendiri (absensi, jurnal, izin, jadwal pos, nilai) — hanya melihat."
      />
      {galat && <Pesan jenis="galat">{galat}</Pesan>}
      {!data ? (
        !galat && <Memuat baris={2} tinggi="h-40" />
      ) : data.length === 0 ? (
        <Kosong>Belum ada peserta yang mengisi nama sekolah. Isi sekolah di Magang → Peserta.</Kosong>
      ) : (
        data.map((s) => (
          <KartuSekolah
            key={s.kunci}
            s={s}
            onBerubah={muat}
            jamKerja={jam ? { jam: jamPer.get(s.kunci) ?? null, toleransiUmum: jam.toleransiUmum, jamToko: jam.jamToko } : undefined}
          />
        ))
      )}
    </div>
  );
}
