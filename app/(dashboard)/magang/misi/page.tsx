"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";
import { Judul, Kosong, Memuat, Pesan } from "@/components/magang/ui";
import { KartuKiriman, type KirimanAdmin } from "@/components/magang/KirimanMisi";
import { daftarSekolah, sekolahSama } from "@/lib/services/magang/sekolah";
import { KATEGORI_MISI, LEVEL_MISI, JENIS_BUKTI, type JenisBukti, type KategoriMisi, type LevelMisi } from "@/lib/services/magang/misi";

type Misi = {
  id: number;
  kategori: string;
  kategoriLabel: string;
  level: LevelMisi;
  levelLabel: string;
  judul: string;
  deskripsi: string | null;
  bukti: JenisBukti[];
  poin: number;
  urutan: number;
  aktif: boolean;
  kiriman: { menunggu: number; disetujui: number; ditolak: number };
};
type Bank = { misi: Misi[] };

type FormMisi = {
  id?: number;
  kategori: KategoriMisi;
  level: LevelMisi;
  judul: string;
  deskripsi: string;
  bukti: JenisBukti[];
  poin: number;
  urutan: number;
  aktif: boolean;
};

export default function SideQuestPage() {
  const [bank, setBank] = useState<Bank | null>(null);
  const [kiriman, setKiriman] = useState<KirimanAdmin[] | null>(null);
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<FormMisi | null>(null);
  const [busy, setBusy] = useState(false);
  const [sekolah, setSekolah] = useState(""); // kunci sekolah, "" = semua

  const ambil = useCallback(
    () => Promise.all([api<Bank>("/api/magang/misi"), api<{ kiriman: KirimanAdmin[] }>("/api/magang/misi/kiriman?status=menunggu")]),
    []
  );
  const pasang = ([b, k]: [Bank, { kiriman: KirimanAdmin[] }]) => {
    setBank(b);
    setKiriman(k.kiriman);
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

  async function jalankan(fn: () => Promise<unknown>, pesan: string) {
    setBusy(true);
    setGalat("");
    setNotice("");
    try {
      await fn();
      setNotice(pesan);
      await muat();
      return true;
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function simpan() {
    if (!form) return;
    const { id, ...isi } = form;
    const body = JSON.stringify({ ...isi, judul: isi.judul.trim(), deskripsi: isi.deskripsi.trim() || null });
    const ok = await jalankan(
      () => api(id ? `/api/magang/misi/${id}` : "/api/magang/misi", { method: id ? "PATCH" : "POST", body }),
      `Misi "${form.judul.trim()}" tersimpan.`
    );
    if (ok) setForm(null);
  }

  const misiBaru = (kategori: KategoriMisi = "cs"): FormMisi => ({
    kategori,
    level: "dasar",
    judul: "",
    deskripsi: "",
    bukti: ["foto"],
    poin: 10,
    urutan: (bank?.misi.filter((m) => m.kategori === kategori).length ?? 0) + 1,
    aktif: true,
  });

  const pilihanSekolah = daftarSekolah((kiriman ?? []).map((k) => k.peserta.sekolah));
  const sekolahAktif = pilihanSekolah.some((s) => s.kunci === sekolah) ? sekolah : "";
  const antrean = kiriman?.filter((k) => !sekolahAktif || sekolahSama(k.peserta.sekolah, sekolahAktif)) ?? null;
  const misiTanpaKategori = bank?.misi.filter((m) => !KATEGORI_MISI.some((k) => k.key === m.kategori)) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Judul
        judul="Side Quest"
        keterangan="Misi wajib di luar rotasi pos — Customer Service, Desain Grafis, Digital Marketing. Misi yang aktif otomatis berlaku untuk semua anak magang. Anak mengirim bukti dari HP; periksa di sini lalu setujui atau minta perbaikan."
        aksi={
          <button onClick={() => setForm(misiBaru())} className="btn-primary h-11 text-sm" disabled={!bank}>
            <IconPlus className="text-[16px]" /> Tambah misi
          </button>
        }
      />
      <div aria-live="polite" className="space-y-2">
        {notice && <Pesan jenis="ok">{notice}</Pesan>}
        {galat && <Pesan jenis="galat">{galat}</Pesan>}
      </div>

      {/* ── Antrean pemeriksaan ── */}
      <section aria-labelledby="judul-periksa">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="judul-periksa" className="text-sm font-bold text-fg">
            Perlu diperiksa {antrean && antrean.length > 0 && <span className="text-warning">({antrean.length})</span>}
          </h2>
          {pilihanSekolah.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              Sekolah
              <select className="input h-11 w-auto text-sm" value={sekolahAktif} onChange={(e) => setSekolah(e.target.value)}>
                <option value="">Semua sekolah</option>
                {pilihanSekolah.map((s) => (
                  <option key={s.kunci} value={s.kunci}>
                    {s.label} ({s.jumlah})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!antrean ? (
          <Memuat baris={2} tinggi="h-28" />
        ) : antrean.length === 0 ? (
          <Kosong>{sekolahAktif ? "Tidak ada bukti dari sekolah ini yang menunggu." : "Tidak ada bukti yang menunggu diperiksa."}</Kosong>
        ) : (
          <ul className="space-y-3">
            {antrean.map((k) => (
              <KartuKiriman
                key={k.id}
                k={k}
                onPutus={(pesan) => {
                  setGalat("");
                  setNotice(pesan);
                  muat();
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Bank misi ── */}
      <section aria-labelledby="judul-bank" className="space-y-3">
        <h2 id="judul-bank" className="text-sm font-bold text-fg">
          Bank misi
        </h2>
        {!bank ? (
          <Memuat />
        ) : bank.misi.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-sm text-muted">Belum ada misi side quest.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-subtle">
              Mulai dari bank misi awal (Customer Service, Desain Grafis, Digital Marketing; dasar sampai lanjut) — semuanya bisa disunting atau dinonaktifkan.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                className="btn-primary h-11 text-sm"
                disabled={busy}
                onClick={() => jalankan(() => api("/api/magang/misi/contoh", { method: "POST" }), "Bank misi awal dipasang. Sunting sesuai tempat kerja.")}
              >
                {busy ? "Memasang…" : "Pakai bank misi awal"}
              </button>
              <button className="btn-ghost h-11 text-sm" onClick={() => setForm(misiBaru())}>
                Buat sendiri
              </button>
            </div>
          </div>
        ) : (
          <>
            {KATEGORI_MISI.map((kat) => {
              const daftar = bank.misi.filter((m) => m.kategori === kat.key);
              const aktif = daftar.filter((m) => m.aktif).length;
              return (
                <div key={kat.key} className="glass rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-fg">
                        {kat.label}{" "}
                        <span className="ml-1 rounded-full border border-border px-2 py-0.5 align-middle text-xs font-semibold text-muted">Prioritas {kat.prioritas}</span>
                      </h3>
                      <p className="text-xs text-muted">
                        {kat.ringkas} · {aktif} misi aktif
                      </p>
                    </div>
                    <button className="btn-ghost h-11 px-3 text-sm" onClick={() => setForm(misiBaru(kat.key))} aria-label={`Tambah misi ${kat.label}`}>
                      <IconPlus /> Tambah
                    </button>
                  </div>
                  {daftar.length === 0 ? (
                    <p className="mt-3 text-sm text-subtle">Belum ada misi di kategori ini.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {daftar.map((m) => (
                        <BarisMisi
                          key={m.id}
                          m={m}
                          onUbah={() =>
                            setForm({
                              id: m.id,
                              kategori: m.kategori as KategoriMisi,
                              level: m.level,
                              judul: m.judul,
                              deskripsi: m.deskripsi ?? "",
                              bukti: m.bukti,
                              poin: m.poin,
                              urutan: m.urutan,
                              aktif: m.aktif,
                            })
                          }
                          onHapus={() => {
                            if (confirm(`Hapus misi "${m.judul}"? Bukti yang sudah dikirim anak tetap tersimpan, tapi misi ini tidak lagi diberikan.`))
                              jalankan(() => api(`/api/magang/misi/${m.id}`, { method: "DELETE" }), `Misi "${m.judul}" dihapus.`);
                          }}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {misiTanpaKategori.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <h3 className="font-display font-bold text-fg">Lainnya</h3>
                <ul className="mt-3 space-y-2">
                  {misiTanpaKategori.map((m) => (
                    <BarisMisi
                      key={m.id}
                      m={m}
                      onUbah={() => setForm({ ...misiBaru(), id: m.id, judul: m.judul, deskripsi: m.deskripsi ?? "", level: m.level, bukti: m.bukti, poin: m.poin, urutan: m.urutan, aktif: m.aktif })}
                      onHapus={() => confirm(`Hapus misi "${m.judul}"?`) && jalankan(() => api(`/api/magang/misi/${m.id}`, { method: "DELETE" }), `Misi "${m.judul}" dihapus.`)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {form && (
        <Modal title={form.id ? "Ubah misi" : "Tambah misi"} onClose={() => setForm(null)}>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-fg">Judul misi</span>
              <input
                className="input mt-1.5 h-11"
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                placeholder="mis. Membalas 10 chat pelanggan dengan ramah"
                maxLength={150}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-fg">Petunjuk untuk anak</span>
              <span className="block text-xs text-muted">Tampil di HP anak: apa yang dikerjakan dan bukti seperti apa yang dikirim.</span>
              <textarea
                className="input mt-1.5 min-h-28 py-2"
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                maxLength={4000}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-fg">Kategori</span>
                <select className="input mt-1.5 h-11" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value as KategoriMisi })}>
                  {KATEGORI_MISI.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Tingkat</span>
                <select className="input mt-1.5 h-11" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as LevelMisi })}>
                  {LEVEL_MISI.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-semibold text-fg">Bukti yang harus dikirim anak</legend>
              <span className="block text-xs text-muted">Pilih minimal satu. Semua yang dicentang wajib ada.</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {JENIS_BUKTI.map((b) => {
                  const dipilih = form.bukti.includes(b.key);
                  return (
                    <label
                      key={b.key}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition ${
                        dipilih ? "border-primary bg-primary/10 text-fg" : "border-border text-muted hover:border-border-strong"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={dipilih}
                        onChange={(e) =>
                          setForm({ ...form, bukti: e.target.checked ? [...form.bukti, b.key] : form.bukti.filter((x) => x !== b.key) })
                        }
                      />
                      {b.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-fg">Poin</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  className="input mt-1.5 h-11"
                  value={form.poin}
                  onChange={(e) => setForm({ ...form, poin: Math.min(1000, Math.max(0, Number(e.target.value) || 0)) })}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 self-end text-sm text-fg">
                <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
                Aktif (diberikan ke semua anak)
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button className="btn-ghost h-11 text-sm" onClick={() => setForm(null)}>
                Batal
              </button>
              <button className="btn-primary h-11 text-sm" onClick={simpan} disabled={busy || form.judul.trim().length < 3 || form.bukti.length === 0}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
            {(form.judul.trim().length < 3 || form.bukti.length === 0) && (
              <p className="text-right text-xs text-muted">
                {form.judul.trim().length < 3 ? "Judul minimal 3 huruf." : "Pilih minimal satu jenis bukti."}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function BarisMisi({ m, onUbah, onHapus }: { m: Misi; onUbah: () => void; onHapus: () => void }) {
  const bukti = m.bukti.map((b) => JENIS_BUKTI.find((x) => x.key === b)?.label ?? b).join(", ");
  return (
    <li className={`flex flex-wrap items-start gap-3 rounded-xl bg-surface-2 p-3 ${m.aktif ? "" : "opacity-60"}`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg">
          {m.judul} {!m.aktif && <span className="text-xs font-normal text-subtle">(nonaktif — tidak diberikan)</span>}
        </p>
        <p className="text-xs text-muted">
          {m.levelLabel} · {m.poin} poin · bukti: {bukti}
          {m.kiriman.disetujui > 0 && ` · ${m.kiriman.disetujui} anak selesai`}
          {m.kiriman.menunggu > 0 && <span className="font-semibold text-warning"> · {m.kiriman.menunggu} menunggu</span>}
        </p>
        {m.deskripsi && <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-fg">{m.deskripsi}</p>}
      </div>
      <div className="flex gap-1">
        <button className="btn-ghost h-11 px-3 text-sm" aria-label={`Ubah misi ${m.judul}`} onClick={onUbah}>
          <IconPencil /> Ubah
        </button>
        <button className="btn-ghost h-11 px-3 text-sm text-danger" aria-label={`Hapus misi ${m.judul}`} onClick={onHapus}>
          <IconTrash />
        </button>
      </div>
    </li>
  );
}
