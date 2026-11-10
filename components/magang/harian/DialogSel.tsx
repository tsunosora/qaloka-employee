"use client";

import { useId, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconTrash } from "@/components/ui/icons";
import { Pesan } from "@/components/magang/ui";
import { labelTanggal, type TugasHarian } from "@/lib/services/magang/harian";
import { IKON_TUGAS, IkonLibur, LencanaLibur, LencanaTugas, WARNA_TUGAS } from "./ui";
import { labelPasangan, type AnakJson, type PasanganJson, type SelJson } from "./tipe";

type PilihanHari = TugasHarian | "libur";

/** Tombol pilihan besar (≥44 px) — warna + ikon + teks. */
function TombolPilih({ aktif, onClick, pilihan }: { aktif: boolean; onClick: () => void; pilihan: PilihanHari }) {
  const Ikon = pilihan === "libur" ? IkonLibur : IKON_TUGAS[pilihan];
  const warna = pilihan === "libur" ? "var(--fg-muted)" : WARNA_TUGAS[pilihan];
  return (
    <button
      type="button"
      aria-pressed={aktif}
      onClick={onClick}
      className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 font-display text-sm font-extrabold tracking-wide transition ${
        aktif ? "" : "border-border text-muted hover:border-border-strong"
      }`}
      style={aktif ? { borderColor: warna, color: warna, background: `color-mix(in oklab, ${warna} 14%, transparent)` } : undefined}
    >
      <Ikon className="text-[18px]" />
      {pilihan === "libur" ? "LIBUR" : pilihan === "konten" ? "KONTEN" : "PRODUKSI"}
    </button>
  );
}

/**
 * Dialog satu kotak (tanggal × pasangan): ganti tugas pasangan hari itu / libur / catatan; ganti pasangan untuk
 * satu anak hari itu (atau liburkan anak itu saja); hapus pengecualian. Giliran hari berikutnya tidak berubah.
 */
export function DialogSel({
  tanggal,
  sel,
  pasangan,
  anak,
  onClose,
  onBerubah,
}: {
  tanggal: string;
  sel: SelJson;
  pasangan: PasanganJson;
  anak: AnakJson[];
  onClose: () => void;
  onBerubah: (pesan: string) => void;
}) {
  const id = useId();
  const awal: PilihanHari = sel.libur ? "libur" : (sel.tugas ?? sel.tugasPola ?? "konten");
  const [pilih, setPilih] = useState<PilihanHari>(awal);
  const [catatan, setCatatan] = useState(sel.catatan ?? "");
  const anggota = sel.anggota;
  const [anakId, setAnakId] = useState<number>(anggota[0]?.pesertaId ?? 0);
  const [mode, setMode] = useState<"pasangan" | "libur">("pasangan");
  const [rekanId, setRekanId] = useState<number | "">("");
  const [tugasAnak, setTugasAnak] = useState<TugasHarian | "">("");
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");

  const calonRekan = anak.filter((a) => a.aktif && a.pesertaId !== anakId && a.mulai <= tanggal && (!a.selesai || a.selesai >= tanggal));
  const diubahAnak = anggota.filter((a) => a.pengecualianId != null);

  async function kirim(fn: () => Promise<unknown>, pesan: string) {
    setBusy(true);
    setGalat("");
    try {
      await fn();
      onBerubah(pesan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  const simpanPasangan = () =>
    kirim(
      () =>
        api("/api/magang/harian/pengecualian", {
          method: "POST",
          body: JSON.stringify({ tanggal, pasanganId: sel.pasanganId, jenis: pilih === "libur" ? "libur" : "tugas", tugas: pilih === "libur" ? null : pilih, catatan }),
        }),
      `${labelTanggal(tanggal)} · ${labelPasangan(pasangan)}: ${pilih === "libur" ? "libur" : pilih.toUpperCase()}.`
    );

  const hapus = (pid: number, pesan: string) => kirim(() => api(`/api/magang/harian/pengecualian/${pid}`, { method: "DELETE" }), pesan);

  const simpanAnak = () => {
    const nama = anak.find((a) => a.pesertaId === anakId)?.panggilan ?? "Anak";
    if (mode === "pasangan" && rekanId === "") {
      setGalat("Pilih rekan pengganti.");
      return;
    }
    return kirim(
      () =>
        api("/api/magang/harian/pengecualian", {
          method: "POST",
          body: JSON.stringify(
            mode === "libur"
              ? { tanggal, pesertaId: anakId, jenis: "libur" }
              : { tanggal, pesertaId: anakId, jenis: "pasangan", pasanganPesertaId: rekanId, tugas: tugasAnak || null }
          ),
        }),
      mode === "libur" ? `${nama} libur ${labelTanggal(tanggal)}.` : `${nama} bersama ${anak.find((a) => a.pesertaId === rekanId)?.panggilan} pada ${labelTanggal(tanggal)}.`
    );
  };

  return (
    <Modal title={`${labelTanggal(tanggal)} · ${labelPasangan(pasangan)}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>Sekarang:</span>
          {sel.libur ? <LencanaLibur /> : sel.tugas ? <LencanaTugas tugas={sel.tugas} /> : <span className="font-semibold text-fg">—</span>}
          {sel.tugasPola && <span>· menurut pola: {sel.tugasPola === "konten" ? "KONTEN" : "PRODUKSI"}</span>}
        </div>

        <fieldset className="space-y-3">
          <legend className="font-display text-base font-bold text-fg">Pasangan ini hari ini</legend>
          <div className="flex flex-wrap gap-2">
            {(["konten", "produksi", "libur"] as const).map((x) => (
              <TombolPilih key={x} pilihan={x} aktif={pilih === x} onClick={() => setPilih(x)} />
            ))}
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-fg">Catatan (opsional, hanya untuk pembina)</span>
            <input id={`${id}-cat`} className="input mt-1 h-11" maxLength={200} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. pemotretan produk baru" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary h-11 px-4 text-sm" disabled={busy} onClick={simpanPasangan}>
              Simpan untuk hari ini
            </button>
            {sel.pengecualianId != null && (
              <button type="button" className="btn-ghost h-11 px-4 text-sm" disabled={busy} onClick={() => hapus(sel.pengecualianId!, `${labelTanggal(tanggal)} kembali mengikuti pola.`)}>
                Kembalikan ke pola
              </button>
            )}
          </div>
          <p className="text-xs text-muted">Hanya hari ini. Giliran hari-hari berikutnya tidak berubah.</p>
        </fieldset>

        {anggota.length > 0 && (
          <fieldset className="space-y-3 border-t border-border pt-4">
            <legend className="font-display text-base font-bold text-fg">Ubah satu anak hari ini</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-fg">Anak</span>
                <select className="input mt-1 h-11" value={anakId} onChange={(e) => setAnakId(Number(e.target.value))}>
                  {anggota.map((a) => (
                    <option key={a.pesertaId} value={a.pesertaId}>
                      {a.panggilan}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Diubah menjadi</span>
                <select className="input mt-1 h-11" value={mode} onChange={(e) => setMode(e.target.value as "pasangan" | "libur")}>
                  <option value="pasangan">Kerja bersama anak lain</option>
                  <option value="libur">Libur (anak ini saja)</option>
                </select>
              </label>
              {mode === "pasangan" && (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-fg">Rekan hari ini</span>
                    <select className="input mt-1 h-11" value={rekanId} onChange={(e) => setRekanId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">— pilih —</option>
                      {calonRekan.map((a) => (
                        <option key={a.pesertaId} value={a.pesertaId}>
                          {a.panggilan}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-fg">Tugas</span>
                    <select className="input mt-1 h-11" value={tugasAnak} onChange={(e) => setTugasAnak(e.target.value as TugasHarian | "")}>
                      <option value="">Ikut pola pasangannya</option>
                      <option value="konten">KONTEN</option>
                      <option value="produksi">PRODUKSI</option>
                    </select>
                  </label>
                </>
              )}
            </div>
            <button type="button" className="btn-primary h-11 px-4 text-sm" disabled={busy} onClick={simpanAnak}>
              Simpan untuk anak ini
            </button>
            {mode === "pasangan" && <p className="text-xs text-muted">Rekan lama masing-masing bekerja sendiri hari itu.</p>}
          </fieldset>
        )}

        {diubahAnak.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="font-display text-base font-bold text-fg">Perubahan anak hari ini</p>
            <ul className="space-y-2">
              {diubahAnak.map((a) => (
                <li key={a.pesertaId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                  <span className="text-fg">
                    <b>{a.panggilan}</b>: {a.keadaan === "libur" ? "libur" : a.rekan ? `bersama ${a.rekan}` : "sendiri"}
                    {a.tugas && ` · ${a.tugas.toUpperCase()}`}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost inline-flex h-11 items-center gap-1.5 px-3 text-sm text-danger"
                    disabled={busy}
                    onClick={() => hapus(a.pengecualianId!, `Perubahan ${a.panggilan} ${labelTanggal(tanggal)} dihapus.`)}
                  >
                    <IconTrash aria-hidden="true" /> Hapus
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {galat && <Pesan jenis="galat">{galat}</Pesan>}
      </div>
    </Modal>
  );
}
