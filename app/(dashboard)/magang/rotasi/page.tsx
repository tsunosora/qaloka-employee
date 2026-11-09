"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { seninDari, tambahMinggu, selisihMinggu } from "@/lib/services/magang/rotasi";
import { daftarSekolah, kunciSekolah, sekolahSama } from "@/lib/services/magang/sekolah";
import { IconAlert } from "@/components/ui/icons";
import { Judul, Kosong, Memuat, Pesan, tglPendek, warnaPos } from "@/components/magang/ui";

type Penugasan = { id: number; pesertaId: number; posId: number; mulai: string; minggu: number; berbagi: boolean };
type Payload = {
  seninIni: string;
  pos: { id: number; nama: string; durasiMinggu: number; kapasitas: number; lokasi: string | null; aktif: boolean }[];
  peserta: { id: number; nama: string; mulai: string; selesai: string | null; aktif: boolean; sekolah: string | null; penugasan: Penugasan[] }[];
};

/** Nilai saringan untuk peserta yang sekolahnya belum diisi. */
const TANPA_SEKOLAH = "__tanpa";

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
  /** "" = semua sekolah; TANPA_SEKOLAH; selain itu kunciSekolah(). */
  const [saringSekolah, setSaringSekolah] = useState("");
  /** Anak tanpa jadwal yang TIDAK dicentang untuk "Tambah peserta baru". */
  const [dilewati, setDilewati] = useState<Set<number>>(new Set());

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
  const lokasiPos = useMemo(() => new Map((data?.pos ?? []).map((p) => [p.id, p.lokasi])), [data]);
  const sekolahUnik = useMemo(() => daftarSekolah((data?.peserta ?? []).filter((p) => semua || p.aktif).map((p) => p.sekolah)), [data, semua]);
  const adaTanpaSekolah = (data?.peserta ?? []).some((p) => (semua || p.aktif) && !kunciSekolah(p.sekolah));
  const tampil = useMemo(
    () =>
      (data?.peserta ?? [])
        .filter((p) => semua || p.aktif)
        .filter((p) => !saringSekolah || (saringSekolah === TANPA_SEKOLAH ? !kunciSekolah(p.sekolah) : sekolahSama(p.sekolah, saringSekolah))),
    [data, semua, saringSekolah]
  );
  /** Anak aktif yang belum punya jadwal sejak minggu `dari` — calon "Tambah peserta baru". */
  const tanpaJadwal = useMemo(
    () => (dari ? (data?.peserta ?? []).filter((p) => p.aktif && !p.penugasan.some((a) => tambahMinggu(a.mulai, a.minggu) > dari)) : []),
    [data, dari]
  );
  const terpilihBaru = tanpaJadwal.filter((p) => !dilewati.has(p.id));
  const jumlahBerbagi = tampil.reduce((n, p) => n + p.penugasan.filter((a) => a.berbagi).length, 0);

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

  async function susun(mode: "semua" | "baru") {
    setBusy(true);
    setGalat("");
    setNotice("");
    try {
      const body = mode === "baru" ? { dari, mode, pesertaIds: terpilihBaru.map((p) => p.id) } : { dari, mode };
      const r = await api<{ dibuat: number; dari: string; disusun: number }>("/api/magang/rotasi", { method: "POST", body: JSON.stringify(body) });
      setNotice(
        mode === "baru"
          ? r.disusun === 0
            ? "Tidak ada anak baru yang perlu dijadwalkan."
            : `${r.disusun} anak baru dijadwalkan mulai minggu ${tglPendek(r.dari)} (${r.dibuat} penugasan). Jadwal anak lain tidak berubah.`
          : `Rotasi ${r.disusun} anak disusun ulang mulai minggu ${tglPendek(r.dari)}: ${r.dibuat} penugasan.`
      );
      setKonfirmasi(false);
      setDilewati(new Set());
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
          <section className="glass space-y-4 rounded-2xl p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-sm font-semibold text-fg">Mulai minggu</span>
                <input type="date" className="input mt-1.5 h-11 w-auto" value={dari} onChange={(e) => setDari(e.target.value ? seninDari(e.target.value) : "")} />
              </label>
              {posAktif.length === 0 && <p className="pb-3 text-sm text-warning">Belum ada pos aktif. Tambahkan pos dulu.</p>}
            </div>
            <p className="text-sm text-muted">
              <b className="text-fg">Tambah peserta baru</b> hanya mengisi jadwal anak yang belum punya jadwal. <b className="text-fg">Susun ulang semua</b> mengacak
              ulang jadwal semua anak mulai minggu itu.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <h2 className="text-sm font-bold text-fg">Tambah peserta baru saja</h2>
                <p className="text-xs text-muted">Jadwal anak lain tidak berubah. Kapasitas pos tetap dihitung.</p>
                {tanpaJadwal.length === 0 ? (
                  <p className="mt-3 text-sm text-subtle">Semua anak aktif sudah punya jadwal sejak minggu {dari ? tglPendek(dari) : "ini"}.</p>
                ) : (
                  <fieldset className="mt-3">
                    <legend className="text-xs font-semibold text-fg">Anak tanpa jadwal ({tanpaJadwal.length})</legend>
                    <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
                      {tanpaJadwal.map((p) => (
                        <li key={p.id}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-fg hover:bg-surface-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={!dilewati.has(p.id)}
                              onChange={(e) =>
                                setDilewati((s) => {
                                  const n = new Set(s);
                                  if (e.target.checked) n.delete(p.id);
                                  else n.add(p.id);
                                  return n;
                                })
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {p.nama}
                              {p.sekolah && <span className="text-muted"> · {p.sekolah}</span>}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                )}
                <button
                  className="btn-primary mt-3 h-11 w-full text-sm"
                  disabled={!dari || busy || posAktif.length === 0 || terpilihBaru.length === 0}
                  onClick={() => susun("baru")}
                >
                  {busy ? "Menyusun…" : `Tambah ke jadwal${terpilihBaru.length ? ` (${terpilihBaru.length} anak)` : ""}`}
                </button>
              </div>
              <div className="rounded-xl border border-border p-3">
                <h2 className="text-sm font-bold text-fg">Susun ulang semua</h2>
                <p className="text-xs text-muted">
                  Jadwal semua anak aktif mulai minggu {dari ? tglPendek(dari) : "terpilih"} disusun ulang. Pakai bila pos berubah atau jadwal sudah berantakan.
                </p>
                <button className="btn-ghost mt-3 h-11 w-full text-sm" disabled={!dari || busy || posAktif.length === 0} onClick={() => setKonfirmasi(true)}>
                  Susun ulang semua…
                </button>
              </div>
            </div>
          </section>

          <section className="flex flex-wrap items-end gap-3">
            {(sekolahUnik.length > 1 || (sekolahUnik.length > 0 && adaTanpaSekolah)) && (
              <label className="block w-full sm:w-72">
                <span className="text-sm font-semibold text-fg">Saring per sekolah</span>
                <select className="input mt-1.5 h-11" value={saringSekolah} onChange={(e) => setSaringSekolah(e.target.value)}>
                  <option value="">Semua sekolah</option>
                  {sekolahUnik.map((s) => (
                    <option key={s.kunci} value={s.kunci}>
                      {s.label} ({s.jumlah})
                    </option>
                  ))}
                  {adaTanpaSekolah && <option value={TANPA_SEKOLAH}>Sekolah belum diisi</option>}
                </select>
              </label>
            )}
            <label className="ml-auto flex min-h-11 items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="h-4 w-4" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan yang sudah selesai
            </label>
          </section>

          {jumlahBerbagi > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-warning px-4 py-3 text-sm text-warning">
              <IconAlert className="shrink-0 text-[16px]" />
              {jumlahBerbagi} jadwal berbagi pos dengan anak lain (melebihi kapasitas pos). Ditandai garis putus-putus; klik kotaknya untuk mengubah.
            </div>
          )}

          {tampil.length === 0 ? (
            <Kosong>{saringSekolah ? "Tidak ada peserta dari sekolah ini." : "Belum ada peserta magang aktif."}</Kosong>
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
                              title={`${namaPos.get(a.posId) ?? "(pos dihapus)"}${lokasiPos.get(a.posId) ? ` (${lokasiPos.get(a.posId)})` : ""} · ${a.minggu} minggu${a.berbagi ? " · berbagi pos" : ""}`}
                            >
                              {namaPos.get(a.posId) ?? "(dihapus)"}
                              {lokasiPos.get(a.posId) && <span className="block truncate text-[10px] font-normal opacity-90">{lokasiPos.get(a.posId)}</span>}
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
                          {p.sekolah && <span className="block truncate text-[11px] font-normal text-subtle">{p.sekolah}</span>}
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
                <span className="h-3 w-3 rounded" style={{ background: warnaPos(i) }} aria-hidden /> {p.nama}
                {p.lokasi && <span className="text-subtle">· {p.lokasi}</span>} ({p.durasiMinggu} mgg)
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
        <Modal title="Susun ulang jadwal semua anak?" onClose={() => setKonfirmasi(false)}>
          <div className="space-y-4 text-sm">
            <p className="flex items-start gap-2 rounded-xl border border-dashed border-warning px-3 py-2 text-warning">
              <IconAlert className="mt-0.5 shrink-0" />
              <span>
                Jadwal anak yang <b>sudah ada</b> mulai minggu {tglPendek(dari)} akan <b>berubah</b>. Kalau hanya ingin memasukkan anak baru, pakai
                &ldquo;Tambah peserta baru saja&rdquo;.
              </span>
            </p>
            <p className="text-fg">
              Jadwal sebelum minggu itu — termasuk pos yang sedang berjalan — tidak berubah, dan nilai yang sudah masuk tetap aman. Ubahan tangan sesudah
              minggu itu akan tertimpa.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost h-11 text-sm" onClick={() => setKonfirmasi(false)}>
                Batal
              </button>
              <button className="btn-primary h-11 text-sm" onClick={() => susun("semua")} disabled={busy}>
                {busy ? "Menyusun…" : "Ya, susun ulang semua"}
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
              <button className="btn-ghost h-11 text-sm" onClick={() => setUbah(null)}>
                Batal
              </button>
              <button className="btn-primary h-11 text-sm" onClick={simpanUbah} disabled={busy}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
