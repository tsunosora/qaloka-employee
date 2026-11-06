"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconCheck, IconCopy, IconPlus, IconX } from "@/components/ui/icons";
import { longDate } from "@/components/portal/ui";
import { tglPendek } from "./ui";

type Tautan = {
  id: number;
  kode: string;
  label: string;
  berlakuSampai: string;
  mulaiMagang: string | null;
  selesaiMagang: string | null;
  keadaan: "aktif" | "kedaluwarsa" | "dimatikan";
  jumlahPendaftar: number;
};
type Pendaftar = {
  id: number;
  namaLengkap: string;
  panggilan: string | null;
  hp: string | null;
  sekolah: string | null;
  jurusan: string | null;
  mulai: string;
  selesai: string | null;
  status: string;
  alasanTolak: string | null;
  dikirimAt: string;
  tautan: string | null;
};
type Payload = { tautan: Tautan[]; menunggu: Pendaftar[]; diputus: Pendaftar[] };

function tambahHari(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/**
 * Pendaftaran mandiri: tautan pendaftaran (dibagikan pengawas) + pendaftar yang menunggu persetujuan.
 * `onBerubah` dipanggil sesudah ada yang disetujui (daftar peserta di halaman induk perlu dimuat ulang).
 */
export function Pendaftaran({ hariIni, onBerubah, onPesan }: { hariIni: string; onBerubah: () => void; onPesan: (ok: boolean, teks: string) => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [buat, setBuat] = useState<{ label: string; berlakuSampai: string; mulaiMagang: string; selesaiMagang: string } | null>(null);
  const [tolak, setTolak] = useState<{ p: Pendaftar; alasan: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const ambil = useCallback(() => api<Payload>("/api/magang/pendaftaran"), []);
  const muat = () => ambil().then(setData, (e) => onPesan(false, e instanceof Error ? e.message : "Gagal memuat pendaftaran."));
  useEffect(() => {
    let hidup = true;
    ambil().then(
      (d) => hidup && setData(d),
      () => undefined
    );
    return () => {
      hidup = false;
    };
  }, [ambil]);

  async function jalankan(fn: () => Promise<unknown>, pesan: string, ubahPeserta = false) {
    setBusy(true);
    try {
      await fn();
      onPesan(true, pesan);
      await muat();
      if (ubahPeserta) onBerubah();
      return true;
    } catch (e) {
      onPesan(false, e instanceof Error ? e.message : "Gagal menyimpan.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const salin = (kode: string) =>
    navigator.clipboard
      .writeText(`${window.location.origin}/daftar-magang/${kode}`)
      .then(() => onPesan(true, "Tautan pendaftaran disalin. Bagikan ke anak-anak (mis. grup WhatsApp PKL)."), () => undefined);

  if (!data) return null;
  const aktif = data.tautan.filter((t) => t.keadaan === "aktif");
  const lain = data.tautan.filter((t) => t.keadaan !== "aktif").slice(0, 5);

  return (
    <>
      {data.menunggu.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-fg">
            Menunggu persetujuan <span className="text-warning">({data.menunggu.length})</span>
          </h2>
          <ul className="space-y-2">
            {data.menunggu.map((p) => (
              <li key={p.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4" style={{ borderLeft: "3px solid var(--warning)" }}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-fg">
                    {p.namaLengkap} {p.panggilan && <span className="font-normal text-muted">({p.panggilan})</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {[p.sekolah, p.jurusan].filter(Boolean).join(" · ")} · HP {p.hp} · {longDate(p.mulai)} – {p.selesai ? longDate(p.selesai) : "?"}
                  </p>
                  <p className="text-xs text-subtle">
                    Mendaftar {new Date(p.dikirimAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} lewat “{p.tautan}”
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost h-9 text-xs text-danger" disabled={busy} onClick={() => setTolak({ p, alasan: "" })}>
                    <IconX /> Tolak
                  </button>
                  <button
                    className="btn-primary h-9 text-xs"
                    disabled={busy}
                    onClick={() =>
                      jalankan(
                        () => api(`/api/magang/pendaftaran/${p.id}`, { method: "PATCH", body: JSON.stringify({ aksi: "setujui" }) }),
                        `${p.panggilan || p.namaLengkap} disetujui. Tautan & PIN yang dia buat saat mendaftar sudah bisa dipakai. Susun ulang rotasi supaya dia dapat pos.`,
                        true
                      )
                    }
                  >
                    <IconCheck /> Setujui
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-fg">Tautan pendaftaran mandiri</h2>
            <p className="max-w-xl text-sm text-muted">
              Bagikan tautan ke anak-anak; mereka mengisi data & membuat PIN sendiri, lalu menunggu Anda setujui. Tanpa persetujuan, mereka tidak masuk daftar
              karyawan maupun absensi.
            </p>
          </div>
          <button
            className="btn-ghost h-9 text-xs"
            onClick={() => setBuat({ label: "", berlakuSampai: tambahHari(hariIni, 14), mulaiMagang: "", selesaiMagang: "" })}
          >
            <IconPlus /> Buat tautan
          </button>
        </div>
        {aktif.length + lain.length > 0 && (
          <ul className="mt-3 space-y-2">
            {[...aktif, ...lain].map((t) => (
              <li key={t.id} className={`flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm ${t.keadaan === "aktif" ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-fg">{t.label}</p>
                  <p className="text-xs text-muted">
                    {t.keadaan === "aktif" ? `Berlaku s.d. ${tglPendek(t.berlakuSampai)}` : t.keadaan === "kedaluwarsa" ? "Kedaluwarsa" : "Ditutup"} · {t.jumlahPendaftar} pendaftar
                    {t.mulaiMagang && ` · magang ${tglPendek(t.mulaiMagang)}${t.selesaiMagang ? `–${tglPendek(t.selesaiMagang)}` : ""}`}
                  </p>
                </div>
                {t.keadaan === "aktif" && (
                  <>
                    <button className="btn-ghost h-8 px-3 text-xs" onClick={() => salin(t.kode)}>
                      <IconCopy /> Salin tautan
                    </button>
                    <button
                      className="btn-ghost h-8 px-3 text-xs text-danger"
                      disabled={busy}
                      onClick={() =>
                        confirm(`Tutup tautan "${t.label}"? Pendaftar yang sudah masuk tetap ada.`) &&
                        jalankan(() => api(`/api/magang/pendaftaran/tautan/${t.id}`, { method: "DELETE" }), "Tautan ditutup.")
                      }
                    >
                      Tutup
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {data.diputus.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-muted">Riwayat keputusan ({data.diputus.length})</summary>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {data.diputus.map((p) => (
                <li key={p.id}>
                  {p.namaLengkap} — {p.status === "disetujui" ? <span className="text-success">disetujui</span> : <span className="text-danger">ditolak: {p.alasanTolak}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {buat && (
        <Modal title="Buat tautan pendaftaran" onClose={() => setBuat(null)}>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-fg">Nama program</span>
              <input
                className="input mt-1.5"
                value={buat.label}
                maxLength={100}
                placeholder="mis. PKL SMK Januari 2027"
                onChange={(e) => setBuat({ ...buat, label: e.target.value })}
              />
              <span className="mt-1 block text-xs text-muted">Tampil di atas formulir pendaftaran.</span>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-fg">Tautan berlaku sampai</span>
              <input type="date" className="input mt-1.5" value={buat.berlakuSampai} min={hariIni} onChange={(e) => setBuat({ ...buat, berlakuSampai: e.target.value })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-fg">Mulai magang (isian bawaan)</span>
                <input type="date" className="input mt-1.5" value={buat.mulaiMagang} onChange={(e) => setBuat({ ...buat, mulaiMagang: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Selesai magang (isian bawaan)</span>
                <input
                  type="date"
                  className="input mt-1.5"
                  value={buat.selesaiMagang}
                  min={buat.mulaiMagang}
                  onChange={(e) => setBuat({ ...buat, selesaiMagang: e.target.value })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button className="btn-ghost h-10 text-sm" onClick={() => setBuat(null)}>
                Batal
              </button>
              <button
                className="btn-primary h-10 text-sm"
                disabled={busy || buat.label.trim().length < 2 || !buat.berlakuSampai}
                onClick={async () => {
                  const ok = await jalankan(
                    () =>
                      api("/api/magang/pendaftaran", {
                        method: "POST",
                        body: JSON.stringify({ ...buat, mulaiMagang: buat.mulaiMagang || null, selesaiMagang: buat.selesaiMagang || null }),
                      }),
                    "Tautan pendaftaran dibuat. Tekan Salin tautan untuk membagikannya."
                  );
                  if (ok) setBuat(null);
                }}
              >
                Buat tautan
              </button>
            </div>
          </div>
        </Modal>
      )}

      {tolak && (
        <Modal title={`Tolak ${tolak.p.namaLengkap}?`} onClose={() => setTolak(null)}>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-fg">Alasan (tampil ke anak saat membuka tautannya)</span>
              <input className="input mt-1.5" value={tolak.alasan} maxLength={255} onChange={(e) => setTolak({ ...tolak, alasan: e.target.value })} />
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button className="btn-ghost h-10 text-sm" onClick={() => setTolak(null)}>
                Batal
              </button>
              <button
                className="btn-primary h-10 text-sm"
                disabled={busy || !tolak.alasan.trim()}
                onClick={async () => {
                  const ok = await jalankan(
                    () => api(`/api/magang/pendaftaran/${tolak.p.id}`, { method: "PATCH", body: JSON.stringify({ aksi: "tolak", alasan: tolak.alasan }) }),
                    `Pendaftaran ${tolak.p.namaLengkap} ditolak.`
                  );
                  if (ok) setTolak(null);
                }}
              >
                Tolak
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
