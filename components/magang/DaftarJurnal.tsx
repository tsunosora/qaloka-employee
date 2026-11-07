"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { IconCheck } from "@/components/ui/icons";
import { shortDate } from "@/components/portal/ui";
import { kelompokkanPerAnak } from "@/lib/services/magang/jurnal";

export type JurnalAdmin = {
  id: number;
  tanggal: string;
  pos: string | null;
  posId?: number | null;
  kegiatan: string;
  kendala: string | null;
  jumlahFoto: number;
  komentar: string | null;
  dicek: boolean;
  nama: string;
  pesertaId: number;
  dicekOleh: string | null;
};

/**
 * `apiBase` = awalan rute jurnal: dasbor `/api/magang` (login), halaman pribadi pembimbing
 * `/api/public/portal/<token>/bimbingan` (PIN). Rute di bawahnya sama: `jurnal/<id>` (PATCH),
 * `jurnal/<id>/foto/<n>` (GET), `jurnal/cek` (POST massal).
 */
type Umum = { onDicek: (nama: string) => void; apiBase?: string };

/** Daftar jurnal harian untuk pengawas: baca, lihat foto, beri komentar, tandai sudah dicek. */
export function DaftarJurnal({ items, onDicek, tampilNama = true, apiBase = "/api/magang" }: Umum & { items: JurnalAdmin[]; tampilNama?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((j) => (
        <BarisJurnal key={j.id} j={j} onDicek={onDicek} tampilNama={tampilNama} apiBase={apiBase} />
      ))}
    </ul>
  );
}

/**
 * Jurnal belum dicek DIKELOMPOKKAN per anak (terlipat): satu baris per anak berisi jumlah jurnal, rentang
 * tanggal, jumlah kendala & foto, dan tombol "Tandai semua dicek". Dulu satu kartu per hari per anak →
 * ±30 kartu per minggu untuk 5 anak (temuan simulasi 7 Nov 2026).
 */
export function DaftarJurnalPerAnak({ items, onDicek, apiBase = "/api/magang" }: Umum & { items: JurnalAdmin[] }) {
  const grup = kelompokkanPerAnak(items);
  return (
    <ul className="space-y-2">
      {grup.map((g) => (
        <GrupAnak key={g.pesertaId} nama={g.nama} items={g.items} onDicek={onDicek} apiBase={apiBase} bukaAwal={grup.length === 1} />
      ))}
    </ul>
  );
}

function GrupAnak({ nama, items, onDicek, apiBase, bukaAwal }: Umum & { nama: string; items: JurnalAdmin[]; apiBase: string; bukaAwal: boolean }) {
  const [buka, setBuka] = useState(bukaAwal);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const kendala = items.filter((j) => j.kendala).length;
  const foto = items.reduce((s, j) => s + j.jumlahFoto, 0);
  const pos = [...new Set(items.map((j) => j.pos).filter(Boolean))].join(", ");
  const terbaru = items[0].tanggal;
  const tertua = items[items.length - 1].tanggal;

  async function cekSemua() {
    if (kendala > 0 && !buka && !confirm(`${nama} menulis ${kendala} kendala/pertanyaan. Tandai semua ${items.length} jurnal sudah dicek tanpa membukanya?`)) {
      setBuka(true);
      return;
    }
    setBusy(true);
    setGalat("");
    try {
      await api(`${apiBase}/jurnal/cek`, { method: "POST", body: JSON.stringify({ ids: items.map((j) => j.id) }) });
      onDicek(`${nama} (${items.length} jurnal)`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="glass rounded-2xl">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={buka} onClick={() => setBuka(!buka)}>
          <p className="font-semibold text-fg">
            <span aria-hidden className={`mr-1.5 inline-block text-muted transition-transform ${buka ? "rotate-90" : ""}`}>
              ›
            </span>
            {nama} <span className="font-normal text-muted">· {items.length} jurnal belum dicek</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {tertua === terbaru ? shortDate(terbaru) : `${shortDate(tertua)} – ${shortDate(terbaru)}`}
            {pos && ` · ${pos}`}
            {foto > 0 && ` · ${foto} foto`}
            {kendala > 0 && <span className="font-semibold text-warning"> · {kendala} kendala</span>}
          </p>
        </button>
        <button className="btn-ghost h-9 text-sm" disabled={busy} onClick={cekSemua}>
          <IconCheck /> {busy ? "Menyimpan…" : `Tandai semua dicek (${items.length})`}
        </button>
        {galat && <p className="w-full text-xs text-danger">{galat}</p>}
      </div>
      {buka && (
        <ul className="space-y-2 border-t border-border p-3">
          {items.map((j) => (
            <BarisJurnal key={j.id} j={j} onDicek={onDicek} tampilNama={false} apiBase={apiBase} datar />
          ))}
        </ul>
      )}
    </li>
  );
}

function BarisJurnal({ j, onDicek, tampilNama, apiBase, datar = false }: { j: JurnalAdmin; onDicek: (nama: string) => void; tampilNama: boolean; apiBase: string; datar?: boolean }) {
  const [komentar, setKomentar] = useState(j.komentar ?? "");
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const [besar, setBesar] = useState<number | null>(null);

  async function cek() {
    setBusy(true);
    setGalat("");
    try {
      await api(`${apiBase}/jurnal/${j.id}`, { method: "PATCH", body: JSON.stringify({ komentar: komentar || null }) });
      onDicek(j.nama);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={datar ? "rounded-xl bg-surface-2 p-3" : "glass rounded-2xl p-4"}>
      <p className="font-semibold text-fg">
        {tampilNama && <>{j.nama} · </>}
        <span className={tampilNama ? "font-normal text-muted" : ""}>
          {shortDate(j.tanggal)}
          {j.pos && ` · ${j.pos}`}
        </span>
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{j.kegiatan}</p>
      {j.kendala && (
        <p className="mt-1 text-sm text-warning">
          <b>Kendala:</b> {j.kendala}
        </p>
      )}
      {j.jumlahFoto > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: j.jumlahFoto }, (_, n) => (
            <button key={n} type="button" onClick={() => setBesar(besar === n ? null : n)} aria-label={`Perbesar foto ${n + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-login/PIN */}
              <img src={`${apiBase}/jurnal/${j.id}/foto/${n}`} alt={`Foto ${n + 1}`} loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
            </button>
          ))}
        </div>
      )}
      {besar != null && (
        // eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-login/PIN
        <img src={`${apiBase}/jurnal/${j.id}/foto/${besar}`} alt="Foto diperbesar" className="mt-2 max-h-96 rounded-xl object-contain" />
      )}
      {j.dicek ? (
        <p className="mt-2 text-xs text-success">
          <IconCheck className="inline" /> Dicek{j.dicekOleh ? ` oleh ${j.dicekOleh}` : ""}
          {j.komentar ? ` — ${j.komentar}` : ""}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <input
            className="input h-9 min-w-0 flex-1 text-sm"
            value={komentar}
            maxLength={2000}
            placeholder="Komentar untuk anak (opsional)"
            aria-label={`Komentar untuk ${j.nama}`}
            onChange={(e) => setKomentar(e.target.value)}
          />
          <button className="btn-primary h-9 text-sm" disabled={busy} onClick={cek}>
            <IconCheck /> {busy ? "…" : "Sudah dicek"}
          </button>
          {galat && <p className="w-full text-xs text-danger">{galat}</p>}
        </div>
      )}
    </li>
  );
}
