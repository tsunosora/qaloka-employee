"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { IconCheck, IconLink, IconX } from "@/components/ui/icons";
import { shortDate } from "@/components/portal/ui";

/** Bentuk satu baris GET /api/magang/misi/kiriman (lib/services/magang/misi-db.ts → daftarKiriman). */
export type KirimanAdmin = {
  id: number;
  misiId: number;
  pesertaId: number;
  teks: string | null;
  tautan: string | null;
  jumlahFoto: number;
  status: string;
  catatan: string | null;
  kirimKe: number;
  dikirimAt: string;
  diputusAt: string | null;
  diputusOleh: string | null;
  misi: { id: number; judul: string; kategoriLabel: string; levelLabel: string; poin: number; deskripsi: string | null };
  peserta: { id: number; nama: string; sekolah: string | null };
};

/** ISO → "YYYY-MM-DD" zona lokal browser. */
function ymdLokal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Satu bukti side quest yang menunggu: isi kiriman anak + Setujui / Tolak. Tolak WAJIB catatan (tampil di
 * HP anak supaya dia tahu apa yang diperbaiki). `onPutus` dipanggil sesudah berhasil (induk memuat ulang).
 */
export function KartuKiriman({ k, onPutus }: { k: KirimanAdmin; onPutus: (pesan: string) => void }) {
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState<"setujui" | "tolak" | null>(null);
  const [galat, setGalat] = useState("");
  const [besar, setBesar] = useState<number | null>(null);
  const idCatatan = `catatan-kiriman-${k.id}`;
  const idGalat = `galat-kiriman-${k.id}`;

  async function putus(aksi: "setujui" | "tolak") {
    const c = catatan.trim();
    if (aksi === "tolak" && !c) {
      setGalat("Tulis dulu apa yang perlu diperbaiki — catatan ini dibaca anak di HP-nya.");
      document.getElementById(idCatatan)?.focus();
      return;
    }
    setBusy(aksi);
    setGalat("");
    try {
      await api(`/api/magang/misi/kiriman/${k.id}`, { method: "PATCH", body: JSON.stringify({ aksi, catatan: c || null }) });
      onPutus(aksi === "setujui" ? `Misi "${k.misi.judul}" dari ${k.peserta.nama} disetujui.` : `Bukti ${k.peserta.nama} dikembalikan dengan catatan perbaikan.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-fg">
            {k.peserta.nama}
            {k.peserta.sekolah && <span className="font-normal text-muted"> · {k.peserta.sekolah}</span>}
          </p>
          <p className="text-sm text-fg">
            {k.misi.judul}{" "}
            <span className="text-muted">
              · {k.misi.kategoriLabel} · {k.misi.levelLabel} · {k.misi.poin} poin
            </span>
          </p>
        </div>
        <p className="text-xs text-muted">
          Dikirim {shortDate(ymdLokal(k.dikirimAt))}
          {k.kirimKe > 1 && <span className="font-semibold text-warning"> · kiriman ke-{k.kirimKe}</span>}
        </p>
      </div>

      {k.kirimKe > 1 && k.catatan && (
        <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          <b className="text-fg">Catatan perbaikan sebelumnya:</b> {k.catatan}
        </p>
      )}
      {k.teks && <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{k.teks}</p>}
      {k.tautan && (
        <p className="mt-2 text-sm">
          {/* Tautan sudah divalidasi http/https di server (tautanSah). */}
          <a href={k.tautan} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all font-semibold text-primary hover:underline">
            <IconLink className="shrink-0" /> {k.tautan}
          </a>
        </p>
      )}
      {k.jumlahFoto > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: k.jumlahFoto }, (_, n) => (
            <button key={n} type="button" onClick={() => setBesar(besar === n ? null : n)} aria-label={`Perbesar foto ${n + 1}`} aria-pressed={besar === n}>
              {/* eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-login */}
              <img src={`/api/magang/misi/kiriman/${k.id}/foto/${n}`} alt={`Foto bukti ${n + 1}`} loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
            </button>
          ))}
        </div>
      )}
      {besar != null && (
        // eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-login
        <img src={`/api/magang/misi/kiriman/${k.id}/foto/${besar}`} alt="Foto bukti diperbesar" className="mt-2 max-h-96 rounded-xl object-contain" />
      )}

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <label htmlFor={idCatatan} className="block text-sm font-semibold text-fg">
          Catatan untuk anak <span className="font-normal text-muted">(wajib bila ditolak)</span>
        </label>
        <textarea
          id={idCatatan}
          className="input min-h-16 py-2 text-sm"
          value={catatan}
          maxLength={2000}
          placeholder="mis. Bagus! Atau: fotonya buram, ulangi dengan cahaya terang."
          aria-describedby={galat ? idGalat : undefined}
          onChange={(e) => setCatatan(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary h-11 flex-1 text-sm sm:flex-none" disabled={busy != null} onClick={() => putus("setujui")}>
            <IconCheck /> {busy === "setujui" ? "Menyimpan…" : "Setujui"}
          </button>
          <button className="btn-ghost h-11 flex-1 text-sm text-danger sm:flex-none" disabled={busy != null} onClick={() => putus("tolak")}>
            <IconX /> {busy === "tolak" ? "Menyimpan…" : "Tolak, minta perbaikan"}
          </button>
        </div>
        {galat && (
          <p id={idGalat} role="alert" className="text-sm text-danger">
            {galat}
          </p>
        )}
      </div>
    </li>
  );
}
