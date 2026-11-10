"use client";

import { useId, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconAlert } from "@/components/ui/icons";
import { bulanSah, namaBulan, namaTanggal, warnaSelKode } from "@/lib/services/magang/konten";
import { FOKUS, latarWarna, type DataKonten, type Rencana } from "@/components/magang/konten/tipe";

const ALASAN: Record<string, string> = { libur: "libur", "sudah-ada": "sudah ada baris", "tanpa-pola": "tidak ada pola untuk hari itu" };

/**
 * "Buat jadwal bulan berikut": pilih bulan → pratinjau (tidak menulis apa pun) → simpan. Baris baru berstatus
 * awal & berlencana Usulan. Bawaan hanya mengisi tanggal kosong; "ganti" menghapus baris yang belum dikerjakan.
 */
export function DialogBuatBulan({ data, bulanAwal, onClose, onTersimpan }: { data: DataKonten; bulanAwal: string; onClose: () => void; onTersimpan: (bulan: string, dibuat: number) => void }) {
  const id = useId();
  const [bulan, setBulan] = useState(bulanAwal);
  const [ganti, setGanti] = useState(false);
  const [rencana, setRencana] = useState<Rencana | null>(null);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const konsep = new Map(data.konsep.map((k) => [k.id, k]));
  const grup = new Map(data.grup.map((g) => [g.id, g]));
  const anak = new Map(data.anak.map((a) => [a.pesertaId, a]));

  async function kirim(simpan: boolean) {
    if (!bulanSah(bulan)) return setGalat("Pilih bulannya dulu.");
    setBusy(true);
    setGalat("");
    try {
      if (!simpan) setRencana(await api<Rencana>("/api/magang/konten/buat", { method: "POST", body: JSON.stringify({ bulan, ganti, simpan: false }) }));
      else {
        const r = await api<{ dibuat: number }>("/api/magang/konten/buat", { method: "POST", body: JSON.stringify({ bulan, ganti, simpan: true }) });
        onTersimpan(bulan, r.dibuat);
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyusun jadwal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Buat jadwal bulan berikut" size="xl" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Jadwal disusun dari pola hari (Setelan → Pola hari). Kode anak melanjutkan giliran bulan sebelumnya; hari grup tiap {data.pola.selangHari} hari di hari Sabtu,
          bergiliran sesuai urutan grup. Minggu & hari libur dilewati. Baris baru bertanda <b className="text-warning">Usulan</b> sampai Anda setujui.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`${id}-b`} className="block text-xs font-semibold text-muted">
              Bulan
            </label>
            <input
              id={`${id}-b`}
              type="month"
              className="input mt-1 h-10 w-44"
              value={bulan}
              onChange={(e) => {
                setBulan(e.target.value);
                setRencana(null);
              }}
            />
          </div>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={ganti}
              onChange={(e) => {
                setGanti(e.target.checked);
                setRencana(null);
              }}
            />
            Ganti baris yang belum dikerjakan
          </label>
          <button type="button" className={`btn-ghost h-10 px-4 text-sm ${FOKUS}`} disabled={busy} onClick={() => kirim(false)}>
            {busy && !rencana ? "Menyusun…" : "Lihat pratinjau"}
          </button>
        </div>
        {ganti && <p className="text-xs text-muted">Baris yang sudah ada judul, tautan, caption, catatan, atau statusnya sudah berubah TIDAK dihapus.</p>}

        {galat && (
          <p role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2 text-danger" style={{ background: "color-mix(in oklab, var(--danger) 14%, transparent)" }}>
            <IconAlert className="shrink-0" aria-hidden="true" /> {galat}
          </p>
        )}

        {rencana && (
          <div className="space-y-3">
            <p role="status" className="font-semibold text-fg">
              {namaBulan(rencana.bulan)}: {rencana.baris.length} baris baru
              {rencana.hapus.length > 0 && ` · ${rencana.hapus.length} baris lama diganti`}
              {rencana.dipertahankan > 0 && ` · ${rencana.dipertahankan} baris dipertahankan`}
            </p>
            {rencana.masalah.length > 0 && (
              <ul className="space-y-1 rounded-xl px-3 py-2 text-xs text-fg" style={{ background: "color-mix(in oklab, var(--warning) 16%, transparent)" }}>
                {rencana.masalah.map((m) => (
                  <li key={m} className="flex gap-1.5">
                    <IconAlert className="mt-0.5 shrink-0 text-warning" aria-hidden="true" /> {m}
                  </li>
                ))}
              </ul>
            )}
            {rencana.baris.length > 0 ? (
              <div className="max-h-[45vh] overflow-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wide text-muted">
                      <th scope="col" className="sticky top-0 px-2 py-1.5" style={{ background: "var(--solid)" }}>
                        Tanggal
                      </th>
                      <th scope="col" className="sticky top-0 px-2 py-1.5" style={{ background: "var(--solid)" }}>
                        Klasifikasi konsep
                      </th>
                      <th scope="col" className="sticky top-0 px-2 py-1.5 text-center" style={{ background: "var(--solid)" }}>
                        Code
                      </th>
                      <th scope="col" className="sticky top-0 px-2 py-1.5" style={{ background: "var(--solid)" }}>
                        Nama PKL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rencana.baris.map((b) => {
                      const k = konsep.get(b.konsepId);
                      const g = b.grupId != null ? grup.get(b.grupId) : undefined;
                      const a = b.pesertaId != null ? anak.get(b.pesertaId) : undefined;
                      const hex = warnaSelKode(k?.warna, g ? g.warna : null);
                      return (
                        <tr key={b.tanggal} className="border-t border-border">
                          <td className="whitespace-nowrap px-2 py-1 text-fg">{namaTanggal(b.tanggal)}</td>
                          <td className="px-2 py-1 font-semibold text-fg" style={latarWarna(k?.warna, 40)}>
                            {k?.label}
                          </td>
                          <td className="px-2 py-1 text-center font-bold text-fg" style={hex ? { background: `color-mix(in oklab, ${hex} 42%, transparent)` } : undefined}>
                            {g ? g.nama : (b.kode ?? "–")}
                          </td>
                          <td className="px-2 py-1 text-fg">{g ? g.anggota.map((p) => anak.get(p)?.panggilan).filter(Boolean).join(", ") : (a?.panggilan ?? "belum dibagi")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">Tidak ada baris baru — semua tanggal bulan itu sudah terisi.</p>
            )}
            {rencana.dilewati.filter((d) => d.alasan !== "sudah-ada").length > 0 && (
              <p className="text-xs text-muted">
                Dilewati:{" "}
                {rencana.dilewati
                  .filter((d) => d.alasan !== "sudah-ada")
                  .map((d) => `${Number(d.tanggal.slice(8))} (${ALASAN[d.alasan] ?? d.alasan})`)
                  .join(", ")}
              </p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <button
                type="button"
                className={`btn-primary h-10 px-4 text-sm ${FOKUS}`}
                disabled={busy || (rencana.baris.length === 0 && rencana.hapus.length === 0) || !rencana.statusAwalId}
                aria-busy={busy}
                onClick={() => kirim(true)}
              >
                {busy ? "Menyimpan…" : `Simpan ${rencana.baris.length} baris`}
              </button>
              <button type="button" className={`btn-ghost h-10 px-4 text-sm ${FOKUS}`} onClick={onClose}>
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
