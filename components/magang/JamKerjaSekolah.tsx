"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconClock } from "@/components/ui/icons";
import { soft } from "@/components/portal/ui";

export type JamSekolahData = { jamMasuk: string; jamPulang: string; toleransiMenit: number | null; label: string } | null;
export type HitungUlang = {
  pratinjau: boolean;
  barisBerubah: number;
  anak: { pesertaId: number; baris: number; berubah: number; terlambatSebelum: number; terlambatSesudah: number }[];
};

const titik = (j: string) => j.replace(":", ".");

/** Ringkasan hasil hitung ulang / pratinjau untuk ditampilkan. */
export function teksHitungUlang(h: HitungUlang): string {
  const sebelum = h.anak.reduce((s, a) => s + a.terlambatSebelum, 0);
  const sesudah = h.anak.reduce((s, a) => s + a.terlambatSesudah, 0);
  const baris = h.barisBerubah === 0 ? "tidak ada absensi tersimpan yang berubah" : `${h.barisBerubah} baris absensi ${h.pratinjau ? "akan" : "sudah"} dihitung ulang`;
  return `${baris}; hari terlambat ${sebelum} → ${sesudah} (${h.anak.length} anak, maks. 62 hari ke belakang).`;
}

/** Bagian "Jam kerja" di kartu Magang → Sekolah: jam masuk/pulang anak sekolah ini + toleransi opsional. */
export function JamKerjaSekolah({
  kunci,
  label,
  jam,
  toleransiUmum,
  jamToko,
  onBerubah,
}: {
  kunci: string;
  label: string;
  jam: JamSekolahData;
  toleransiUmum: number;
  jamToko: { masuk: string; pulang: string };
  onBerubah: () => void;
}) {
  const [masuk, setMasuk] = useState(jam?.jamMasuk ?? "");
  const [pulang, setPulang] = useState(jam?.jamPulang ?? "");
  const [tol, setTol] = useState(jam?.toleransiMenit != null ? String(jam.toleransiMenit) : "");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const id = `jam-${kunci.replace(/[^a-z0-9]+/gi, "-")}`;

  const tolNum = tol.trim() === "" ? null : Number(tol);
  const lengkap = /^\d{2}:\d{2}$/.test(masuk) && /^\d{2}:\d{2}$/.test(pulang);
  const urut = lengkap && masuk < pulang;
  const tolSah = tolNum === null || (Number.isInteger(tolNum) && tolNum >= 0 && tolNum <= 180);
  const berubah = masuk !== (jam?.jamMasuk ?? "") || pulang !== (jam?.jamPulang ?? "") || tolNum !== (jam?.toleransiMenit ?? null);
  const bisa = lengkap && urut && tolSah;

  async function kirim(pratinjau: boolean) {
    if (!bisa) return setGalat(!lengkap ? "Isi jam masuk dan jam pulang." : !urut ? "Jam masuk harus sebelum jam pulang." : "Toleransi 0–180 menit, atau kosongkan.");
    setSibuk(true);
    setGalat("");
    setInfo("");
    try {
      const r = await api<{ hitungUlang: HitungUlang }>(`/api/magang/jam/sekolah${pratinjau ? "?pratinjau=1" : ""}`, {
        method: "PUT",
        body: JSON.stringify({ sekolahKunci: kunci, jamMasuk: masuk, jamPulang: pulang, toleransiMenit: tolNum }),
      });
      setInfo(pratinjau ? `Pratinjau: ${teksHitungUlang(r.hitungUlang)}` : `Jam kerja disimpan; ${teksHitungUlang(r.hitungUlang)}`);
      if (!pratinjau) onBerubah();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapus() {
    if (!window.confirm(`Hapus jam kerja ${label}? Anak sekolah ini kembali memakai jam toko (kecuali yang punya jam khusus).`)) return;
    setSibuk(true);
    setGalat("");
    setInfo("");
    try {
      const r = await api<{ hitungUlang: HitungUlang }>(`/api/magang/jam/sekolah?kunci=${encodeURIComponent(kunci)}`, { method: "DELETE" });
      setMasuk("");
      setPulang("");
      setTol("");
      setInfo(`Jam kerja dihapus; ${teksHitungUlang(r.hitungUlang)}`);
      onBerubah();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-fg">
        <IconClock className="text-[16px]" aria-hidden="true" /> Jam kerja anak magang
        <span className="font-normal text-muted">
          {jam ? (
            <>
              · sekarang <b className="tabular text-fg">{jam.label}</b>
            </>
          ) : (
            <>· belum diatur — memakai jam toko {titik(jamToko.masuk)}–{titik(jamToko.pulang)}</>
          )}
        </span>
      </h3>
      <p className="mt-1 text-xs text-muted">
        Dipakai menghitung terlambat, pulang awal & lembur semua anak sekolah ini. Jam khusus per anak diatur di Magang → Peserta. Karyawan biasa tidak terpengaruh.
      </p>

      {galat && (
        <p role="alert" className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
          <IconAlert className="shrink-0" aria-hidden="true" /> {galat}
        </p>
      )}
      {info && (
        <p role="status" className="mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-sm text-success" style={soft("var(--success)")}>
          <IconCheck className="mt-0.5 shrink-0" aria-hidden="true" /> {info}
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label htmlFor={`${id}-masuk`} className="block">
          <span className="text-sm font-semibold text-fg">Jam masuk</span>
          <input id={`${id}-masuk`} type="time" className="input tabular mt-1.5 h-11" value={masuk} onChange={(e) => setMasuk(e.target.value)} />
        </label>
        <label htmlFor={`${id}-pulang`} className="block">
          <span className="text-sm font-semibold text-fg">Jam pulang</span>
          <input id={`${id}-pulang`} type="time" className="input tabular mt-1.5 h-11" value={pulang} onChange={(e) => setPulang(e.target.value)} />
        </label>
        <label htmlFor={`${id}-tol`} className="block">
          <span className="text-sm font-semibold text-fg">Toleransi telat (menit)</span>
          <input
            id={`${id}-tol`}
            type="number"
            inputMode="numeric"
            min={0}
            max={180}
            className="input tabular mt-1.5 h-11"
            value={tol}
            placeholder={`kosong = umum (${toleransiUmum})`}
            aria-describedby={`${id}-tol-bantu`}
            onChange={(e) => setTol(e.target.value.replace(/[^\d]/g, ""))}
          />
          <span id={`${id}-tol-bantu`} className="mt-1 block text-xs text-muted">
            Kosongkan = pakai toleransi umum ({toleransiUmum} menit).
          </span>
        </label>
      </div>
      {lengkap && !urut && <p className="mt-2 text-sm text-danger">Jam masuk harus sebelum jam pulang.</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary h-11 text-sm" disabled={sibuk || !bisa || !berubah} onClick={() => kirim(false)}>
          {sibuk ? "Menyimpan…" : "Simpan jam kerja"}
        </button>
        <button type="button" className="btn-ghost h-11 px-3 text-sm" disabled={sibuk || !bisa} onClick={() => kirim(true)}>
          Cek dampak dulu
        </button>
        {jam && (
          <button type="button" className="btn-ghost h-11 px-3 text-sm text-danger" disabled={sibuk} onClick={hapus}>
            Hapus (kembali ke jam toko)
          </button>
        )}
      </div>
    </div>
  );
}
