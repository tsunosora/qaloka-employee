"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconAlert, IconCheck, IconChevronLeft, IconChevronRight, IconUsers } from "@/components/ui/icons";
import { idPerangkat, kecilkan, pesanDari, type Minta } from "./peramban";
import { KelolaTim } from "./KelolaTim";

/**
 * Layar "Absen tim" untuk PIC lapangan (bagian halaman /absen/[token]) — REKAP HARIAN, bentuknya
 * meniru link PIC di Qaloka Event: satu kartu per anggota tim, Hadir / ½ Hari / Absen, jam lembur,
 * kota, divisi, proyek, foto opsional, lalu satu tombol Simpan untuk semuanya. Semua yang disimpan
 * MENUNGGU persetujuan owner/HR (Absensi → Rekap tim); hanya yang disetujui dihitung upah.
 * Menggantikan alur lama "buka sesi + absen masuk/pulang satu per satu".
 */

type Status = "hadir" | "setengah" | "absen";
type Isi = { status: Status | null; lemburJam: number; kota: string | null; divisi: string | null; proyekId: number | null };
type Anggota = {
  id: number;
  nama: string;
  panggilan: string | null;
  jabatan: string | null;
  kepala: boolean;
  freelance: boolean;
  freelanceBaru: boolean;
  isi: Isi;
  tersimpan: {
    persetujuan: "menunggu" | "disetujui" | "ditolak";
    alasanTolak: string | null;
    dibayar: boolean;
    adaFoto: boolean;
    dicatatOleh: string | null;
    dicatatOrangLain: boolean;
  } | null;
};
type Proyek = { id: number; kode: string | null; nama: string; lokasi: string | null; nonaktif?: boolean };
type Konteks = {
  pic: { id: number; nama: string };
  tim: { id: number; nama: string; kepala: string | null; saya: boolean };
  tanggal: string;
  rentang: { min: string; max: string };
  pilihan: { kota: string[]; divisi: string[]; proyek: Proyek[] };
  anggota: Anggota[];
};
type Hasil = { baru: number; diubah: number; tetap: number; terkunci: string[] };
type Pesan = { ok: boolean; teks: string } | null;

const STATUS: { kode: Status; label: string; warna: string }[] = [
  { kode: "hadir", label: "Hadir", warna: "var(--success)" },
  { kode: "setengah", label: "½ Hari", warna: "var(--warning)" },
  { kode: "absen", label: "Absen", warna: "var(--danger)" },
];
const PERSETUJUAN = {
  menunggu: { label: "Menunggu", warna: "var(--warning)" },
  disetujui: { label: "Disetujui", warna: "var(--success)" },
  ditolak: { label: "Ditolak", warna: "var(--danger)" },
} as const;
const LEMBUR = Array.from({ length: 31 }, (_, i) => i / 2); // 0 … 15 per 0,5
const LEMBUR_CEPAT = [1, 2, 3, 4];

function soft(c: string, pct = 14): React.CSSProperties {
  return { background: `color-mix(in oklab, ${c} ${pct}%, transparent)`, color: c };
}

const jam = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
const inisial = (nama: string) => nama.split(/\s+/).filter(Boolean).slice(0, 2).map((k) => k[0]!.toUpperCase()).join("");
const kunci = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const samaIsi = (a: Isi, b: Isi) =>
  a.status === b.status && a.lemburJam === b.lemburJam && kunci(a.kota) === kunci(b.kota) && kunci(a.divisi) === kunci(b.divisi) && a.proyekId === b.proyekId;

