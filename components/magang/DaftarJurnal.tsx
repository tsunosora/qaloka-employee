"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { IconCheck } from "@/components/ui/icons";
import { shortDate } from "@/components/portal/ui";

export type JurnalAdmin = {
  id: number;
  tanggal: string;
  pos: string | null;
  kegiatan: string;
  kendala: string | null;
  jumlahFoto: number;
  komentar: string | null;
  dicek: boolean;
  nama: string;
  pesertaId: number;
  dicekOleh: string | null;
};

/** Daftar jurnal harian untuk pengawas: baca, lihat foto, beri komentar, tandai sudah dicek. */
export function DaftarJurnal({ items, onDicek, tampilNama = true }: { items: JurnalAdmin[]; onDicek: (nama: string) => void; tampilNama?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((j) => (
        <BarisJurnal key={j.id} j={j} onDicek={onDicek} tampilNama={tampilNama} />
      ))}
    </ul>
  );
}

function BarisJurnal({ j, onDicek, tampilNama }: { j: JurnalAdmin; onDicek: (nama: string) => void; tampilNama: boolean }) {
  const [komentar, setKomentar] = useState(j.komentar ?? "");
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const [besar, setBesar] = useState<number | null>(null);

  async function cek() {
    setBusy(true);
    setGalat("");
    try {
      await api(`/api/magang/jurnal/${j.id}`, { method: "PATCH", body: JSON.stringify({ komentar: komentar || null }) });
      onDicek(j.nama);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="glass rounded-2xl p-4">
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
              {/* eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-login */}
              <img src={`/api/magang/jurnal/${j.id}/foto/${n}`} alt={`Foto ${n + 1}`} loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
            </button>
          ))}
        </div>
      )}
      {besar != null && (
        // eslint-disable-next-line @next/next/no-img-element -- foto pribadi lewat rute ber-login
        <img src={`/api/magang/jurnal/${j.id}/foto/${besar}`} alt="Foto diperbesar" className="mt-2 max-h-96 rounded-xl object-contain" />
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
