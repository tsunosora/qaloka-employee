"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { PILIHAN_HARI_TUGAS, namaHariTugas } from "@/lib/services/magang/nilai";

/**
 * Setelan hari dibukanya tugas mengingat (Senin–Sabtu). Tersimpan begitu dipilih; batas tepat
 * waktu tetap Senin berikutnya.
 */
export function SetelanHariTugas({ hariTugas, onSaved }: { hariTugas: number; onSaved: (namaHari: string) => void }) {
  const [nilai, setNilai] = useState(hariTugas);
  const [simpan, setSimpan] = useState(false);
  const [galat, setGalat] = useState("");

  const ganti = async (baru: number) => {
    const lama = nilai;
    setNilai(baru);
    setSimpan(true);
    setGalat("");
    try {
      const r = await api<{ hariTugas: number; namaHari: string }>("/api/magang/setelan", {
        method: "PUT",
        body: JSON.stringify({ hariTugas: baru }),
      });
      setNilai(r.hariTugas);
      onSaved(r.namaHari);
    } catch (e) {
      setNilai(lama);
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan setelan.");
    } finally {
      setSimpan(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="text-sm font-bold text-fg">Setelan tugas mengingat</h2>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label htmlFor="hari-tugas" className="text-sm text-fg">
          Dibuka tiap hari
        </label>
        <select
          id="hari-tugas"
          className="input h-11 w-auto text-sm"
          value={nilai}
          disabled={simpan}
          aria-describedby="hari-tugas-bantu"
          onChange={(e) => ganti(Number(e.target.value))}
        >
          {PILIHAN_HARI_TUGAS.map((h) => (
            <option key={h.nilai} value={h.nilai}>
              {h.label}
            </option>
          ))}
        </select>
        {simpan && <span className="text-xs text-muted">Menyimpan…</span>}
      </div>
      <p id="hari-tugas-bantu" className="mt-2 text-xs text-muted">
        Anak bisa mengisi mulai hari {namaHariTugas(nilai)} sampai Senin berikutnya; sesudah itu masih bisa, tapi ditandai terlambat.
      </p>
      {galat && <p className="mt-1 text-xs text-danger">{galat}</p>}
    </section>
  );
}
