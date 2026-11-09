"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconCopy, IconPencil, IconPlus } from "@/components/ui/icons";
import { longDate } from "@/components/portal/ui";
import { Judul, Kosong, Memuat, Pesan } from "@/components/magang/ui";
import { Pendaftaran } from "@/components/magang/Pendaftaran";
import { daftarSekolah, kunciSekolah, sekolahSama } from "@/lib/services/magang/sekolah";

type Peserta = {
  id: number;
  employeeId: number;
  nama: string;
  panggilan: string | null;
  publicToken: string | null;
  sekolah: string | null;
  jurusan: string | null;
  guruPembimbing: string | null;
  kontakGuru: string | null;
  mulai: string;
  selesai: string | null;
  aktif: boolean;
  catatan: string | null;
};
type Payload = { peserta: Peserta[]; calon: { id: number; fullName: string; employeeCode: string }[] };
type Form = {
  id?: number;
  /** "baru" = buat akun karyawan sekaligus; "direktori" = pilih karyawan yang sudah ada. */
  mode: "baru" | "direktori";
  employeeId: string;
  namaLengkap: string;
  panggilan: string;
  hp: string;
  sekolah: string;
  jurusan: string;
  guruPembimbing: string;
  kontakGuru: string;
  mulai: string;
  selesai: string;
  aktif: boolean;
  catatan: string;
};

/** Nilai saringan untuk peserta yang sekolahnya belum diisi. */
const TANPA_SEKOLAH = "__tanpa";

