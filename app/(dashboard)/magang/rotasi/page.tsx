"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { seninDari, tambahMinggu, selisihMinggu } from "@/lib/services/magang/rotasi";
import { Judul, Kosong, Memuat, Pesan, tglPendek, warnaPos } from "@/components/magang/ui";

type Penugasan = { id: number; pesertaId: number; posId: number; mulai: string; minggu: number; berbagi: boolean };
type Payload = {
  seninIni: string;
  pos: { id: number; nama: string; durasiMinggu: number; aktif: boolean }[];
  peserta: { id: number; nama: string; mulai: string; selesai: string | null; aktif: boolean; penugasan: Penugasan[] }[];
};

const LEBAR = 76; // px per kolom minggu

export default function RotasiMagangPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [dari, setDari] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [ubah, setUbah] = useState<{ a: Penugasan; nama: string; posId: number; minggu: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [semua, setSemua] = useState(false);

  const ambil = useCallback(() => api<Payload>("/api/magang/rotasi"), []);
  const pasang = (d: Payload) => {
    setData(d);
    setDari((x) => x || d.seninIni);
  };
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat data.");
  const muat = () => ambil().then(pasang, gagal);
  useEffect(() => {
    let hidup = true;
    ambil().then(
      (d) => hidup && pasang(d),
      (e) => hidup && gagal(e)
    );
    return () => {
      hidup = false;
    };
  }, [ambil]);

  const posIndeks = useMemo(() => new Map((data?.pos ?? []).map((p, i) => [p.id, i])), [data]);
  const namaPos = useMemo(() => new Map((data?.pos ?? []).map((p) => [p.id, p.nama])), [data]);
  const tampil = useMemo(() => (data?.peserta ?? []).filter((p) => semua || p.aktif), [data, semua]);

  const minggu = useMemo(() => {
    if (!data || tampil.length === 0) return [];
    let awal = seninDari(data.seninIni);
    let akhir = awal;
    for (const p of tampil) {
      const m = seninDari(p.mulai);
      if (m < awal) awal = m;
      if (p.selesai && seninDari(p.selesai) > akhir) akhir = seninDari(p.selesai);
      for (const a of p.penugasan) {
        if (a.mulai < awal) awal = a.mulai;
        const z = tambahMinggu(a.mulai, a.minggu - 1);
        if (z > akhir) akhir = z;
      }
    }
    const n = Math.min(60, selisihMinggu(awal, akhir) + 1);
    return Array.from({ length: n }, (_, k) => tambahMinggu(awal, k));
  }, [data, tampil]);

  async function susun() {
    setBusy(true);
    setGalat("");
    try {
      const r = await api<{ dibuat: number; dari: string }>("/api/magang/rotasi", { method: "POST", body: JSON.stringify({ dari }) });
      setNotice(`Rotasi disusun mulai minggu ${tglPendek(r.dari)}: ${r.dibuat} penugasan.`);
      setKonfirmasi(false);
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyusun rotasi.");
    } finally {
      setBusy(false);
    }
  }

  async function simpanUbah() {
    if (!ubah) return;
    setBusy(true);
    setGalat("");
    try {
      await api(`/api/magang/rotasi/${ubah.a.id}`, { method: "PATCH", body: JSON.stringify({ posId: ubah.posId, minggu: ubah.minggu }) });
      setNotice(`Penugasan ${ubah.nama} minggu ${tglPendek(ubah.a.mulai)} diubah.`);
      setUbah(null);
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const posAktif = data?.pos.filter((p) => p.aktif) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Judul
        judul="Rotasi Pos"
        keterangan="Tiap anak bergiliran memegang semua pos sebelum mengulang. Pos 2 minggu = minggu 1 didampingi, minggu 2 mandiri. Susun otomatis kapan saja — misalnya sesudah anak baru masuk — jadwal sebelum minggu yang dipilih tidak berubah."
      />
      {notice && <Pesan jenis="ok">{notice}</Pesan>}
      {galat && <Pesan jenis="galat">{galat}</Pesan>}

      {!data ? (
        <Memuat baris={1} tinggi="h-64" />
      ) : (
        <>
          <section className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
            <label className="block">
              <span className="text-sm font-semibold text-fg">Susun otomatis mulai minggu</span>
              <input type="date" className="input mt-1.5 w-auto" value={dari} onChange={(e) => setDari(e.target.value ? seninDari(e.target.value) : "")} />
            </label>
            <button className="btn-primary h-10 text-sm" disabled={!dari || busy || posAktif.length === 0} onClick={() => setKonfirmasi(true)}>
              Susun rotasi
            </button>
            {posAktif.length === 0 && <p className="text-sm text-warning">Belum ada pos aktif.</p>}
            <label className="ml-auto flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan yang sudah selesai
            </label>
          </section>

          {tampil.length === 0 ? (
            <Kosong>Belum ada peserta magang aktif.</Kosong>
          ) : (
            <section className="glass overflow-x-auto rounded-2xl p-2">
              <table className="border-separate border-spacing-y-1 text-xs" style={{ minWidth: 140 + minggu.length * LEBAR }}>
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 w-[140px] bg-surface px-2 py-1 text-left font-semibold text-muted">Anak</th>
                    {minggu.map((s) => (
                      <th
                        key={s}
                        className={`px-1 py-1 text-center font-medium ${s === data.seninIni ? "rounded-lg bg-primary/10 text-primary" : "text-muted"}`}
                        style={{ width: LEBAR }}
                      >
                        {tglPendek(s)}
                        {s === data.seninIni && <span className="block text-[10px]">minggu ini</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((p) => {
                    const sel: React.ReactNode[] = [];
                    let k = 0;
                    while (k < minggu.length) {
                      const s = minggu[k];
                      const a = p.penugasan.find((x) => x.mulai === s);
                      if (a) {
                        const span = Math.min(a.minggu, minggu.length - k);
                        const warna = warnaPos(posIndeks.get(a.posId) ?? 0);
                        sel.push(
                          <td key={s} colSpan={span} className="px-0.5">
                            <button
                              onClick={() => setUbah({ a, nama: p.nama, posId: a.posId, minggu: a.minggu })}
                              className="w-full truncate rounded-lg px-2 py-2 text-left font-semibold text-white transition hover:brightness-110"
                              style={{ background: warna, outline: a.berbagi ? "2px dashed var(--warning)" : undefined, outlineOffset: -2 }}
                              title={`${namaPos.get(a.posId) ?? "(pos dihapus)"} · ${a.minggu} minggu${a.berbagi ? " · berbagi pos" : ""}`}
                            >
                              {namaPos.get(a.posId) ?? "(dihapus)"}
                            </button>
                          </td>
                        );
                        k += span;
                      } else {
                        const dalamMasa = s >= seninDari(p.mulai) && (!p.selesai || s <= seninDari(p.selesai));
                        const tertutup = p.penugasan.some((x) => x.mulai < s && s < tambahMinggu(x.mulai, x.minggu));
                        if (!tertutup) sel.push(<td key={s} className={`px-0.5 ${dalamMasa ? "" : "opacity-30"}`}><div className={`h-8 rounded-lg ${dalamMasa ? "border border-dashed border-border-strong" : ""}`} /></td>);
                        k += 1;
                      }
                    }
                    const jumlahPos = new Set(p.penugasan.map((a) => a.posId)).size;
                    return (
                      <tr key={p.id}>
                        <th className="sticky left-0 z-10 bg-surface px-2 text-left align-middle">
                          <span className="block truncate font-semibold text-fg">{p.nama}</span>
                          <span className={`text-[11px] font-normal ${jumlahPos >= posAktif.length ? "text-success" : "text-muted"}`}>
                            {jumlahPos}/{posAktif.length} pos
                          </span>
                        </th>
                        {sel}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {data.pos.map((p, i) => (
              <li key={p.id} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded" style={{ background: warnaPos(i) }} aria-hidden /> {p.nama} ({p.durasiMinggu} mgg)
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-2 border-dashed border-warning" aria-hidden /> berbagi pos dengan anak lain
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-dashed border-border-strong" aria-hidden /> masa magang tanpa pos — susun ulang
            </li>
          </ul>
        </>
      )}

      {konfirmasi && (
        <Modal title="Susun rotasi otomatis?" onClose={() => setKonfirmasi(false)}>
          <div className="space-y-4 text-sm">
            <p className="text-fg">
              Jadwal semua anak aktif <b>mulai minggu {tglPendek(dari)}</b> akan disusun ulang. Jadwal sebelum minggu itu — termasuk pos yang sedang
              berjalan — tidak berubah, dan nilai yang sudah masuk tetap aman. Ubahan tangan sesudah minggu itu akan tertimpa.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost h-10 text-sm" onClick={() => setKonfirmasi(false)}>
                Batal
              </button>
              <button className="btn-primary h-10 text-sm" onClick={susun} disabled={busy}>
                {busy ? "Menyusun…" : "Ya, susun"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {ubah && data && (
        <Modal title={`${ubah.nama} · mulai ${tglPendek(ubah.a.mulai)}`} onClose={() => setUbah(null)}>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-fg">Pos</span>
              <select className="input mt-1.5" value={ubah.posId} onChange={(e) => setUbah({ ...ubah, posId: Number(e.target.value) })}>
                {data.pos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                    {p.aktif ? "" : " (nonaktif)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-fg">Lama</span>
              <select className="input mt-1.5" value={ubah.minggu} onChange={(e) => setUbah({ ...ubah, minggu: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} minggu
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted">Untuk menggeser seluruh jadwal sesudahnya, pakai Susun rotasi mulai minggu berikutnya.</p>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button className="btn-ghost h-10 text-sm" onClick={() => setUbah(null)}>
                Batal
              </button>
              <button className="btn-primary h-10 text-sm" onClick={simpanUbah} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
