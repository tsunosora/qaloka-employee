"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert } from "@/components/ui/icons";
import { Card, soft } from "@/components/portal/ui";
import { Pesan, tglPendek } from "@/components/magang/ui";
import { NilaiTugas, type TugasAdmin } from "@/components/magang/NilaiTugas";
import { DaftarJurnalPerAnak, type JurnalAdmin } from "@/components/magang/DaftarJurnal";

type Anak = { pesertaId: number; nama: string; pos: string; mingguKe: number; dari: number };
type Data =
  | { pembimbing: false }
  | { pembimbing: true; pos: { id: number; nama: string }[]; anak: Anak[]; tugas: TugasAdmin[]; jurnal: JurnalAdmin[] };

/**
 * Tab "Bimbingan" di halaman pribadi pembimbing pos magang: anak di posnya minggu ini, tugas mingguan
 * yang perlu dinilai, dan jurnal harian yang belum dicek — HANYA pos yang dia bimbing, tanpa login dasbor.
 * Mode owner (?owner=1) hanya melihat: tombol menilai & mengecek disembunyikan (server juga menolak 403).
 */
export function BimbinganPanel({ token, ownerQuery }: { token: string; ownerQuery: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [dinilai, setDinilai] = useState<TugasAdmin | null>(null);
  const q = ownerQuery ? `?${ownerQuery.slice(1)}` : "";
  const bacaSaja = !!ownerQuery;
  const apiBase = `/api/public/portal/${token}/bimbingan`;

  const ambil = useCallback(() => api<Data>(`${apiBase}${q}`), [apiBase, q]);
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat data bimbingan.");
  const muat = () => ambil().then(setData, gagal);
  useEffect(() => {
    let hidup = true;
    ambil().then(
      (d) => hidup && setData(d),
      (e) => hidup && gagal(e)
    );
    return () => {
      hidup = false;
    };
  }, [ambil]);

  if (galat)
    return (
      <div className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-danger" style={soft("var(--danger)")}>
        <IconAlert className="shrink-0 text-[16px]" /> {galat}
      </div>
    );
  if (!data) return <div className="glass h-64 animate-pulse rounded-2xl" />;
  if (!data.pembimbing) return <Card>Kamu belum menjadi pembimbing pos magang mana pun.</Card>;

  return (
    <div className="space-y-4">
      {bacaSaja && <p className="text-xs text-muted">Mode owner — hanya pembimbingnya yang bisa menilai tugas & mengecek jurnal.</p>}
      {notice && <Pesan jenis="ok">{notice}</Pesan>}

      <Card title="Anak di posmu minggu ini">
        <p className="-mt-2 mb-3 text-xs text-muted">Pos yang kamu bimbing: {data.pos.map((p) => p.nama).join(", ")}</p>
        {data.anak.length === 0 ? (
          <p className="text-sm text-muted">Minggu ini belum ada anak magang di posmu.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.anak.map((a) => (
              <li key={a.pesertaId} className="py-2.5 first:pt-0 last:pb-0">
                <p className="font-semibold text-fg">{a.nama}</p>
                <p className="text-sm text-muted">
                  {a.pos} · minggu {a.mingguKe} dari {a.dari}
                  {a.dari === 2 && (a.mingguKe === 1 ? " — masih didampingi" : " — mulai mengerjakan sendiri")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Perlu dinilai (${data.tugas.length})`}>
        {data.tugas.length === 0 ? (
          <p className="text-sm text-muted">Tidak ada tugas mingguan yang menunggu nilaimu.</p>
        ) : (
          <ul className="space-y-3">
            {data.tugas.map((t) => (
              <li key={t.id} className="rounded-xl bg-surface-2 p-3">
                <p className="font-semibold text-fg">{t.nama}</p>
                <p className="text-xs text-muted">
                  {t.pos} · minggu {tglPendek(t.senin)} · kuis {t.skorKuis ?? "—"}
                  {t.terlambat && <span className="font-semibold text-danger"> · terlambat</span>}
                </p>
                <p className="mt-1.5 line-clamp-3 text-sm text-fg">{t.ingatan}</p>
                {!bacaSaja && (
                  <button onClick={() => setDinilai(t)} className="btn-primary mt-3 h-11 w-full text-sm">
                    Baca & beri nilai
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <h2 className="mb-2 px-1 font-display text-sm font-bold text-fg">Jurnal belum dicek ({data.jurnal.length})</h2>
        {data.jurnal.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">Semua jurnal harian anak di posmu sudah dicek.</p>
          </Card>
        ) : (
          <DaftarJurnalPerAnak
            items={data.jurnal}
            apiBase={apiBase}
            q={q}
            bacaSaja={bacaSaja}
            onDicek={(nama) => {
              setNotice(`Jurnal ${nama} ditandai sudah dicek.`);
              muat();
            }}
          />
        )}
      </section>

      {dinilai && (
        <NilaiTugas
          tugas={dinilai}
          apiBase={apiBase}
          onClose={() => setDinilai(null)}
          onSaved={() => {
            setNotice(`Nilai ${dinilai.nama} minggu ${tglPendek(dinilai.senin)} tersimpan.`);
            setDinilai(null);
            muat();
          }}
        />
      )}
    </div>
  );
}
