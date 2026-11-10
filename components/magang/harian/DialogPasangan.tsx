"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconAlert, IconPencil, IconPlus } from "@/components/ui/icons";
import { Pesan } from "@/components/magang/ui";
import { soft } from "@/components/portal/ui";
import { labelTanggal, type TugasHarian } from "@/lib/services/magang/harian";
import { LencanaTugas } from "./ui";
import { labelPasangan, type AnakJson, type PasanganJson } from "./tipe";

type Form = { nama: string; pesertaAId: number | ""; pesertaBId: number | ""; patokanTanggal: string; patokanTugas: TugasHarian; aktif: boolean; urutan: number };

const kosong = (hari: string, urutan: number): Form => ({ nama: "", pesertaAId: "", pesertaBId: "", patokanTanggal: hari, patokanTugas: "konten", aktif: true, urutan });
const dariPasangan = (p: PasanganJson): Form => ({
  nama: p.nama ?? "",
  pesertaAId: p.pesertaAId,
  pesertaBId: p.pesertaBId ?? "",
  patokanTanggal: p.patokanTanggal,
  patokanTugas: p.patokanTugas,
  aktif: p.aktif,
  urutan: p.urutan,
});

/**
 * Kelola pasangan: daftar + formulir (2 anak dari peserta aktif, nama opsional, tanggal patokan + tugasnya, aktif,
 * urutan). Peringatan bila anak sudah di pasangan aktif lain (server juga menolak). Ubah = hanya kolom yang berubah.
 */
