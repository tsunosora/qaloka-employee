"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetcher";
import { IconChevronDown, IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";
import { Pesan } from "@/components/magang/ui";

/** Satu baris GET /api/magang/misi/kategori (lib/services/magang/misi-db.ts → serialisasiKategori). */
export type KategoriAdmin = {
  id: number;
  kunci: string;
  nama: string;
  ringkas: string | null;
  prioritas: string | null;
  urutan: number;
  aktif: boolean;
  /** Misi yang belum dihapus. */
  jumlahMisi: number;
  /** Semua misi yang merujuk (termasuk yang sudah dihapus) — selama > 0 kategori tidak bisa dihapus. */
  dipakai: number;
};

type Isian = { nama: string; prioritas: string; ringkas: string };
const KOSONG: Isian = { nama: "", prioritas: "", ringkas: "" };
const SARAN_PRIORITAS = ["Tinggi", "Menengah", "Rendah"];

/**
 * Kelola kategori side quest (isi dialog "Kategori" di Magang → Side Quest): tambah, ganti nama,
 * urutkan (tombol naik/turun), aktif/nonaktif, hapus. Kategori yang masih dipakai misi tidak bisa
 * dihapus langsung — ditawarkan "Nonaktifkan" atau "Pindahkan misinya ke…" lalu hapus.
 */
export function KelolaKategori({ kategori, onBerubah }: { kategori: KategoriAdmin[]; onBerubah: () => Promise<unknown> }) {
  const [urut, setUrut] = useState(kategori);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [baru, setBaru] = useState<Isian>(KOSONG);
  const [ubah, setUbah] = useState<(Isian & { id: number }) | null>(null);
  const [hapus, setHapus] = useState<{ id: number; ke: string } | null>(null);
  const fokus = useRef<string | null>(null);

  // Data dari induk berganti (sesudah simpan) → ikuti (pola "sesuaikan state saat props berubah").
  const [dari, setDari] = useState(kategori);
  if (dari !== kategori) {
    setDari(kategori);
    setUrut(kategori);
  }
  // Sesudah naik/turun, kembalikan fokus ke tombol yang sama (barisnya berpindah tempat di DOM). Bila
  // tombol itu kini nonaktif (baris sampai paling atas/bawah), fokus ke tombol arah sebaliknya.
  useEffect(() => {
    const id = fokus.current;
    if (!id || busy) return;
    fokus.current = null;
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (el && !el.disabled) el.focus();
    else document.getElementById(id.endsWith("-naik") ? id.replace(/-naik$/, "-turun") : id.replace(/-turun$/, "-naik"))?.focus();
  }, [urut, busy]);

  async function jalankan(fn: () => Promise<unknown>, pesan: string) {
    setBusy(true);
    setGalat("");
    setNotice("");
    try {
      await fn();
      await onBerubah();
      setNotice(pesan);
      return true;
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const isi = (x: Isian) => ({ nama: x.nama.trim(), prioritas: x.prioritas.trim() || null, ringkas: x.ringkas.trim() || null });

  async function tambah() {
    const ok = await jalankan(
      () => api("/api/magang/misi/kategori", { method: "POST", body: JSON.stringify(isi(baru)) }),
      `Kategori "${baru.nama.trim()}" ditambahkan.`
    );
    if (ok) setBaru(KOSONG);
  }

  async function simpanUbah() {
    if (!ubah) return;
    const ok = await jalankan(
      () => api(`/api/magang/misi/kategori/${ubah.id}`, { method: "PATCH", body: JSON.stringify(isi(ubah)) }),
      `Kategori "${ubah.nama.trim()}" tersimpan.`
    );
    if (ok) setUbah(null);
  }

  function setAktif(k: KategoriAdmin, aktif: boolean) {
    return jalankan(
      () => api(`/api/magang/misi/kategori/${k.id}`, { method: "PATCH", body: JSON.stringify({ aktif }) }),
      aktif ? `Kategori "${k.nama}" aktif lagi — misinya kembali diberikan.` : `Kategori "${k.nama}" dinonaktifkan — misinya tidak diberikan dan tidak dihitung.`
    );
  }

  async function geser(i: number, arah: -1 | 1) {
    const j = i + arah;
    if (j < 0 || j >= urut.length) return;
    const lama = urut;
    const susun = [...urut];
    [susun[i], susun[j]] = [susun[j], susun[i]];
    setUrut(susun); // langsung terlihat; kalau gagal dikembalikan
    fokus.current = `kat-${susun[j].id}-${arah < 0 ? "naik" : "turun"}`;
    const ok = await jalankan(
      () => api("/api/magang/misi/kategori/urutan", { method: "POST", body: JSON.stringify({ ids: susun.map((k) => k.id) }) }),
      `Urutan disimpan: "${susun[j].nama}" sekarang di nomor ${j + 1}.`
    );
    if (!ok) setUrut(lama);
  }

  async function hapusLangsung(k: KategoriAdmin) {
    if (!confirm(`Hapus kategori "${k.nama}"? Kategori ini belum dipakai misi apa pun.`)) return;
    await jalankan(() => api(`/api/magang/misi/kategori/${k.id}`, { method: "DELETE" }), `Kategori "${k.nama}" dihapus.`);
  }

  async function pindahLaluHapus(k: KategoriAdmin, ke: string) {
    const tujuan = urut.find((x) => x.kunci === ke);
    if (!tujuan) return;
    const ok = await jalankan(async () => {
      await api(`/api/magang/misi/kategori/${k.id}/pindah`, { method: "POST", body: JSON.stringify({ ke }) });
      await api(`/api/magang/misi/kategori/${k.id}`, { method: "DELETE" });
    }, `Misi "${k.nama}" dipindahkan ke "${tujuan.nama}", lalu kategorinya dihapus.`);
    if (ok) setHapus(null);
  }

  const bisaTambah = baru.nama.trim().length >= 2;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Kategori mengelompokkan misi side quest. Kategori yang <b className="text-fg">nonaktif</b> tidak diberikan ke anak dan tidak dihitung di progres —
        misinya tetap tersimpan. Urutan di sini = urutan di HP anak dan di rapor.
      </p>
      {/* Menempel di atas area gulir dialog supaya pesan tetap terlihat saat menyunting baris di bawah. */}
      <div aria-live="polite" className={`space-y-2 ${notice || galat ? "sticky top-0 z-10 -mx-1 rounded-xl bg-bg p-1 shadow-sm" : ""}`}>
        {notice && <Pesan jenis="ok">{notice}</Pesan>}
        {galat && <Pesan jenis="galat">{galat}</Pesan>}
      </div>

      {urut.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-subtle">Belum ada kategori. Tambahkan di bawah.</p>
      ) : (
        <ol className="space-y-2" aria-label="Daftar kategori side quest">
          {urut.map((k, i) => {
            const sedangUbah = ubah?.id === k.id;
            const sedangHapus = hapus?.id === k.id;
            const tujuanPindah = urut.filter((x) => x.id !== k.id && x.aktif);
            return (
              <li key={k.id} className={`rounded-xl border border-border p-3 ${k.aktif ? "" : "bg-surface-2"}`}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex flex-col">
                    <button
                      id={`kat-${k.id}-naik`}
                      type="button"
                      className="btn-ghost h-11 w-11 justify-center p-0"
                      aria-label={`Naikkan ${k.nama}`}
                      disabled={busy || i === 0}
                      onClick={() => geser(i, -1)}
                    >
                      <IconChevronDown className="rotate-180 text-[18px]" aria-hidden="true" />
                    </button>
                    <button
                      id={`kat-${k.id}-turun`}
                      type="button"
                      className="btn-ghost h-11 w-11 justify-center p-0"
                      aria-label={`Turunkan ${k.nama}`}
                      disabled={busy || i === urut.length - 1}
                      onClick={() => geser(i, 1)}
                    >
                      <IconChevronDown className="text-[18px]" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <p className="font-semibold text-fg">
                      {k.nama}
                      {k.prioritas && (
                        <span className="ml-2 inline-block whitespace-nowrap rounded-full border border-border px-2 py-0.5 align-middle text-xs font-semibold text-muted">Prioritas {k.prioritas}</span>
                      )}
                      {!k.aktif && <span className="ml-2 inline-block whitespace-nowrap align-middle text-xs font-normal text-subtle">(nonaktif)</span>}
                    </p>
                    {k.ringkas && <p className="text-xs text-muted">{k.ringkas}</p>}
                    <p className="text-xs text-subtle">{k.jumlahMisi} misi</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm text-fg">
                      <input type="checkbox" checked={k.aktif} disabled={busy} onChange={(e) => setAktif(k, e.target.checked)} />
                      Aktif
                    </label>
                    <button
                      type="button"
                      className="btn-ghost h-11 px-3 text-sm"
                      aria-label={`Ubah kategori ${k.nama}`}
                      disabled={busy}
                      onClick={() => {
                        setHapus(null);
                        setUbah({ id: k.id, nama: k.nama, prioritas: k.prioritas ?? "", ringkas: k.ringkas ?? "" });
                      }}
                    >
                      <IconPencil /> Ubah
                    </button>
                    <button
                      type="button"
                      className="btn-ghost h-11 px-3 text-sm text-danger"
                      aria-label={`Hapus kategori ${k.nama}`}
                      disabled={busy}
                      onClick={() => {
                        setUbah(null);
                        if (k.dipakai === 0) hapusLangsung(k);
                        else setHapus(sedangHapus ? null : { id: k.id, ke: tujuanPindah[0]?.kunci ?? "" });
                      }}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>

                {sedangUbah && ubah && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <IsianKategori isi={ubah} onUbah={(x) => setUbah({ ...ubah, ...x })} idAwal={`ubah-${k.id}`} />
                    <p className="text-xs text-subtle">Ganti nama tidak memutus misi atau bukti yang sudah ada.</p>
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost h-11 text-sm" onClick={() => setUbah(null)}>
                        Batal
                      </button>
                      <button type="button" className="btn-primary h-11 text-sm" disabled={busy || ubah.nama.trim().length < 2} onClick={simpanUbah}>
                        {busy ? "Menyimpan…" : "Simpan"}
                      </button>
                    </div>
                  </div>
                )}

                {sedangHapus && hapus && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3" role="group" aria-label={`Hapus kategori ${k.nama}`}>
                    <p className="text-sm text-fg">
                      Kategori ini masih dipakai <b>{k.dipakai} misi</b>
                      {k.dipakai > k.jumlahMisi && ` (${k.dipakai - k.jumlahMisi} di antaranya sudah dihapus, tapi buktinya masih tercatat di rapor)`}, jadi belum bisa
                      dihapus. Pilih salah satu:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {k.aktif ? (
                        <button type="button" className="btn-ghost h-11 text-sm" disabled={busy} onClick={() => setAktif(k, false).then((ok) => ok && setHapus(null))}>
                          Nonaktifkan saja
                        </button>
                      ) : (
                        <span className="text-sm text-muted">Kategori ini sudah nonaktif.</span>
                      )}
                    </div>
                    {tujuanPindah.length === 0 ? (
                      <p className="text-xs text-muted">Belum ada kategori aktif lain untuk tujuan pemindahan.</p>
                    ) : (
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="block">
                          <span className="text-sm font-semibold text-fg">Pindahkan misinya ke…</span>
                          <select
                            className="input mt-1.5 h-11 w-auto"
                            value={hapus.ke}
                            onChange={(e) => setHapus({ ...hapus, ke: e.target.value })}
                          >
                            {tujuanPindah.map((t) => (
                              <option key={t.kunci} value={t.kunci}>
                                {t.nama}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="btn-ghost h-11 text-sm text-danger"
                          disabled={busy || !hapus.ke}
                          onClick={() => pindahLaluHapus(k, hapus.ke)}
                        >
                          {busy ? "Memproses…" : "Pindahkan lalu hapus"}
                        </button>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button type="button" className="btn-ghost h-11 text-sm" onClick={() => setHapus(null)}>
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <form
        className="space-y-3 rounded-xl border border-dashed border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (bisaTambah && !busy) tambah();
        }}
      >
        <h3 className="text-sm font-bold text-fg">Tambah kategori</h3>
        <IsianKategori isi={baru} onUbah={(x) => setBaru({ ...baru, ...x })} idAwal="baru" />
        <div className="flex justify-end">
          <button type="submit" className="btn-primary h-11 text-sm" disabled={busy || !bisaTambah}>
            <IconPlus className="text-[16px]" /> {busy ? "Menyimpan…" : "Tambah kategori"}
          </button>
        </div>
      </form>
    </div>
  );
}

function IsianKategori({ isi, onUbah, idAwal }: { isi: Isian; onUbah: (x: Partial<Isian>) => void; idAwal: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-sm font-semibold text-fg">Nama kategori</span>
        <input
          className="input mt-1.5 h-11"
          value={isi.nama}
          onChange={(e) => onUbah({ nama: e.target.value })}
          placeholder="mis. Fotografi Produk"
          maxLength={80}
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-fg">Prioritas</span>
        <span className="text-xs text-muted"> (boleh kosong)</span>
        <input
          className="input mt-1.5 h-11"
          value={isi.prioritas}
          onChange={(e) => onUbah({ prioritas: e.target.value })}
          placeholder="mis. Menengah"
          maxLength={30}
          list={`${idAwal}-prioritas`}
        />
        <datalist id={`${idAwal}-prioritas`}>
          {SARAN_PRIORITAS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <label className="block sm:col-span-2">
        <span className="text-sm font-semibold text-fg">Keterangan singkat</span>
        <span className="text-xs text-muted"> (boleh kosong)</span>
        <input
          className="input mt-1.5 h-11"
          value={isi.ringkas}
          onChange={(e) => onUbah({ ringkas: e.target.value })}
          placeholder="mis. Foto katalog, pencahayaan, edit ringan"
          maxLength={200}
        />
      </label>
    </div>
  );
}
