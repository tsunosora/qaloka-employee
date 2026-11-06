"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconCopy, IconPencil, IconPlus } from "@/components/ui/icons";
import { longDate } from "@/components/portal/ui";
import { Judul, Kosong, Memuat, Pesan } from "@/components/magang/ui";

type Peserta = {
  id: number;
  employeeId: number;
  nama: string;
  panggilan: string | null;
  publicToken: string | null;
  sekolah: string | null;
  jurusan: string | null;
  mulai: string;
  selesai: string | null;
  aktif: boolean;
  catatan: string | null;
};
type Payload = { peserta: Peserta[]; calon: { id: number; fullName: string; employeeCode: string }[] };
type Form = { id?: number; employeeId: string; sekolah: string; jurusan: string; mulai: string; selesai: string; aktif: boolean; catatan: string };

function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tigaBulan(dari: string): string {
  const [y, m, d] = dari.split("-").map(Number);
  const t = new Date(y, m - 1 + 3, d - 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export default function PesertaMagangPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const ambil = useCallback(() => api<Payload>("/api/magang/peserta"), []);
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

  async function simpan() {
    if (!form) return;
    setBusy(true);
    setGalat("");
    try {
      const body = JSON.stringify({
        employeeId: Number(form.employeeId),
        sekolah: form.sekolah || null,
        jurusan: form.jurusan || null,
        mulai: form.mulai,
        selesai: form.selesai || null,
        aktif: form.aktif,
        catatan: form.catatan || null,
      });
      await api(form.id ? `/api/magang/peserta/${form.id}` : "/api/magang/peserta", { method: form.id ? "PATCH" : "POST", body });
      setNotice(form.id ? "Data peserta tersimpan." : "Peserta ditambahkan. Susun ulang rotasi supaya dia dapat jadwal pos.");
      setForm(null);
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function salinTautan(p: Peserta) {
    if (!p.publicToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/me/${p.publicToken}`).catch(() => {});
    setNotice(`Tautan halaman pribadi ${p.panggilan || p.nama} disalin. Kirim ke anaknya; dia masuk dengan PIN portal.`);
  }

  const aktif = data?.peserta.filter((p) => p.aktif) ?? [];
  const selesai = data?.peserta.filter((p) => !p.aktif) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Judul
        judul="Peserta Magang"
        keterangan="Anak magang/PKL didaftarkan dulu sebagai karyawan di Direktori (supaya punya halaman pribadi & PIN), lalu ditambahkan di sini. Tugas mingguan diisi dari halaman pribadinya, tab Magang."
        aksi={
          <button
            className="btn-primary h-10 text-sm"
            disabled={!data}
            onClick={() => {
              const mulai = hariIni();
              setForm({ employeeId: "", sekolah: "", jurusan: "", mulai, selesai: tigaBulan(mulai), aktif: true, catatan: "" });
            }}
          >
            <IconPlus className="text-[16px]" /> Tambah peserta
          </button>
        }
      />
      {notice && <Pesan jenis="ok">{notice}</Pesan>}
      {galat && <Pesan jenis="galat">{galat}</Pesan>}

      {!data ? (
        <Memuat />
      ) : data.peserta.length === 0 ? (
        <Kosong>Belum ada peserta magang.</Kosong>
      ) : (
        <>
          {[
            { judul: `Aktif (${aktif.length})`, daftar: aktif },
            { judul: `Selesai / nonaktif (${selesai.length})`, daftar: selesai },
          ]
            .filter((g) => g.daftar.length > 0)
            .map((g) => (
              <section key={g.judul}>
                <h2 className="mb-2 text-sm font-bold text-fg">{g.judul}</h2>
                <ul className="space-y-2">
                  {g.daftar.map((p) => (
                    <li key={p.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-fg">
                          {p.nama} {p.panggilan && <span className="font-normal text-muted">({p.panggilan})</span>}
                        </p>
                        <p className="text-sm text-muted">
                          {[p.sekolah, p.jurusan].filter(Boolean).join(" · ") || "Sekolah belum diisi"} · {longDate(p.mulai)} – {p.selesai ? longDate(p.selesai) : "belum ditentukan"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.publicToken && (
                          <button className="btn-ghost h-9 px-3 text-xs" onClick={() => salinTautan(p)}>
                            <IconCopy /> Tautan HP
                          </button>
                        )}
                        <Link href={`/magang/rapor/${p.id}`} className="btn-ghost h-9 px-3 text-xs">
                          Rapor
                        </Link>
                        <button
                          className="btn-ghost h-9 px-3 text-xs"
                          aria-label={`Ubah ${p.nama}`}
                          onClick={() =>
                            setForm({
                              id: p.id,
                              employeeId: String(p.employeeId),
                              sekolah: p.sekolah ?? "",
                              jurusan: p.jurusan ?? "",
                              mulai: p.mulai,
                              selesai: p.selesai ?? "",
                              aktif: p.aktif,
                              catatan: p.catatan ?? "",
                            })
                          }
                        >
                          <IconPencil /> Ubah
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </>
      )}

      {form && (
        <Modal title={form.id ? "Ubah peserta" : "Tambah peserta magang"} onClose={() => setForm(null)}>
          <div className="space-y-4">
            {!form.id && (
              <label className="block">
                <span className="text-sm font-semibold text-fg">Karyawan</span>
                <select className="input mt-1.5" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">— pilih dari Direktori —</option>
                  {data?.calon.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.fullName} ({k.employeeCode})
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-muted">
                  Belum ada di daftar? Tambahkan dulu di{" "}
                  <Link href="/employees" className="font-semibold text-primary hover:underline">
                    Direktori
                  </Link>
                  .
                </span>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-fg">Sekolah / kampus</span>
                <input className="input mt-1.5" value={form.sekolah} maxLength={150} onChange={(e) => setForm({ ...form, sekolah: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Jurusan</span>
                <input className="input mt-1.5" value={form.jurusan} maxLength={100} onChange={(e) => setForm({ ...form, jurusan: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Mulai magang</span>
                <input type="date" className="input mt-1.5" value={form.mulai} onChange={(e) => setForm({ ...form, mulai: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Selesai magang</span>
                <input type="date" className="input mt-1.5" value={form.selesai} min={form.mulai} onChange={(e) => setForm({ ...form, selesai: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-fg">Catatan</span>
              <textarea className="input mt-1.5 min-h-20 py-2" value={form.catatan} maxLength={2000} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
            </label>
            {form.id && (
              <label className="flex items-center gap-2 text-sm text-fg">
                <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
                Masih magang (hilangkan centang bila sudah selesai — rapornya tetap tersimpan)
              </label>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button className="btn-ghost h-10 text-sm" onClick={() => setForm(null)}>
                Batal
              </button>
              <button className="btn-primary h-10 text-sm" onClick={simpan} disabled={busy || !form.employeeId || !form.mulai}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
