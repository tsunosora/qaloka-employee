"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconCheck } from "@/components/ui/icons";
import { Card, soft } from "@/components/portal/ui";
import { BuktiTerkirim, FOKUS } from "@/components/portal/SideQuestMagang";
import { ringkasBukti } from "@/components/portal/sideQuest";
import type { JenisBukti } from "@/lib/services/magang/misi";

type Kiriman = {
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
  misi: { judul: string; kategoriLabel: string; levelLabel: string; deskripsi: string | null; bukti: JenisBukti[]; poin: number };
  peserta: { id: number; nama: string; sekolah: string | null };
};

const tglSingkat = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

/**
 * "Bukti side quest menunggu" di tab Bimbingan: semua pembimbing pos aktif boleh memutus. Setujui
 * langsung; Perbaiki (tolak) wajib dengan catatan untuk anaknya. Item hilang dari daftar setelah
 * diputus. Mode owner (bacaSaja) hanya melihat — server juga menolak 403.
 */
export function SideQuestBimbingan({ apiBase, q, bacaSaja }: { apiBase: string; q: string; bacaSaja: boolean }) {
  const [kiriman, setKiriman] = useState<Kiriman[] | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");

  const ambil = useCallback(() => api<{ kiriman: Kiriman[] }>(`${apiBase}/misi${q}`), [apiBase, q]);
  useEffect(() => {
    let hidup = true;
    ambil().then(
      (d) => hidup && setKiriman(d.kiriman),
      (e) => hidup && setGalat(e instanceof Error ? e.message : "Gagal memuat bukti side quest.")
    );
    return () => {
      hidup = false;
    };
  }, [ambil]);

  const hapus = (id: number, teks: string) => {
    setKiriman((xs) => (xs ? xs.filter((x) => x.id !== id) : xs));
    setPesan(teks);
  };

  return (
    <Card title={`Bukti side quest menunggu${kiriman ? ` (${kiriman.length})` : ""}`}>
      <p role="status" className={pesan ? "mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-success" : "sr-only"} style={pesan ? soft("var(--success)") : undefined}>
        {pesan && (
          <>
            <IconCheck className="shrink-0" aria-hidden="true" /> {pesan}
          </>
        )}
      </p>
      {galat ? (
        <p className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
          <IconAlert className="shrink-0" aria-hidden="true" /> {galat}
        </p>
      ) : !kiriman ? (
        <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
      ) : kiriman.length === 0 ? (
        <p className="text-sm text-muted">Tidak ada bukti side quest yang menunggu dicek.</p>
      ) : (
        <ul className="space-y-3">
          {kiriman.map((k) => (
            <ItemKiriman key={k.id} k={k} apiBase={apiBase} q={q} bacaSaja={bacaSaja} onPutus={hapus} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ItemKiriman({
  k,
  apiBase,
  q,
  bacaSaja,
  onPutus,
}: {
  k: Kiriman;
  apiBase: string;
  q: string;
  bacaSaja: boolean;
  onPutus: (id: number, pesan: string) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<"awal" | "tolak">("awal");
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState<"setujui" | "tolak" | null>(null);
  const [galat, setGalat] = useState("");
  const [galatCatatan, setGalatCatatan] = useState("");
  const fotoUrl = (n: number) => `${apiBase}/misi/${k.id}/foto/${n}${q}`;

  async function putus(aksi: "setujui" | "tolak") {
    setGalat("");
    if (aksi === "tolak" && !catatan.trim()) {
      setGalatCatatan("Tulis apa yang perlu diperbaiki.");
      return;
    }
    setBusy(aksi);
    try {
      await api(`${apiBase}/misi/${k.id}${q}`, {
        method: "PATCH",
        body: JSON.stringify({ aksi, catatan: catatan.trim() || null }),
      });
      onPutus(
        k.id,
        aksi === "setujui" ? `Misi "${k.misi.judul}" ${k.peserta.nama} disetujui.` : `Catatan perbaikan terkirim ke ${k.peserta.nama}.`
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : "Gagal menyimpan keputusan.";
      if (/sudah diputus/i.test(m)) onPutus(k.id, `Kiriman ${k.peserta.nama} sudah diputus pembimbing lain.`);
      else setGalat(m);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-xl bg-surface-2 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-fg">{k.peserta.nama}</p>
          <p className="text-xs text-muted">{k.peserta.sekolah || "Sekolah belum diisi"}</p>
        </div>
        <span className="tabular shrink-0 text-xs font-semibold text-muted">{k.misi.poin} poin</span>
      </div>

      <p className="mt-2 font-medium text-fg">{k.misi.judul}</p>
      <p className="text-xs text-muted">
        {k.misi.kategoriLabel} · {k.misi.levelLabel} · {ringkasBukti(k.misi.bukti)} · dikirim {tglSingkat(k.dikirimAt)}
        {k.kirimKe > 1 && <span className="font-semibold text-fg"> · kiriman ke-{k.kirimKe}</span>}
      </p>
      {k.kirimKe > 1 && k.catatan && <p className="mt-1.5 text-xs text-muted">Catatan sebelumnya: {k.catatan}</p>}

      <div className="mt-2 border-t border-border pt-2">
        <BuktiTerkirim kiriman={k} fotoUrl={fotoUrl} />
      </div>

      {galat && (
        <p role="alert" className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-danger" style={soft("var(--danger)")}>
          <IconAlert className="shrink-0" aria-hidden="true" /> {galat}
        </p>
      )}

      {!bacaSaja &&
        (mode === "awal" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className={`btn-primary h-11 text-sm ${FOKUS}`} disabled={!!busy} aria-busy={busy === "setujui"} onClick={() => putus("setujui")}>
              {busy === "setujui" ? "Menyimpan…" : "Setujui"}
            </button>
            <button type="button" className={`btn-ghost h-11 text-sm ${FOKUS}`} disabled={!!busy} onClick={() => setMode("tolak")}>
              Perbaiki
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <label htmlFor={`${id}-catatan`} className="block text-sm font-semibold text-fg">
              Apa yang perlu diperbaiki? <span className="text-xs font-normal text-muted">(wajib, dibaca anaknya)</span>
            </label>
            <textarea
              id={`${id}-catatan`}
              autoFocus
              className={`input min-h-20 py-2 ${galatCatatan ? "border-danger" : ""}`}
              value={catatan}
              maxLength={2000}
              placeholder="mis. Fotonya buram, ulangi dengan cahaya cukup."
              aria-invalid={!!galatCatatan}
              aria-describedby={galatCatatan ? `${id}-catatan-galat` : undefined}
              onChange={(e) => {
                setCatatan(e.target.value);
                setGalatCatatan("");
              }}
            />
            {galatCatatan && (
              <p id={`${id}-catatan-galat`} className="flex items-center gap-1.5 text-xs font-medium text-danger">
                <IconAlert className="shrink-0" aria-hidden="true" /> {galatCatatan}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`btn-primary h-11 text-sm ${FOKUS}`} disabled={!!busy} aria-busy={busy === "tolak"} onClick={() => putus("tolak")}>
                {busy === "tolak" ? "Mengirim…" : "Kirim catatan"}
              </button>
              <button
                type="button"
                className={`btn-ghost h-11 text-sm ${FOKUS}`}
                disabled={!!busy}
                onClick={() => {
                  setMode("awal");
                  setGalatCatatan("");
                }}
              >
                Batal
              </button>
            </div>
          </div>
        ))}
    </li>
  );
}
