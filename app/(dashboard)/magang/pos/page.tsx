"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";
import { Judul, Kosong, Memuat, Pesan, warnaPos } from "@/components/magang/ui";

type Soal = { id: number; pertanyaan: string; pilihan: string[]; benar: number; aktif: boolean };
type Pos = {
  id: number;
  nama: string;
  deskripsi: string | null;
  durasiMinggu: number;
  kapasitas: number;
  lokasi: string | null;
  urutan: number;
  aktif: boolean;
  pembimbing: { id: number; fullName: string } | null;
  soal: Soal[];
};
type Payload = { pos: Pos[]; karyawan: { id: number; fullName: string }[] };

type FormPos = {
  id?: number;
  nama: string;
  deskripsi: string;
  durasiMinggu: number;
  kapasitas: number;
  lokasi: string;
  urutan: number;
  pembimbingId: string;
  aktif: boolean;
};
type FormSoal = { id?: number; posId: number; pertanyaan: string; pilihan: string[]; benar: number; aktif: boolean };

export default function PosMagangPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [formPos, setFormPos] = useState<FormPos | null>(null);
  const [formSoal, setFormSoal] = useState<FormSoal | null>(null);
  const [buka, setBuka] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const ambil = useCallback(() => api<Payload>("/api/magang/pos"), []);
  const gagal = (e: unknown) => setGalat(e instanceof Error ? e.message : "Gagal memuat data.");
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

  async function jalankan(fn: () => Promise<unknown>, pesan: string) {
    setBusy(true);
    setGalat("");
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

  async function simpanPos() {
    if (!formPos) return;
    const body = JSON.stringify({
      ...formPos,
      id: undefined,
      lokasi: formPos.lokasi.trim() || null,
      pembimbingId: formPos.pembimbingId ? Number(formPos.pembimbingId) : null,
    });
    const ok = await jalankan(
      () => api(formPos.id ? `/api/magang/pos/${formPos.id}` : "/api/magang/pos", { method: formPos.id ? "PATCH" : "POST", body }),
      `Pos "${formPos.nama}" tersimpan.`
    );
    if (ok) setFormPos(null);
  }

  async function simpanSoal() {
    if (!formSoal) return;
    const body = JSON.stringify({ ...formSoal, id: undefined, pilihan: formSoal.pilihan.map((p) => p.trim()) });
    const ok = await jalankan(
      () => api(formSoal.id ? `/api/magang/soal/${formSoal.id}` : "/api/magang/soal", { method: formSoal.id ? "PATCH" : "POST", body }),
      "Soal tersimpan."
    );
    if (ok) setFormSoal(null);
  }

  const posBaru = (): FormPos => ({ nama: "", deskripsi: "", durasiMinggu: 1, kapasitas: 1, lokasi: "", urutan: (data?.pos.length ?? 0) + 1, pembimbingId: "", aktif: true });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Judul
        judul="Pos Kerja & Bank Soal"
        keterangan="Pos yang dirotasi ke anak magang. Pos berat (perlu latihan tangan/alat) sebaiknya 2 minggu: minggu 1 didampingi, minggu 2 mandiri. Pos ringan cukup 1 minggu. Tiap pos punya bank soal; tiap akhir minggu (hari tugas mengingat, atur di Minggu Ini) anak mendapat sampai 5 soal acak dari pos yang dia pegang — isi minimal 5 soal per pos."
        aksi={
          <button onClick={() => setFormPos(posBaru())} className="btn-primary h-11 text-sm" disabled={!data}>
            <IconPlus className="text-[16px]" /> Tambah pos
          </button>
        }
      />
      {notice && <Pesan jenis="ok">{notice}</Pesan>}
      {galat && <Pesan jenis="galat">{galat}</Pesan>}

      {!data ? (
        <Memuat />
      ) : data.pos.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm text-muted">Belum ada pos kerja.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-subtle">
            Mulai dari contoh 7 pos percetakan (Operator Cetak, Setting File, CS & Kasir, Finishing, Gudang, Packing, Konten) lengkap dengan target belajar dan 5 soal tiap pos — semuanya bisa disunting.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              className="btn-primary h-11 text-sm"
              disabled={busy}
              onClick={() => jalankan(() => api("/api/magang/pos/contoh", { method: "POST" }), "Contoh pos percetakan dipasang. Sunting sesuai tempat kerja.")}
            >
              Pakai contoh pos percetakan
            </button>
            <button className="btn-ghost h-11 text-sm" onClick={() => setFormPos(posBaru())}>
              Buat sendiri
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.pos.map((p, i) => {
            const soalAktif = p.soal.filter((s) => s.aktif).length;
            return (
              <li key={p.id} className={`glass rounded-2xl p-4 ${p.aktif ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: warnaPos(i) }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display font-bold text-fg">
                      {p.nama}{" "}
                      {p.lokasi && <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 align-middle text-xs font-semibold text-muted">{p.lokasi}</span>}{" "}
                      {!p.aktif && <span className="text-xs font-normal text-subtle">(nonaktif — tidak ikut rotasi)</span>}
                    </h2>
                    <p className="text-sm text-muted">
                      {p.durasiMinggu} minggu · {p.kapasitas > 1 ? `${p.kapasitas} anak sekaligus` : "1 anak"}
                      {p.pembimbing ? ` · pembimbing ${p.pembimbing.fullName}` : " · belum ada pembimbing"}
                    </p>
                    {p.deskripsi && <p className="mt-2 whitespace-pre-line text-sm text-fg">{p.deskripsi}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="btn-ghost h-11 px-3 text-xs"
                      aria-label={`Ubah pos ${p.nama}`}
                      onClick={() =>
                        setFormPos({
                          id: p.id,
                          nama: p.nama,
                          deskripsi: p.deskripsi ?? "",
                          durasiMinggu: p.durasiMinggu,
                          kapasitas: p.kapasitas,
                          lokasi: p.lokasi ?? "",
                          urutan: p.urutan,
                          pembimbingId: p.pembimbing ? String(p.pembimbing.id) : "",
                          aktif: p.aktif,
                        })
                      }
                    >
                      <IconPencil /> Ubah
                    </button>
                    <button
                      className="btn-ghost h-11 px-3 text-xs text-danger"
                      aria-label={`Hapus pos ${p.nama}`}
                      onClick={() => {
                        if (confirm(`Hapus pos "${p.nama}"? Riwayat nilai anak tetap tersimpan; jadwal mendatang di pos ini dibuang — susun ulang rotasi sesudahnya.`))
                          jalankan(() => api(`/api/magang/pos/${p.id}`, { method: "DELETE" }), `Pos "${p.nama}" dihapus.`);
                      }}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>

                <div className="mt-3 border-t border-border pt-3">
                  <button className="text-sm font-semibold text-primary hover:underline" onClick={() => setBuka(buka === p.id ? null : p.id)} aria-expanded={buka === p.id}>
                    Bank soal: {soalAktif} soal aktif {soalAktif < 5 && <span className="font-normal text-warning">(disarankan ≥ 5 supaya minggu ke-2 tidak sama persis)</span>}
                  </button>
                  {buka === p.id && (
                    <div className="mt-2 space-y-2">
                      {p.soal.map((s, n) => (
                        <div key={s.id} className={`flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm ${s.aktif ? "" : "opacity-60"}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-fg">
                              {n + 1}. {s.pertanyaan} {!s.aktif && <span className="text-xs text-subtle">(nonaktif)</span>}
                            </p>
                            <p className="text-xs text-muted">Jawaban benar: {s.pilihan[s.benar]}</p>
                          </div>
                          <button className="btn-ghost h-11 px-2 text-xs" aria-label="Ubah soal" onClick={() => setFormSoal({ ...s, posId: p.id })}>
                            <IconPencil />
                          </button>
                          <button
                            className="btn-ghost h-11 px-2 text-xs text-danger"
                            aria-label="Hapus soal"
                            onClick={() => confirm("Hapus soal ini?") && jalankan(() => api(`/api/magang/soal/${s.id}`, { method: "DELETE" }), "Soal dihapus.")}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn-ghost h-11 text-xs"
                        onClick={() => setFormSoal({ posId: p.id, pertanyaan: "", pilihan: ["", "", "", ""], benar: 0, aktif: true })}
                      >
                        <IconPlus /> Tambah soal
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.pos.length > 0 && data.pos.length < 3 && <Kosong>Tambah beberapa pos lagi supaya rotasinya bermakna.</Kosong>}

      {formPos && (
        <Modal title={formPos.id ? `Ubah pos ${formPos.nama}` : "Tambah pos kerja"} onClose={() => setFormPos(null)}>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-fg">Nama pos</span>
              <input className="input mt-1.5" value={formPos.nama} onChange={(e) => setFormPos({ ...formPos, nama: e.target.value })} placeholder="mis. Operator Cetak" maxLength={80} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-fg">Lokasi (opsional)</span>
              <input
                className="input mt-1.5"
                value={formPos.lokasi}
                onChange={(e) => setFormPos({ ...formPos, lokasi: e.target.value })}
                placeholder="mis. Pusat atau Cabang 2"
                maxLength={80}
                list="saran-lokasi-pos"
              />
              <datalist id="saran-lokasi-pos">
                {[...new Set((data?.pos ?? []).map((p) => p.lokasi).filter((l): l is string => !!l))].map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
              <span className="mt-1 block text-xs text-muted">Isi bila pos ini ada di tempat lain. Tampil di kartu pos dan jadwal rotasi.</span>
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-fg">Lama di pos ini</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {[
                  { n: 1, judul: "1 minggu", bantu: "Pos ringan, alurnya sederhana" },
                  { n: 2, judul: "2 minggu", bantu: "Pos berat: minggu 1 didampingi, minggu 2 mandiri" },
                ].map((o) => (
                  <button
                    key={o.n}
                    type="button"
                    aria-pressed={formPos.durasiMinggu === o.n}
                    onClick={() => setFormPos({ ...formPos, durasiMinggu: o.n })}
                    className={`rounded-xl border p-3 text-left text-sm transition ${
                      formPos.durasiMinggu === o.n ? "border-primary bg-primary/10" : "border-border hover:border-border-strong"
                    }`}
                  >
                    <span className="block font-semibold text-fg">{o.judul}</span>
                    <span className="text-xs text-muted">{o.bantu}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-semibold text-fg">Yang harus dikuasai</span>
              <span className="block text-xs text-muted">Tampil di HP anak sebagai target selama di pos ini. Satu baris satu poin.</span>
              <textarea
                className="input mt-1.5 min-h-32 py-2"
                value={formPos.deskripsi}
                onChange={(e) => setFormPos({ ...formPos, deskripsi: e.target.value })}
                placeholder={"- Menyalakan mesin dengan urutan yang benar\n- Mengecek file sebelum cetak"}
                maxLength={4000}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-fg">Pembimbing</span>
                <select className="input mt-1.5" value={formPos.pembimbingId} onChange={(e) => setFormPos({ ...formPos, pembimbingId: e.target.value })}>
                  <option value="">— belum ditentukan —</option>
                  {data?.karyawan.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Anak sekaligus</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="input mt-1.5"
                  value={formPos.kapasitas}
                  onChange={(e) => setFormPos({ ...formPos, kapasitas: Math.max(1, Number(e.target.value) || 1) })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Urutan</span>
                <input
                  type="number"
                  min={0}
                  className="input mt-1.5"
                  value={formPos.urutan}
                  onChange={(e) => setFormPos({ ...formPos, urutan: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-fg sm:col-span-2">
                <input type="checkbox" checked={formPos.aktif} onChange={(e) => setFormPos({ ...formPos, aktif: e.target.checked })} />
                Aktif (ikut rotasi)
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button className="btn-ghost h-11 text-sm" onClick={() => setFormPos(null)}>
                Batal
              </button>
              <button className="btn-primary h-11 text-sm" onClick={simpanPos} disabled={busy || formPos.nama.trim().length < 2}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {formSoal && (
        <Modal title={formSoal.id ? "Ubah soal" : "Tambah soal"} onClose={() => setFormSoal(null)}>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-fg">Pertanyaan</span>
              <textarea
                className="input mt-1.5 min-h-20 py-2"
                value={formSoal.pertanyaan}
                onChange={(e) => setFormSoal({ ...formSoal, pertanyaan: e.target.value })}
                maxLength={1000}
              />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-fg">Pilihan jawaban — tandai yang benar</legend>
              <div className="mt-1.5 space-y-2">
                {formSoal.pilihan.map((pil, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="benar"
                      aria-label={`Pilihan ${i + 1} benar`}
                      checked={formSoal.benar === i}
                      onChange={() => setFormSoal({ ...formSoal, benar: i })}
                    />
                    <input
                      className="input"
                      value={pil}
                      placeholder={`Pilihan ${i + 1}`}
                      maxLength={300}
                      onChange={(e) => setFormSoal({ ...formSoal, pilihan: formSoal.pilihan.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                    {formSoal.pilihan.length > 2 && (
                      <button
                        type="button"
                        className="btn-ghost h-11 px-2 text-xs"
                        aria-label={`Buang pilihan ${i + 1}`}
                        onClick={() =>
                          setFormSoal({
                            ...formSoal,
                            pilihan: formSoal.pilihan.filter((_, j) => j !== i),
                            benar: formSoal.benar === i ? 0 : formSoal.benar > i ? formSoal.benar - 1 : formSoal.benar,
                          })
                        }
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                ))}
                {formSoal.pilihan.length < 6 && (
                  <button type="button" className="btn-ghost h-11 text-xs" onClick={() => setFormSoal({ ...formSoal, pilihan: [...formSoal.pilihan, ""] })}>
                    <IconPlus /> Tambah pilihan
                  </button>
                )}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm text-fg">
              <input type="checkbox" checked={formSoal.aktif} onChange={(e) => setFormSoal({ ...formSoal, aktif: e.target.checked })} />
              Aktif (ikut diundi)
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button className="btn-ghost h-11 text-sm" onClick={() => setFormSoal(null)}>
                Batal
              </button>
              <button
                className="btn-primary h-11 text-sm"
                onClick={simpanSoal}
                disabled={busy || formSoal.pertanyaan.trim().length < 5 || formSoal.pilihan.some((p) => !p.trim())}
              >
                {busy ? "Menyimpan…" : "Simpan soal"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
