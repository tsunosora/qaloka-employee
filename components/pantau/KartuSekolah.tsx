"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/fetcher";
import { IconAlert, IconCheck, IconCopy, IconDownload, IconLink } from "@/components/ui/icons";
import { soft } from "@/components/portal/ui";
import { tglPendek } from "@/components/magang/ui";

export type TautanAdmin = {
  id: number;
  sekolahKunci: string;
  sekolahLabel: string;
  token: string;
  aktif: boolean;
  berlaku: boolean;
  kedaluwarsa: string | null;
  tampilLampiranIzin: boolean;
  terakhirDibukaAt: string | null;
  dibukaKali: number;
  dicabutAt: string | null;
  dibuatAt: string;
};

export type SekolahAdmin = {
  kunci: string;
  label: string;
  jumlah: number;
  jumlahAktif: number;
  mulai: string | null;
  selesai: string | null;
  guru: string[];
  tautan: TautanAdmin | null;
  riwayat: number;
};

const POLA_PIN = /^\d{6,8}$/;

function waktu(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function KolomPin({ id, nilai, onChange, label = "PIN untuk guru" }: { id: string; nilai: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-semibold text-fg">{label}</span>
      <input
        id={id}
        className="input mt-1.5 h-11 tracking-[0.3em]"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={nilai}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        aria-describedby={`${id}-bantu`}
      />
      <span id={`${id}-bantu`} className="mt-1 block text-xs text-muted">
        6–8 angka. Kirim PIN ke guru TERPISAH dari tautannya (mis. lewat telepon).
      </span>
    </label>
  );
}

/** Satu kartu sekolah di Magang → Sekolah: ringkasan anak + panel tautan pantauan guru. */
export function KartuSekolah({ s, onBerubah }: { s: SekolahAdmin; onBerubah: () => void }) {
  const t = s.tautan;
  const [buka, setBuka] = useState<"buat" | "pin" | null>(null);
  const [pin, setPin] = useState("");
  const [kedaluwarsa, setKedaluwarsa] = useState(s.selesai ?? "");
  const [lampiran, setLampiran] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [pinTampil, setPinTampil] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);
  // null = belum disunting → tampilkan nilai tersimpan (ikut berubah sesudah dimuat ulang).
  const [batasEdit, setBatasEdit] = useState<string | null>(null);
  const batasBaru = batasEdit ?? t?.kedaluwarsa ?? "";

  const url = t && typeof window !== "undefined" ? `${window.location.origin}/pantau/${t.token}` : "";

  async function jalankan(kerja: () => Promise<unknown>, pesan: string, pinBaru?: string) {
    setSibuk(true);
    setGalat("");
    setInfo("");
    try {
      await kerja();
      setInfo(pesan);
      if (pinBaru) setPinTampil(pinBaru);
      setBuka(null);
      setPin("");
      setBatasEdit(null);
      onBerubah();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
    }
  }

  const buat = () => {
    if (!POLA_PIN.test(pin)) return setGalat("PIN harus 6–8 angka.");
    jalankan(
      () => api("/api/magang/pantau", { method: "POST", body: JSON.stringify({ sekolahKunci: s.kunci, pin, kedaluwarsa: kedaluwarsa || null, tampilLampiranIzin: lampiran }) }),
      "Tautan dibuat. Salin tautannya lalu kirim ke guru.",
      pin
    );
  };
  const ubah = (data: Record<string, unknown>, pesan: string, pinBaru?: string) =>
    t && jalankan(() => api(`/api/magang/pantau/${t.id}`, { method: "PATCH", body: JSON.stringify(data) }), pesan, pinBaru);

  async function salin() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setGalat("Tidak bisa menyalin otomatis. Pilih teks tautan lalu salin manual.");
    }
  }

  return (
    <section className="glass space-y-4 rounded-2xl p-4 sm:p-5" aria-labelledby={`sekolah-${s.kunci}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`sekolah-${s.kunci}`} className="font-display text-lg font-bold text-fg">
            {s.label}
          </h2>
          <p className="text-sm text-muted">
            {s.jumlah} anak{s.jumlahAktif !== s.jumlah ? ` (${s.jumlahAktif} masih aktif)` : ""}
            {s.mulai && <> · {tglPendek(s.mulai)}{s.selesai ? ` – ${tglPendek(s.selesai)} ${s.selesai.slice(0, 4)}` : ""}</>}
          </p>
          <p className="mt-0.5 text-sm text-muted">Guru pembimbing: {s.guru.length ? s.guru.join(", ") : <span className="text-subtle">belum diisi</span>}</p>
        </div>
        <Link href={`/magang/rapor/sekolah?sekolah=${encodeURIComponent(s.kunci)}`} className="btn-ghost h-11 px-3 text-sm">
          <IconDownload /> Cetak rapor sekolah
        </Link>
      </div>

      <div className="rounded-2xl border border-border p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
          <IconLink className="text-[16px]" aria-hidden="true" /> Tautan pantauan guru
        </h3>

        {galat && (
          <p role="alert" className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
            <IconAlert className="shrink-0" aria-hidden="true" /> {galat}
          </p>
        )}
        {info && (
          <p role="status" className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-success" style={soft("var(--success)")}>
            <IconCheck className="shrink-0" aria-hidden="true" /> {info}
          </p>
        )}
        {pinTampil && (
          <div className="mt-2 rounded-xl border border-border bg-surface-2 p-3 text-sm text-fg">
            PIN guru: <b className="tabular font-display text-lg tracking-[0.2em]">{pinTampil}</b>
            <span className="block text-xs text-muted">Catat sekarang — PIN tidak bisa dilihat lagi sesudah halaman ini ditutup.</span>
            <button type="button" className="btn-ghost mt-2 h-11 px-3 text-sm" onClick={() => setPinTampil(null)}>
              Sudah dicatat, sembunyikan
            </button>
          </div>
        )}

        {!t ? (
          buka === "buat" ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <KolomPin id={`pin-${s.kunci}`} nilai={pin} onChange={setPin} />
              <label htmlFor={`exp-${s.kunci}`} className="block">
                <span className="text-sm font-semibold text-fg">Berlaku sampai (boleh kosong)</span>
                <input id={`exp-${s.kunci}`} type="date" className="input mt-1.5 h-11" value={kedaluwarsa} onChange={(e) => setKedaluwarsa(e.target.value)} />
                <span className="mt-1 block text-xs text-muted">Terisi otomatis = tanggal selesai magang paling akhir di sekolah ini.</span>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm text-fg sm:col-span-2">
                <input type="checkbox" className="h-5 w-5" checked={lampiran} onChange={(e) => setLampiran(e.target.checked)} />
                Guru boleh melihat lampiran surat izin/sakit
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="button" className="btn-primary h-11 text-sm" disabled={sibuk} onClick={buat}>
                  {sibuk ? "Menyimpan…" : "Buat tautan"}
                </button>
                <button type="button" className="btn-ghost h-11 px-3 text-sm" onClick={() => setBuka(null)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Belum ada tautan. Guru bisa memantau absensi, jurnal, izin, jadwal pos & nilai anak sekolah ini — hanya melihat, tidak bisa mengubah.
                {s.riwayat > 0 && ` (${s.riwayat} tautan lama sudah dicabut.)`}
              </p>
              <button type="button" className="btn-primary h-11 text-sm" onClick={() => setBuka("buat")}>
                Buat tautan untuk guru
              </button>
            </div>
          )
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="badge"
                style={{ ...soft(t.berlaku ? "var(--success)" : "var(--warning)", 18), color: t.berlaku ? "var(--success)" : "var(--warning)" }}
              >
                {t.berlaku ? "Berlaku" : "Kedaluwarsa — perpanjang tanggalnya"}
              </span>
              <span className="text-xs text-muted">
                {t.dibukaKali ? `Dibuka ${t.dibukaKali}× · terakhir ${waktu(t.terakhirDibukaAt!)}` : "Belum pernah dibuka guru"}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor={`url-${t.id}`} className="sr-only">
                Tautan untuk guru
              </label>
              <input id={`url-${t.id}`} readOnly className="input h-11 min-w-0 flex-1 text-xs" value={url} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn-primary h-11 text-sm" onClick={salin}>
                {tersalin ? <IconCheck aria-hidden="true" /> : <IconCopy aria-hidden="true" />} {tersalin ? "Tersalin" : "Salin tautan"}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`batas-${t.id}`} className="text-sm font-semibold text-fg">
                  Berlaku sampai
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input id={`batas-${t.id}`} type="date" className="input h-11 flex-1" value={batasBaru} onChange={(e) => setBatasEdit(e.target.value)} />
                  <button
                    type="button"
                    className="btn-ghost h-11 px-3 text-sm"
                    disabled={sibuk || batasBaru === (t.kedaluwarsa ?? "")}
                    onClick={() => ubah({ kedaluwarsa: batasBaru || null }, batasBaru ? "Tanggal berlaku disimpan." : "Tautan berlaku tanpa batas tanggal.")}
                  >
                    Simpan
                  </button>
                </div>
                <span className="mt-1 block text-xs text-muted">{t.kedaluwarsa ? `Sekarang: ${tglPendek(t.kedaluwarsa)} ${t.kedaluwarsa.slice(0, 4)}` : "Sekarang: tanpa batas"}</span>
              </div>
              <label className="flex min-h-11 items-center gap-2 self-center text-sm text-fg">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={t.tampilLampiranIzin}
                  disabled={sibuk}
                  onChange={(e) => ubah({ tampilLampiranIzin: e.target.checked }, e.target.checked ? "Guru kini bisa melihat lampiran izin." : "Lampiran izin disembunyikan dari guru.")}
                />
                Guru boleh melihat lampiran surat izin/sakit
              </label>
            </div>

            {buka === "pin" ? (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <KolomPin id={`pinbaru-${t.id}`} nilai={pin} onChange={setPin} label="PIN baru" />
                <p className="text-xs text-muted">Guru yang sedang membuka halaman akan diminta PIN baru.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary h-11 text-sm"
                    disabled={sibuk}
                    onClick={() => (POLA_PIN.test(pin) ? ubah({ pin }, "PIN diganti.", pin) : setGalat("PIN harus 6–8 angka."))}
                  >
                    Simpan PIN baru
                  </button>
                  <button type="button" className="btn-ghost h-11 px-3 text-sm" onClick={() => setBuka(null)}>
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost h-11 px-3 text-sm" onClick={() => setBuka("pin")}>
                  Ganti PIN
                </button>
                <button
                  type="button"
                  className="btn-ghost h-11 px-3 text-sm"
                  disabled={sibuk}
                  onClick={() =>
                    window.confirm("Buat tautan baru? Tautan lama langsung tidak bisa dipakai. PIN tetap sama.") &&
                    jalankan(() => api(`/api/magang/pantau/${t.id}/ganti`, { method: "POST", body: "{}" }), "Tautan baru dibuat. Kirim tautan baru ke guru.")
                  }
                >
                  Ganti tautan
                </button>
                <button
                  type="button"
                  className="btn-ghost h-11 px-3 text-sm text-danger"
                  disabled={sibuk}
                  onClick={() =>
                    window.confirm(`Cabut tautan guru ${s.label}? Guru tidak bisa membuka halaman pantauan lagi.`) &&
                    jalankan(() => api(`/api/magang/pantau/${t.id}/cabut`, { method: "POST", body: "{}" }), "Tautan dicabut.")
                  }
                >
                  Cabut tautan
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
