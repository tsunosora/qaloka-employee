"use client";

/**
 * Pengaturan → Langganan: keadaan kunci lisensi Qaloka instalasi ini. Hanya-baca, kecuali satu
 * tombol "Segarkan" — dipakai sesudah membayar atau ganti paket di qaloka.com, supaya tidak
 * perlu menunggu penyegaran berkala. Halaman ini SENGAJA tidak pernah diblokir lisensi: ia jalan
 * keluarnya.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import kontrak from "@/kontrak/lisensi.json";

type Ringkasan = {
  ditegakkan: boolean;
  status: string;
  hanyaBaca: boolean;
  alasan: string | null;
  paket: string | null;
  namaKlien: string | null;
  fitur: string[];
  batas: Record<string, number | null>;
  berlakuSampai: string | null;
  tenggangSampai: string | null;
  sisaHari: number | null;
  terakhirDicoba: string | null;
  catatanPenyegaran: string | null;
  tokenTerpasang: boolean;
  pemakaian: Record<string, number>;
};

const PRODUK = "qendali_employee";
const namaFitur = new Map(kontrak.fitur.map((f) => [f.kode, f.nama]));
const namaBatas = new Map(kontrak.batas.map((b) => [b.kode, b.nama]));
const fiturProduk: string[] = (kontrak.fiturDijual as Record<string, string[]>)[PRODUK] ?? [];

const STATUS: Record<string, { teks: string; warna: string }> = {
  tanpa_lisensi: { teks: "Belum tersambung", warna: "var(--fg-subtle)" },
  aktif: { teks: "Aktif", warna: "var(--success)" },
  tenggang: { teks: "Masa tenggang", warna: "var(--warning)" },
  hanya_baca: { teks: "Hanya-baca", warna: "var(--danger)" },
};

const tanggal = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";
const namaPaket = (kode: string | null) =>
  kode ? kode.split(/[_-]+/).filter(Boolean).map((k) => k[0].toUpperCase() + k.slice(1)).join(" ") : "—";

function chip(color: string): React.CSSProperties {
  return { background: `color-mix(in oklab, ${color} 16%, transparent)`, color };
}

export default function LanggananPage() {
  const [r, setR] = useState<Ringkasan | null>(null);
  const [galat, setGalat] = useState("");
  const [sedang, setSedang] = useState(false);

  const muat = useCallback(async () => {
    try {
      setR(await api<Ringkasan>("/api/lisensi"));
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, []);
  useEffect(() => {
    muat();
  }, [muat]);

  async function segarkan() {
    setSedang(true);
    setGalat("");
    try {
      setR(await api<Ringkasan>("/api/lisensi/segarkan", { method: "POST" }));
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSedang(false);
    }
  }

  const s = STATUS[r?.status ?? "tanpa_lisensi"] ?? STATUS.tanpa_lisensi;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Langganan</h1>
          <p className="mt-0.5 text-sm text-muted">Paket Qaloka Employee yang terpasang di aplikasi ini.</p>
        </div>
        {r?.tokenTerpasang && (
          <button onClick={segarkan} disabled={sedang} className="btn-primary h-10">
            {sedang ? "Menyegarkan…" : "Segarkan lisensi"}
          </button>
        )}
      </div>

      {galat && (
        <div className="rounded-xl px-3 py-2.5 text-sm text-danger" style={chip("var(--danger)")}>
          {galat}
        </div>
      )}

      {!r ? (
        <div className="glass rounded-2xl p-6 text-sm text-subtle">Memuat…</div>
      ) : (
        <>
          <div className="glass grid gap-4 rounded-2xl p-5 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-subtle">Status</div>
              <span className="badge mt-1" style={chip(s.warna)}>{s.teks}</span>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-subtle">Paket</div>
              <div className="mt-1 font-semibold text-fg">{r.ditegakkan ? namaPaket(r.paket) : "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-subtle">Berlaku sampai</div>
              <div className="mt-1 font-semibold text-fg">{tanggal(r.berlakuSampai)}</div>
              <div className="text-xs text-subtle">Diperbarui otomatis tiap hari selama langganan berjalan.</div>
            </div>
          </div>

          {!r.ditegakkan && (
            <div className="glass rounded-2xl p-5 text-sm leading-relaxed text-muted">
              {r.tokenTerpasang
                ? "Token instalasi sudah terpasang, tapi kunci lisensi belum pernah berhasil diambil dari qaloka.com. Sampai kuncinya ada, semua fitur tetap terbuka."
                : "Aplikasi ini belum tersambung ke langganan Qaloka, jadi semua fitur terbuka. Penyambungan dilakukan oleh tim Qaloka saat pemasangan."}
              {r.catatanPenyegaran && (
                <div className="mt-2 font-mono text-xs text-subtle">Catatan terakhir: {r.catatanPenyegaran}</div>
              )}
            </div>
          )}

          {r.ditegakkan && Object.keys(r.batas).length > 0 && (
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-subtle">
                    <th className="px-4 py-3 font-medium">Batas</th>
                    <th className="px-4 py-3 font-medium">Terpakai</th>
                    <th className="px-4 py-3 font-medium">Paket</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(r.batas).map(([kode, nilai]) => (
                    <tr key={kode} className="border-t border-border">
                      <td className="px-4 py-3 text-fg">{namaBatas.get(kode) ?? kode}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {kode in r.pemakaian ? r.pemakaian[kode] : <span className="text-xs text-subtle">dihitung di qaloka.com</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{nilai === null ? "tanpa batas" : nilai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="glass rounded-2xl p-5">
            <h2 className="font-display text-base font-bold text-fg">Fitur</h2>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {fiturProduk.map((kode) => {
                const ada = !r.ditegakkan || r.fitur.includes(kode);
                return (
                  <li key={kode} className={ada ? "text-fg" : "text-subtle"}>
                    <span aria-hidden="true">{ada ? "✓" : "—"}</span>{" "}
                    {namaFitur.get(kode) ?? kode}
                    {!ada && <span className="sr-only"> (tidak termasuk paket)</span>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-subtle">
              Ganti paket lewat portal qaloka.com, lalu tekan “Segarkan lisensi” di atas.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