/** Urut per sekolah (huruf besar/kecil diabaikan; yang belum diisi di akhir) supaya satu rombongan berkumpul. */
function urutSekolah(a: Peserta, b: Peserta): number {
  if (!a.sekolah !== !b.sekolah) return a.sekolah ? -1 : 1;
  return kunciSekolah(a.sekolah).localeCompare(kunciSekolah(b.sekolah), "id") || a.mulai.localeCompare(b.mulai) || a.nama.localeCompare(b.nama, "id");
}

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
  /** "" = semua sekolah; TANPA_SEKOLAH; selain itu kunciSekolah(). */
  const [saringSekolah, setSaringSekolah] = useState("");

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

  const pesan = (ok: boolean, teks: string) => {
    if (ok) {
      setNotice(teks);
      setGalat("");
    } else setGalat(teks);
  };

  async function salinKe(token: string, nama: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/me/${token}`).catch(() => {});
    setNotice(`Tautan halaman pribadi ${nama} disalin. Kirim ke anaknya lewat WhatsApp; saat pertama dibuka dia membuat PIN sendiri.`);
  }

  async function simpan() {
    if (!form) return;
    setBusy(true);
    setGalat("");
    try {
      const umum = {
        sekolah: form.sekolah || null,
        jurusan: form.jurusan || null,
        guruPembimbing: form.guruPembimbing.trim() || null,
        kontakGuru: form.kontakGuru.trim() || null,
        mulai: form.mulai,
        selesai: form.selesai || null,
        catatan: form.catatan || null,
      };
      if (form.id) {
        await api(`/api/magang/peserta/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...umum, employeeId: Number(form.employeeId), aktif: form.aktif }),
        });
        setNotice("Data peserta tersimpan.");
      } else if (form.mode === "baru") {
        const r = await api<{ publicToken: string }>("/api/magang/peserta/baru", {
          method: "POST",
          body: JSON.stringify({ ...umum, namaLengkap: form.namaLengkap, panggilan: form.panggilan || null, hp: form.hp || null }),
        });
        await salinKe(r.publicToken, form.panggilan || form.namaLengkap);
      } else {
        await api("/api/magang/peserta", { method: "POST", body: JSON.stringify({ ...umum, employeeId: Number(form.employeeId) }) });
        setNotice("Peserta ditambahkan. Susun ulang rotasi supaya dia dapat jadwal pos.");
      }
      setForm(null);
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const sekolahUnik = daftarSekolah((data?.peserta ?? []).map((p) => p.sekolah));
  const adaTanpaSekolah = data?.peserta.some((p) => !kunciSekolah(p.sekolah)) ?? false;
  const labelSaringan = sekolahUnik.find((s) => s.kunci === saringSekolah)?.label ?? "";
  const tersaring = (data?.peserta ?? [])
    .filter((p) => !saringSekolah || (saringSekolah === TANPA_SEKOLAH ? !kunciSekolah(p.sekolah) : sekolahSama(p.sekolah, saringSekolah)))
    .sort(urutSekolah);
  const aktif = tersaring.filter((p) => p.aktif);
  const selesai = tersaring.filter((p) => !p.aktif);
  const siap = form && form.mulai && (form.id || (form.mode === "baru" ? form.namaLengkap.trim().length >= 3 : !!form.employeeId));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Judul
        judul="Peserta Magang"
        keterangan="Tambahkan anak magang langsung di sini, atau bagikan tautan pendaftaran supaya mereka mendaftar sendiri (Anda tinggal menyetujui). Tiap anak punya halaman pribadi di HP untuk jurnal harian & tugas mingguan."
        aksi={
          <button
            className="btn-primary h-11 text-sm"
            disabled={!data}
            onClick={() => {
              const mulai = hariIni();
              setForm({
                mode: "baru",
                employeeId: "",
                namaLengkap: "",
                panggilan: "",
                hp: "",
                sekolah: labelSaringan,
                jurusan: "",
                guruPembimbing: "",
                kontakGuru: "",
                mulai, selesai: tigaBulan(mulai), aktif: true, catatan: "" });
            }}
          >
            <IconPlus className="text-[16px]" /> Tambah peserta
          </button>
        }
      />
      {notice && <Pesan jenis="ok">{notice}</Pesan>}
      {galat && <Pesan jenis="galat">{galat}</Pesan>}

      <Pendaftaran hariIni={hariIni()} onBerubah={muat} onPesan={pesan} sekolahPeserta={data?.peserta.map((p) => p.sekolah) ?? []} />

      {!data ? (
        <Memuat />
      ) : data.peserta.length === 0 ? (
        <Kosong>Belum ada peserta magang.</Kosong>
      ) : (
        <>
          {(sekolahUnik.length > 1 || (sekolahUnik.length > 0 && adaTanpaSekolah)) && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block w-full sm:w-80">
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
              <p className="pb-3 text-xs text-muted">Daftar diurutkan per sekolah supaya anak satu rombongan berkumpul.</p>
            </div>
          )}
          {aktif.length + selesai.length === 0 && <Kosong>Tidak ada peserta dari sekolah ini.</Kosong>}
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
                      {p.guruPembimbing && (
                        <p className="text-xs text-subtle">
                          Guru pembimbing: {p.guruPembimbing}
                          {p.kontakGuru && ` · ${p.kontakGuru}`}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {p.publicToken && (
                        <button className="btn-ghost h-11 px-3 text-xs" onClick={() => salinKe(p.publicToken!, p.panggilan || p.nama)}>
                          <IconCopy /> Tautan HP
                        </button>
                      )}
                      <Link href={`/magang/rapor/${p.id}`} className="btn-ghost h-11 px-3 text-xs">
                        Rapor
                      </Link>
                      <button
                        className="btn-ghost h-11 px-3 text-xs"
                        aria-label={`Ubah ${p.nama}`}
                        onClick={() =>
                          setForm({
                            id: p.id,
                            mode: "direktori",
                            employeeId: String(p.employeeId),
                            namaLengkap: p.nama,
                            panggilan: p.panggilan ?? "",
                            hp: "",
                            sekolah: p.sekolah ?? "",
                            jurusan: p.jurusan ?? "",
                            guruPembimbing: p.guruPembimbing ?? "",
                            kontakGuru: p.kontakGuru ?? "",
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
        <Modal title={form.id ? `Ubah ${form.namaLengkap}` : "Tambah peserta magang"} onClose={() => setForm(null)}>
          <div className="space-y-4">
            {!form.id && (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cara menambah">
                {(
                  [
                    { k: "baru", judul: "Buat akun baru", bantu: "Untuk anak yang belum ada di sistem" },
                    { k: "direktori", judul: "Pilih dari Direktori", bantu: "Sudah terdaftar sebagai karyawan" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    role="radio"
                    aria-checked={form.mode === o.k}
                    onClick={() => setForm({ ...form, mode: o.k })}
                    className={`rounded-xl border p-3 text-left text-sm transition ${form.mode === o.k ? "border-primary bg-primary/10" : "border-border hover:border-border-strong"}`}
                  >
                    <span className="block font-semibold text-fg">{o.judul}</span>
                    <span className="text-xs text-muted">{o.bantu}</span>
                  </button>
                ))}
              </div>
            )}
            {!form.id && form.mode === "baru" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold text-fg">Nama lengkap</span>
                  <input className="input mt-1.5" value={form.namaLengkap} maxLength={150} onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-fg">Nama panggilan</span>
                  <input className="input mt-1.5" value={form.panggilan} maxLength={50} onChange={(e) => setForm({ ...form, panggilan: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-fg">Nomor HP</span>
                  <input className="input mt-1.5" value={form.hp} maxLength={30} inputMode="tel" onChange={(e) => setForm({ ...form, hp: e.target.value })} />
                </label>
              </div>
            )}
            {!form.id && form.mode === "direktori" && (
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
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-fg">Sekolah / kampus</span>
                <input
                  className="input mt-1.5"
                  value={form.sekolah}
                  maxLength={150}
                  list="daftar-sekolah-peserta"
                  onChange={(e) => setForm({ ...form, sekolah: e.target.value })}
                />
                <datalist id="daftar-sekolah-peserta">
                  {sekolahUnik.map((s) => (
                    <option key={s.kunci} value={s.label} />
                  ))}
                </datalist>
                <span className="mt-1 block text-xs text-muted">Pilih dari saran bila sekolahnya sudah ada, supaya tulisannya seragam.</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Jurusan</span>
                <input className="input mt-1.5" value={form.jurusan} maxLength={100} onChange={(e) => setForm({ ...form, jurusan: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Guru pembimbing sekolah</span>
                <input
                  className="input mt-1.5"
                  value={form.guruPembimbing}
                  maxLength={150}
                  placeholder="Boleh dikosongkan"
                  onChange={(e) => setForm({ ...form, guruPembimbing: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Kontak guru (HP/WA)</span>
                <input
                  className="input mt-1.5"
                  value={form.kontakGuru}
                  maxLength={60}
                  inputMode="tel"
                  placeholder="Boleh dikosongkan"
                  onChange={(e) => setForm({ ...form, kontakGuru: e.target.value })}
                />
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
            {!form.id && form.mode === "baru" && (
              <p className="text-xs text-muted">Sesudah disimpan, tautan halaman pribadinya langsung tersalin — kirim ke anaknya. Dia membuat PIN sendiri saat pertama membuka.</p>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button className="btn-ghost h-11 text-sm" onClick={() => setForm(null)}>
                Batal
              </button>
              <button className="btn-primary h-11 text-sm" onClick={simpan} disabled={busy || !siap}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