function geserHari(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(y!, m! - 1, d! + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
function teksTanggal(ymd: string, hariIni: string): string {
  if (ymd === hariIni) return "Hari ini";
  if (ymd === geserHari(hariIni, -1)) return "Kemarin";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
}

/** GPS sekali saat simpan, OPSIONAL: tidak ada / ditolak / lambat → simpan tetap jalan. */
function lokasiOpsional(): Promise<{ lat: number; lng: number; akurasi: number } | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((ok) => {
    const jeda = setTimeout(() => ok(null), 9000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(jeda);
        ok({ lat: p.coords.latitude, lng: p.coords.longitude, akurasi: p.coords.accuracy });
      },
      () => {
        clearTimeout(jeda);
        ok(null);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

export function RekapTim({ token, onTutup }: { token: string; onTutup: () => void }) {
  const [tanggal, setTanggal] = useState<string | null>(null); // null = hari ini (server yang menentukan)
  const [konteks, setKonteks] = useState<Konteks | null>(null);
  const [isi, setIsi] = useState<Record<number, Isi>>({});
  const [foto, setFoto] = useState<Record<number, { blob: Blob; url: string }>>({});
  const [layar, setLayar] = useState<"rekap" | "kelola">("rekap");
  const [pesan, setPesan] = useState<Pesan>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState<"" | "lokasi" | "kirim">("");
  const [semua, setSemua] = useState({ kota: "", divisi: "", proyek: "" });
  const fotoInput = useRef<HTMLInputElement>(null);
  const targetFoto = useRef<number | null>(null);
  const fotoRef = useRef(foto);
  useEffect(() => {
    fotoRef.current = foto;
  }, [foto]);

  const minta: Minta = useCallback(
    async (jalur, init = {}) => {
      const r = await fetch(`/api/public/absen/${token}/tim${jalur}`, {
        ...init,
        headers: { ...(init.headers ?? {}), "x-perangkat": idPerangkat() },
      });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, d };
    },
    [token],
  );

  const terima = useCallback((r: { ok: boolean; d: unknown }) => {
    setMemuat(false);
    if (!r.ok) return setGalatMuat(pesanDari(r.d, "Rekap tim tidak bisa dibuka."));
    const k = r.d as Konteks;
    setGalatMuat("");
    setKonteks(k);
    setTanggal(k.tanggal);
    setIsi(Object.fromEntries(k.anggota.map((a) => [a.id, a.isi])));
    for (const f of Object.values(fotoRef.current)) URL.revokeObjectURL(f.url);
    setFoto({});
  }, []);
  const gagal = useCallback(() => {
    setMemuat(false);
    setGalatMuat("Tidak tersambung ke server. Periksa internet lalu coba lagi.");
  }, []);

  const muat = useCallback(
    (tgl: string | null) => {
      setMemuat(true);
      return minta(`/rekap${tgl ? `?tanggal=${tgl}` : ""}`).then(terima, gagal);
    },
    [minta, terima, gagal],
  );

  useEffect(() => {
    let hidup = true;
    minta("/rekap").then((r) => hidup && terima(r), () => hidup && gagal());
    return () => {
      hidup = false;
      for (const f of Object.values(fotoRef.current)) URL.revokeObjectURL(f.url);
    };
  }, [minta, terima, gagal]);

  const anggota = useMemo(() => konteks?.anggota ?? [], [konteks]);
  const bisaDiisi = anggota.filter((a) => !a.tersimpan?.dibayar);
  const terisi = bisaDiisi.filter((a) => isi[a.id]?.status).length;
  const adaPerubahan =
    Object.keys(foto).length > 0 || anggota.some((a) => isi[a.id] && !samaIsi(isi[a.id]!, a.isi));

  function ubah(id: number, sebagian: Partial<Isi>) {
    setIsi((s) => ({ ...s, [id]: { ...s[id]!, ...sebagian } }));
  }

  function gantiTanggal(baru: string) {
    if (!konteks || !baru || baru === tanggal) return;
    if (baru < konteks.rentang.min || baru > konteks.rentang.max) return;
    if (adaPerubahan && !window.confirm("Perubahan belum disimpan. Tetap pindah tanggal?")) return;
    setPesan(null);
    setTanggal(baru);
    void muat(baru);
  }

  function terapkanSemua() {
    const ubahan: Partial<Isi> = {};
    if (semua.kota) ubahan.kota = semua.kota;
    if (semua.divisi) ubahan.divisi = semua.divisi;
    if (semua.proyek) ubahan.proyekId = semua.proyek === "-" ? null : Number(semua.proyek);
    if (Object.keys(ubahan).length === 0) return setPesan({ ok: false, teks: "Pilih kota, divisi, atau proyek dulu." });
    setIsi((s) => {
      const baru = { ...s };
      for (const a of bisaDiisi) baru[a.id] = { ...baru[a.id]!, ...ubahan };
      return baru;
    });
    const dilewati = anggota.length - bisaDiisi.length;
    setPesan({ ok: true, teks: `Diterapkan ke ${bisaDiisi.length} orang${dilewati ? ` (${dilewati} sudah dibayar, dilewati)` : ""}. Jangan lupa Simpan.` });
  }

  // Kamera dibuka LANGSUNG di dalam ketukan — peramban hanya mengizinkannya sesaat sesudah ketukan.
  function ambilFoto(id: number) {
    targetFoto.current = id;
    fotoInput.current?.click();
  }
  async function fotoDipilih(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    const id = targetFoto.current;
    targetFoto.current = null;
    if (!f || id === null) return;
    try {
      const blob = await kecilkan(f);
      setFoto((s) => {
        if (s[id]) URL.revokeObjectURL(s[id].url);
        return { ...s, [id]: { blob, url: URL.createObjectURL(blob) } };
      });
    } catch {
      setPesan({ ok: false, teks: "Foto tidak terbaca. Coba ambil ulang." });
    }
  }
  function buangFoto(id: number) {
    setFoto((s) => {
      if (s[id]) URL.revokeObjectURL(s[id].url);
      const baru = { ...s };
      delete baru[id];
      return baru;
    });
  }

  async function simpan() {
    if (!konteks || !tanggal) return;
    setPesan(null);
    const baris = bisaDiisi
      .filter((a) => isi[a.id]?.status)
      .map((a) => ({ employeeId: a.id, ...isi[a.id]! }));
    if (baris.length === 0) return setPesan({ ok: false, teks: "Belum ada yang diisi. Pilih Hadir, ½ Hari, atau Absen untuk tiap orang." });
    const tanpaStatus = Object.keys(foto).map(Number).filter((id) => !isi[id]?.status);
    if (tanpaStatus.length) return setPesan({ ok: false, teks: "Ada foto untuk orang yang belum dipilih Hadir / ½ Hari / Absen." });
    try {
      setMenyimpan("lokasi");
      const lokasi = await lokasiOpsional();
      setMenyimpan("kirim");
      const fd = new FormData();
      fd.set("data", JSON.stringify({ tanggal, baris, lokasi }));
      for (const [id, f] of Object.entries(foto)) fd.set(`foto-${id}`, f.blob, "foto.jpg");
      const { ok, d } = await minta("/rekap", { method: "POST", body: fd });
      if (!ok) return setPesan({ ok: false, teks: pesanDari(d, "Rekap gagal disimpan. Coba lagi.") });
      const h = d as Hasil;
      const ditulis = h.baru + h.diubah;
      const bagian = [
        ditulis ? `Tersimpan untuk ${ditulis} orang — menunggu persetujuan.` : "Tidak ada yang berubah.",
        h.tetap && ditulis ? `${h.tetap} orang tidak berubah.` : "",
        h.terkunci.length ? `Sudah dibayar, tidak diubah: ${h.terkunci.join(", ")}.` : "",
        lokasi ? "" : "Lokasi HP tidak terbaca — rekap tetap tersimpan.",
      ].filter(Boolean);
      await muat(tanggal);
      setPesan({ ok: true, teks: bagian.join(" ") });
    } catch {
      setPesan({ ok: false, teks: "Tidak tersambung ke server. Periksa internet lalu coba lagi." });
    } finally {
      setMenyimpan("");
    }
  }

  if (layar === "kelola" && konteks) {
    return (
      <KelolaTim
        minta={minta}
        tim={konteks.tim}
        onKembali={() => {
          setLayar("rekap");
          setPesan(null);
          void muat(tanggal);
        }}
      />
    );
  }

  const hariIni = konteks?.rentang.max ?? "";
  return (
    <section className="glass-2 space-y-4 rounded-3xl p-4 pb-0 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <button className="btn-ghost h-10 px-3 text-sm" onClick={onTutup}>
          <IconChevronLeft className="text-[16px]" /> Kembali
        </button>
        <h2 className="text-sm font-semibold text-fg">Rekap tim</h2>
      </div>

      {galatMuat && (
        <p className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm" style={soft("var(--danger)")}>
          <IconAlert className="mt-0.5 shrink-0" /> <span>{galatMuat}</span>
        </p>
      )}

      {!konteks ? (
        !galatMuat && <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-primary" />
      ) : (
        <>
          {/* Kepala: siapa, tim mana, tanggal berapa */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-lg font-bold text-fg">{konteks.tim.nama}</div>
                <div className="text-xs text-subtle">
                  {anggota.length} anggota · PIC {konteks.pic.nama}
                  {!konteks.tim.saya && konteks.tim.kepala ? ` · kepala tim ${konteks.tim.kepala}` : ""}
                </div>
              </div>
              <button className="btn-ghost h-10 shrink-0 px-3 text-sm" onClick={() => setLayar("kelola")}>
                <IconUsers className="text-[16px]" /> Kelola tim
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="btn-ghost h-11 w-11 shrink-0 p-0 disabled:opacity-40"
                aria-label="Hari sebelumnya"
                disabled={memuat || !tanggal || tanggal <= konteks.rentang.min}
                onClick={() => tanggal && gantiTanggal(geserHari(tanggal, -1))}
              >
                <IconChevronLeft />
              </button>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Tanggal rekap</span>
                <input
                  type="date"
                  className="input h-11 px-1 text-center text-sm"
                  min={konteks.rentang.min}
                  max={konteks.rentang.max}
                  value={tanggal ?? ""}
                  onChange={(e) => gantiTanggal(e.target.value)}
                />
              </label>
              <button
                className="btn-ghost h-11 w-11 shrink-0 p-0 disabled:opacity-40"
                aria-label="Hari berikutnya"
                disabled={memuat || !tanggal || tanggal >= konteks.rentang.max}
                onClick={() => tanggal && gantiTanggal(geserHari(tanggal, 1))}
              >
                <IconChevronRight />
              </button>
              <button className="btn-ghost h-11 shrink-0 px-2 text-sm disabled:opacity-40" disabled={memuat} onClick={() => {
                if (adaPerubahan && !window.confirm("Perubahan belum disimpan. Tetap muat ulang?")) return;
                setPesan(null);
                void muat(tanggal);
              }}>
                Muat ulang
              </button>
            </div>
            <div className="text-center text-xs text-muted">
              {tanggal ? teksTanggal(tanggal, hariIni) : ""} · bisa mundur sampai 7 hari
            </div>
          </div>

          {pesan && (
            <p className="flex items-start gap-2 rounded-xl px-3 py-2 text-left text-sm" style={soft(pesan.ok ? "var(--success)" : "var(--danger)")}>
              {pesan.ok ? <IconCheck className="mt-0.5 shrink-0" /> : <IconAlert className="mt-0.5 shrink-0" />}
              <span>{pesan.teks}</span>
            </p>
          )}

          {anggota.length === 0 ? (
            <p className="pb-4 text-center text-sm text-subtle">Tim ini belum punya anggota. Tekan Kelola tim untuk menambahkan.</p>
          ) : (
            <div className={memuat ? "pointer-events-none space-y-4 opacity-60" : "space-y-4"}>
              {/* Isi untuk semua */}
              <div className="space-y-2 rounded-2xl border border-border p-3">
                <div className="text-sm font-medium text-fg">Isi untuk semua</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <PilihTeks label="Kota" kosong="— Kota —" nilai={semua.kota} pilihan={konteks.pilihan.kota} onUbah={(v) => setSemua((s) => ({ ...s, kota: v }))} />
                  <PilihTeks label="Divisi" kosong="— Divisi —" nilai={semua.divisi} pilihan={konteks.pilihan.divisi} onUbah={(v) => setSemua((s) => ({ ...s, divisi: v }))} />
                  <label className="block">
                    <span className="sr-only">Proyek untuk semua</span>
                    <select className="input h-11" value={semua.proyek} onChange={(e) => setSemua((s) => ({ ...s, proyek: e.target.value }))}>
                      <option value="">— Proyek —</option>
                      <option value="-">Tanpa proyek</option>
                      {konteks.pilihan.proyek.filter((p) => !p.nonaktif).map((p) => (
                        <option key={p.id} value={p.id}>{namaProyek(p)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className="btn-ghost h-11 w-full text-sm" onClick={terapkanSemua}>Terapkan ke semua</button>
              </div>

              <input ref={fotoInput} type="file" accept="image/*" capture="user" className="hidden" onChange={fotoDipilih} />

              <ul className="space-y-3">
                {anggota.map((a) => (
                  <KartuAnggota
                    key={a.id}
                    a={a}
                    isi={isi[a.id] ?? a.isi}
                    foto={foto[a.id]?.url ?? null}
                    pilihan={konteks.pilihan}
                    onUbah={(s) => ubah(a.id, s)}
                    onFoto={() => ambilFoto(a.id)}
                    onBuangFoto={() => buangFoto(a.id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Tombol tetap di bawah */}
          <div className="sticky bottom-0 -mx-4 border-t border-border px-4 py-3 backdrop-blur" style={{ background: "color-mix(in oklab, var(--bg) 88%, transparent)" }}>
            <button
              className="btn-primary h-14 w-full text-base disabled:opacity-60"
              disabled={Boolean(menyimpan) || memuat || terisi === 0}
              onClick={simpan}
            >
              {menyimpan === "lokasi" ? "Membaca lokasi…" : menyimpan === "kirim" ? "Menyimpan…" : `Simpan (${terisi} terisi / ${bisaDiisi.length})`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const namaProyek = (p: Proyek) => `${p.kode ? `${p.kode} · ` : ""}${p.nama}${p.lokasi ? ` (${p.lokasi})` : ""}${p.nonaktif ? " — nonaktif" : ""}`;

function PilihTeks({ label, kosong, nilai, pilihan, onUbah }: { label: string; kosong: string; nilai: string; pilihan: string[]; onUbah: (v: string) => void }) {
  // Nilai tersimpan yang tidak ada di daftar pilihan tetap ditampilkan, supaya tidak terlihat hilang.
  const daftar = nilai && !pilihan.some((p) => kunci(p) === kunci(nilai)) ? [nilai, ...pilihan] : pilihan;
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select className="input h-11" value={daftar.find((p) => kunci(p) === kunci(nilai)) ?? ""} onChange={(e) => onUbah(e.target.value)}>
        <option value="">{kosong}</option>
        {daftar.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </label>
  );
}

function KartuAnggota({
  a, isi, foto, pilihan, onUbah, onFoto, onBuangFoto,
}: {
  a: Anggota;
  isi: Isi;
  foto: string | null;
  pilihan: Konteks["pilihan"];
  onUbah: (s: Partial<Isi>) => void;
  onFoto: () => void;
  onBuangFoto: () => void;
}) {
  const t = a.tersimpan;
  const terkunci = Boolean(t?.dibayar);
  const berubah = Boolean(t) && !samaIsi(isi, a.isi);
  const pilihanProyek = pilihan.proyek.filter((p) => !p.nonaktif || p.id === isi.proyekId);

  return (
    <li className="glass space-y-3 rounded-2xl p-3">
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full" style={soft("var(--primary)", 16)}>
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal (blob:), bukan aset situs
            <img src={foto} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold">{inisial(a.nama)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-snug text-fg">{a.nama}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {a.kepala && <span className="badge" style={soft("var(--primary)", 16)}>Kepala tim</span>}
            {a.freelance && <span className="badge" style={soft("var(--warning)", 18)}>{a.freelanceBaru ? "Freelance baru" : "Freelance"}</span>}
            {t && !terkunci && (
              <span className="badge" style={soft(PERSETUJUAN[t.persetujuan]?.warna ?? "var(--fg-subtle)", 18)}>
                {PERSETUJUAN[t.persetujuan]?.label ?? t.persetujuan}
              </span>
            )}
            {terkunci && <span className="badge" style={soft("var(--fg-subtle)", 18)}>Sudah dibayar</span>}
          </div>
        </div>
      </div>

      {t?.dicatatOrangLain && t.dicatatOleh && (
        <p className="text-xs text-muted">Terakhir dicatat oleh {t.dicatatOleh}. Kalau Anda simpan, catatan Anda yang dipakai.</p>
      )}
      {t?.persetujuan === "ditolak" && t.alasanTolak && !terkunci && (
        <p className="rounded-xl px-3 py-2 text-xs" style={soft("var(--danger)")}>
          <b>Ditolak:</b> {t.alasanTolak}
        </p>
      )}

      {terkunci ? (
        <p className="text-sm text-muted">
          {STATUS.find((s) => s.kode === isi.status)?.label ?? "—"}
          {isi.lemburJam ? ` · lembur ${jam(isi.lemburJam)} jam` : ""} · sudah dibayar, tidak bisa diubah.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Kehadiran ${a.nama}`}>
            {STATUS.map((s) => {
              const pilih = isi.status === s.kode;
              return (
                <button
                  key={s.kode}
                  role="radio"
                  aria-checked={pilih}
                  onClick={() => onUbah({ status: s.kode })}
                  className="h-12 rounded-xl border text-sm font-semibold transition"
                  style={pilih ? { ...soft(s.warna, 22), borderColor: s.warna } : { borderColor: "var(--border)", color: "var(--fg-muted)" }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Lembur</span>
            <select
              className="input h-11 w-24"
              aria-label={`Jam lembur ${a.nama}`}
              value={String(isi.lemburJam)}
              onChange={(e) => onUbah({ lemburJam: Number(e.target.value) })}
            >
              {LEMBUR.map((j) => (
                <option key={j} value={String(j)}>{j === 0 ? "0" : `${jam(j)} jam`}</option>
              ))}
            </select>
            {LEMBUR_CEPAT.map((j) => (
              <button
                key={j}
                className="h-11 min-w-11 rounded-xl border px-2 text-sm"
                style={isi.lemburJam === j ? { ...soft("var(--primary)", 18), borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}
                onClick={() => onUbah({ lemburJam: j })}
              >
                {j}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PilihTeks label={`Kota ${a.nama}`} kosong="— Kota —" nilai={isi.kota ?? ""} pilihan={pilihan.kota} onUbah={(v) => onUbah({ kota: v || null })} />
            <PilihTeks label={`Divisi ${a.nama}`} kosong="— Divisi —" nilai={isi.divisi ?? ""} pilihan={pilihan.divisi} onUbah={(v) => onUbah({ divisi: v || null })} />
            <label className="col-span-2 block">
              <span className="sr-only">Proyek {a.nama}</span>
              <select className="input h-11" value={isi.proyekId ?? ""} onChange={(e) => onUbah({ proyekId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Tanpa proyek</option>
                {pilihanProyek.map((p) => (
                  <option key={p.id} value={p.id}>{namaProyek(p)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn-ghost h-11 flex-1 text-sm" onClick={onFoto}>
              {foto ? "Ganti foto" : t?.adaFoto ? "Foto baru (opsional)" : "Foto (opsional)"}
            </button>
            {foto && (
              <button className="btn-ghost h-11 px-3 text-sm" onClick={onBuangFoto}>Batal foto</button>
            )}
          </div>
          {!foto && t?.adaFoto && <p className="text-xs text-subtle">Sudah ada foto tersimpan.</p>}

          {berubah && t?.persetujuan === "disetujui" && (
            <p className="text-xs" style={{ color: "var(--warning)" }}>Diubah — sesudah disimpan, menunggu persetujuan lagi.</p>
          )}
        </>
      )}
    </li>
  );
}