export function DialogPasangan({
  pasangan,
  anak,
  hariIni,
  onClose,
  onBerubah,
}: {
  pasangan: PasanganJson[];
  anak: AnakJson[];
  hariIni: string;
  onClose: () => void;
  onBerubah: (pesan: string) => void;
}) {
  const [edit, setEdit] = useState<PasanganJson | "baru" | null>(pasangan.length === 0 ? "baru" : null);
  const [form, setForm] = useState<Form>(() => kosong(hariIni, pasangan.length + 1));
  const [hapusTanya, setHapusTanya] = useState(false);
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");

  const editId = edit && edit !== "baru" ? edit.id : null;
  const nama = (id: number | "") => anak.find((a) => a.pesertaId === id)?.panggilan ?? "";
  const pilihan = anak.filter((a) => a.aktif || a.pesertaId === form.pesertaAId || a.pesertaId === form.pesertaBId);
  // Anak yang sudah ada di pasangan AKTIF lain (aturan satu anak = satu pasangan aktif).
  const bentrok = form.aktif
    ? [form.pesertaAId, form.pesertaBId].filter((x): x is number => x !== "" && pasangan.some((p) => p.aktif && p.id !== editId && (p.pesertaAId === x || p.pesertaBId === x)))
    : [];

  function mulai(p: PasanganJson | "baru") {
    setEdit(p);
    setForm(p === "baru" ? kosong(hariIni, Math.max(0, ...pasangan.map((x) => x.urutan)) + 1) : dariPasangan(p));
    setHapusTanya(false);
    setGalat("");
  }

  async function simpan() {
    if (form.pesertaAId === "") {
      setGalat("Pilih anak pertama.");
      return;
    }
    const isi = {
      nama: form.nama.trim() || null,
      pesertaAId: form.pesertaAId,
      pesertaBId: form.pesertaBId === "" ? null : form.pesertaBId,
      patokanTanggal: form.patokanTanggal,
      patokanTugas: form.patokanTugas,
      aktif: form.aktif,
      urutan: form.urutan,
    };
    setBusy(true);
    setGalat("");
    try {
      if (edit === "baru") {
        await api("/api/magang/harian/pasangan", { method: "POST", body: JSON.stringify(isi) });
      } else if (edit) {
        // Hanya kolom yang berubah dikirim (PATCH sebagian).
        const lama = dariPasangan(edit);
        const ubah: Record<string, unknown> = {};
        if (form.nama.trim() !== lama.nama.trim()) ubah.nama = isi.nama;
        if (form.pesertaAId !== lama.pesertaAId) ubah.pesertaAId = isi.pesertaAId;
        if (form.pesertaBId !== lama.pesertaBId) ubah.pesertaBId = isi.pesertaBId;
        if (form.patokanTanggal !== lama.patokanTanggal) ubah.patokanTanggal = isi.patokanTanggal;
        if (form.patokanTugas !== lama.patokanTugas) ubah.patokanTugas = isi.patokanTugas;
        if (form.aktif !== lama.aktif) ubah.aktif = isi.aktif;
        if (form.urutan !== lama.urutan) ubah.urutan = isi.urutan;
        if (Object.keys(ubah).length) await api(`/api/magang/harian/pasangan/${edit.id}`, { method: "PATCH", body: JSON.stringify(ubah) });
      }
      onBerubah(edit === "baru" ? "Pasangan dibuat." : "Pasangan disimpan.");
      setEdit(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan pasangan.");
    } finally {
      setBusy(false);
    }
  }

  async function hapus() {
    if (!editId) return;
    setBusy(true);
    try {
      await api(`/api/magang/harian/pasangan/${editId}`, { method: "DELETE" });
      onBerubah("Pasangan dihapus.");
      setEdit(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Kelola pasangan" onClose={onClose} size="xl">
      <div className="space-y-4">
        <ul className="space-y-2">
          {pasangan.map((p) => (
            <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${editId === p.id ? "border-primary" : "border-border"}`}>
              <div className="min-w-0">
                <p className="font-semibold text-fg">
                  {labelPasangan(p)}
                  {!p.aktif && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">Nonaktif</span>}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {p.nama && <span>{p.namaB ? `${p.namaA} & ${p.namaB}` : `${p.namaA} (sendiri)`} ·</span>}
                  Patokan {labelTanggal(p.patokanTanggal)} <LencanaTugas tugas={p.patokanTugas} ukuran="kecil" /> · urutan {p.urutan}
                </p>
              </div>
              <button type="button" className="btn-ghost inline-flex h-11 items-center gap-1.5 px-3 text-sm" onClick={() => mulai(p)}>
                <IconPencil aria-hidden="true" /> Ubah
              </button>
            </li>
          ))}
        </ul>
        {edit === null && (
          <button type="button" className="btn-primary inline-flex h-11 items-center gap-1.5 px-4 text-sm" onClick={() => mulai("baru")}>
            <IconPlus aria-hidden="true" /> Tambah pasangan
          </button>
        )}

        {edit !== null && (
          <form
            className="space-y-3 rounded-2xl border border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void simpan();
            }}
          >
            <p className="font-display text-base font-bold text-fg">{edit === "baru" ? "Pasangan baru" : `Ubah ${labelPasangan(edit)}`}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-fg">Anak 1</span>
                <select className="input mt-1 h-11" value={form.pesertaAId} onChange={(e) => setForm({ ...form, pesertaAId: e.target.value ? Number(e.target.value) : "" })} required>
                  <option value="">— pilih —</option>
                  {pilihan.map((a) => (
                    <option key={a.pesertaId} value={a.pesertaId} disabled={a.pesertaId === form.pesertaBId}>
                      {a.panggilan}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Anak 2</span>
                <select className="input mt-1 h-11" value={form.pesertaBId} onChange={(e) => setForm({ ...form, pesertaBId: e.target.value ? Number(e.target.value) : "" })}>
                  <option value="">— belum ada (sendiri) —</option>
                  {pilihan.map((a) => (
                    <option key={a.pesertaId} value={a.pesertaId} disabled={a.pesertaId === form.pesertaAId}>
                      {a.panggilan}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Tanggal patokan</span>
                <input type="date" className="input mt-1 h-11" value={form.patokanTanggal} onChange={(e) => setForm({ ...form, patokanTanggal: e.target.value })} required />
              </label>
              <fieldset>
                <legend className="text-sm font-semibold text-fg">Tugas pada tanggal itu</legend>
                <div className="mt-1 flex gap-2">
                  {(["konten", "produksi"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={form.patokanTugas === t}
                      onClick={() => setForm({ ...form, patokanTugas: t })}
                      className={`min-h-11 flex-1 rounded-xl border-2 px-2 font-display text-sm font-extrabold ${form.patokanTugas === t ? "border-primary bg-primary/10 text-fg" : "border-border text-muted"}`}
                    >
                      {t === "konten" ? "KONTEN" : "PRODUKSI"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Nama pasangan (opsional)</span>
                <input className="input mt-1 h-11" maxLength={80} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder={form.pesertaAId !== "" ? `${nama(form.pesertaAId)}${form.pesertaBId !== "" ? ` & ${nama(form.pesertaBId)}` : ""}` : "mis. Tim 1"} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Urutan</span>
                <input type="number" min={0} max={999} className="input mt-1 h-11" value={form.urutan} onChange={(e) => setForm({ ...form, urutan: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
              <input type="checkbox" className="h-5 w-5" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
              Aktif (tampil di jadwal)
            </label>
            {bentrok.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm text-warning" style={soft("var(--warning)")}>
                <IconAlert className="mt-0.5 shrink-0" aria-hidden="true" />
                {bentrok.map(nama).join(" & ")} sudah ada di pasangan aktif lain. Nonaktifkan / ubah pasangan itu dulu.
              </p>
            )}
            <p className="text-xs text-muted">Tugas bergantian tiap hari kerja (Senin–Sabtu); Minggu & tanggal merah dilewati.</p>
            {galat && <Pesan jenis="galat">{galat}</Pesan>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary h-11 px-4 text-sm" disabled={busy || bentrok.length > 0}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
              <button type="button" className="btn-ghost h-11 px-4 text-sm" onClick={() => setEdit(null)}>
                Batal
              </button>
              {editId != null &&
                (hapusTanya ? (
                  <button type="button" className="btn-ghost h-11 px-4 text-sm text-danger" disabled={busy} onClick={hapus}>
                    Ya, hapus pasangan ini
                  </button>
                ) : (
                  <button type="button" className="btn-ghost h-11 px-4 text-sm text-danger" onClick={() => setHapusTanya(true)}>
                    Hapus…
                  </button>
                ))}
            </div>
            {hapusTanya && <p className="text-xs text-muted">Pengecualian pasangan ini ikut terhapus. Untuk berhenti sementara, cukup hilangkan centang Aktif.</p>}
          </form>
        )}
      </div>
    </Modal>
  );
}
