"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { api } from "@/lib/fetcher";
import { PinGate } from "@/components/portal/PinGate";
import { NamaMerek, UbinLogo } from "@/components/QendaliMark";
import { IconAlert, IconCheck, IconClock } from "@/components/ui/icons";
import type { PortalState } from "@/components/portal/types";
import { bacaLokasi, idPerangkat, jamDari, kecilkan, pesanDari, pesanFotoGagal, teksJarak } from "@/components/absen/peramban";
import { RekapTim } from "@/components/absen/RekapTim";

type Absen = {
  aktif: boolean;
  hpTerkunci: boolean;
  tim: boolean;
  bolehLuar: boolean;
  pengajuan: Pengajuan[];
  lokasi: { id: number; nama: string; radiusM: number; wajibQr: boolean }[];
  hariIni: { id: number; jam: string; jenis: string | null; lewat: "hp" | "tim" | "mesin" }[];
};
type Pengajuan = { id: number; jam: string; status: "menunggu" | "diterima" | "ditolak"; alasan: string | null; catatan: string | null; lokasi: string | null; jarakM: number | null };
type Keadaan = PortalState & { absen?: Absen };
type Tolak = { ok: false; kode: string; alasan: string; perluQr?: boolean; bolehLuar?: boolean };
type Terima =
  | { ok: true; menunggu?: false; jenis: string | null; jam: string; lokasi: string; jarakM: number; qr: boolean; hpBaruDikunci: boolean }
  | { ok: true; menunggu: true; jam: string; lokasi: string | null; jarakM: number | null; hpBaruDikunci: boolean };

const STATUS_AJUAN: Record<Pengajuan["status"], { label: string; warna: string }> = {
  menunggu: { label: "Menunggu persetujuan", warna: "var(--warning)" },
  diterima: { label: "Disetujui", warna: "var(--success)" },
  ditolak: { label: "Ditolak", warna: "var(--danger)" },
};

export default function AbsenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [tidakSah, setTidakSah] = useState(false);
  const [langkah, setLangkah] = useState<"diam" | "lokasi" | "foto" | "kirim" | "qr" | "luar">("diam");
  const [alasan, setAlasan] = useState("");
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  // Layar "Absen tim" untuk PIC lapangan = rekap harian tim (components/absen/RekapTim.tsx).
  const [layarTim, setLayarTim] = useState(false);
  const fotoInput = useRef<HTMLInputElement>(null);
  const tertunda = useRef<{ foto: Blob; pos: GeolocationPosition } | null>(null);

  const muat = useCallback(async () => {
    try {
      setKeadaan(await api<Keadaan>(`/api/public/absen/${token}`));
    } catch {
      setTidakSah(true);
    }
  }, [token]);
  useEffect(() => {
    muat();
  }, [muat]);

  // Kamera dibuka LANGSUNG di dalam ketukan, lokasi dibaca SESUDAH foto diambil. Urutannya penting:
  // peramban hanya mengizinkan membuka kamera/pemilih berkas sesaat setelah ketukan, jadi kalau GPS
  // dibaca dulu dan butuh beberapa detik, kamera diam-diam tidak terbuka dan tombolnya macet.
  function mulai() {
    setPesan(null);
    if (!("geolocation" in navigator)) return setPesan({ ok: false, teks: "HP ini tidak bisa membaca lokasi." });
    tertunda.current = null;
    setLangkah("foto");
    fotoInput.current?.click();
  }

  async function fotoDipilih(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return setLangkah("diam");
    let foto: Blob;
    try {
      foto = await kecilkan(f);
    } catch (err) {
      setLangkah("diam");
      return setPesan({ ok: false, teks: pesanFotoGagal(err, f) });
    }
    setLangkah("lokasi");
    try {
      tertunda.current = { foto, pos: await bacaLokasi() };
    } catch {
      setLangkah("diam");
      return setPesan({ ok: false, teks: "Lokasi tidak terbaca. Nyalakan GPS dan izinkan akses lokasi untuk halaman ini, lalu coba lagi." });
    }
    await kirim(null);
  }

  async function kirim(qr: string | null, luar = false) {
    const t = tertunda.current;
    if (!t) return;
    setLangkah("kirim");
    const fd = new FormData();
    fd.set("foto", t.foto, "foto.jpg");
    fd.set("lat", String(t.pos.coords.latitude));
    fd.set("lng", String(t.pos.coords.longitude));
    fd.set("akurasi", String(t.pos.coords.accuracy));
    fd.set("perangkat", idPerangkat());
    if (qr) fd.set("qr", qr);
    if (luar) {
      fd.set("luar", "1");
      fd.set("alasan", alasan);
    }
    try {
      const r = await fetch(`/api/public/absen/${token}/absen`, { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as Terima | Tolak;
      if (r.status === 401) {
        // Sesi PIN habis (8 jam) — dulu tampil "Absen gagal" tanpa penjelasan. Tampilkan layar PIN lagi.
        tertunda.current = null;
        setLangkah("diam");
        setPesan({ ok: false, teks: "Sesi Anda sudah habis. Masukkan PIN lagi, lalu ulangi absen." });
        await muat();
        return;
      }
      if (d.ok && d.menunggu) {
        tertunda.current = null;
        setAlasan("");
        setLangkah("diam");
        setPesan({
          ok: true,
          teks: `Pengajuan absen di luar lokasi terkirim jam ${jamDari(d.jam)}. Absen baru tercatat setelah disetujui owner.` +
            (d.hpBaruDikunci ? " HP ini sekarang terdaftar untuk Anda." : ""),
        });
        await muat();
      } else if (d.ok) {
        tertunda.current = null;
        setLangkah("diam");
        setPesan({
          ok: true,
          teks: `Absen ${d.jenis === "out" ? "pulang" : "masuk"} tercatat jam ${jamDari(d.jam)} di ${d.lokasi}.` +
            (d.hpBaruDikunci ? " HP ini sekarang terdaftar untuk Anda." : ""),
        });
        await muat();
      } else if (!luar && d.bolehLuar) {
        // Di luar radius: foto & lokasi yang sudah diambil DIPERTAHANKAN, tinggal menulis alasan.
        setPesan({ ok: false, teks: d.alasan });
        setLangkah("luar");
      } else if (luar && ["alasan_pendek", "alasan_panjang"].includes(d.kode)) {
        setPesan({ ok: false, teks: d.alasan });
        setLangkah("luar");
      } else if (d.perluQr) {
        setPesan({ ok: false, teks: d.alasan });
        setLangkah("qr");
      } else {
        tertunda.current = null;
        setLangkah("diam");
        setPesan({ ok: false, teks: pesanDari(d, `Absen gagal (kode ${r.status}). Coba lagi.`) });
      }
    } catch {
      setLangkah("diam");
      setPesan({ ok: false, teks: "Tidak tersambung ke server. Periksa internet lalu coba lagi." });
    }
  }

  if (tidakSah) {
    return (
      <Tengah>
        <p className="text-center text-muted">Tautan tidak valid atau karyawan sudah tidak aktif.</p>
      </Tengah>
    );
  }
  if (!keadaan) {
    return (
      <Tengah>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-strong border-t-primary" />
      </Tengah>
    );
  }
  if (!keadaan.authenticated) {
    return (
      <Tengah>
        <PinGate
          token={token}
          employee={keadaan.employee}
          pinSet={keadaan.pinSet}
          posproPin={keadaan.posproPin}
          jalurSesi={`/api/public/absen/${token}/session`}
          onSuccess={muat}
        />
      </Tengah>
    );
  }

  const a = keadaan.absen;
  const sibuk = langkah === "lokasi" || langkah === "kirim";
  const sudahMasuk = (a?.hariIni.length ?? 0) % 2 === 1;

  return (
    <main className="ambient relative min-h-screen bg-bg">
      <div className="relative z-10 mx-auto max-w-md space-y-4 p-4">
        <div className="flex items-center gap-2.5">
          <UbinLogo />
          <NamaMerek className="text-lg" />
          {keadaan.portal && (
            <a href={`/me/${token}`} className="btn-ghost ml-auto h-11 px-3 text-xs">
              Halaman pribadi
            </a>
          )}
        </div>

        <section className="glass-2 rounded-3xl p-5 text-center shadow-xl">
          <div className="text-sm text-muted">Halo,</div>
          <div className="font-display text-2xl font-bold text-fg">{keadaan.employee.fullName}</div>
          <div className="mt-1 text-sm text-subtle">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
          </div>

          {keadaan.asManager ? (
            <p className="mt-4 rounded-xl px-3 py-2 text-sm" style={soft("var(--warning)")}>
              Anda membuka sebagai owner — absen hanya bisa dilakukan karyawannya sendiri.
            </p>
          ) : !a?.aktif ? (
            <p className="mt-4 rounded-xl px-3 py-2 text-sm" style={soft("var(--warning)")}>
              Absen lewat HP belum dinyalakan untuk Anda. Hubungi owner.
            </p>
          ) : (
            <button
              onClick={mulai}
              disabled={sibuk}
              className="btn-primary mt-5 h-16 w-full text-lg disabled:opacity-60"
            >
              {langkah === "lokasi" ? "Membaca lokasi…" : langkah === "foto" ? "Ambil foto wajah…" : langkah === "kirim" ? "Mengirim…" : sudahMasuk ? "Absen Pulang" : "Absen Masuk"}
            </button>
          )}

          {!keadaan.asManager && a?.aktif && a.tim && !layarTim && (
            <button onClick={() => setLayarTim(true)} disabled={sibuk} className="btn-ghost mt-3 h-12 w-full disabled:opacity-60">
              Absen tim
            </button>
          )}

          <input ref={fotoInput} type="file" accept="image/*" capture="user" className="hidden" onChange={fotoDipilih} />

          {pesan && (
            <p className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2 text-left text-sm" style={soft(pesan.ok ? "var(--success)" : "var(--danger)")}>
              {pesan.ok ? <IconCheck className="mt-0.5 shrink-0" /> : <IconAlert className="mt-0.5 shrink-0" />}
              <span>{pesan.teks}</span>
            </p>
          )}
        </section>

        {layarTim && a?.tim && <RekapTim token={token} onTutup={() => setLayarTim(false)} />}

        {langkah === "qr" && (
          <PemindaiQr
            onDapat={(teks) => kirim(teks)}
            onBatal={() => {
              tertunda.current = null;
              setLangkah("diam");
            }}
          />
        )}

        {langkah === "luar" && (
          <section className="glass-2 rounded-3xl p-4 shadow-xl">
            <h2 className="text-sm font-semibold text-fg">Ajukan absen di luar lokasi</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Foto dan lokasi Anda barusan ikut dikirim. Absen baru tercatat setelah owner menyetujuinya — waktunya tetap
              jam Anda mengajukan sekarang.
            </p>
            <label className="mt-3 block space-y-1.5 text-sm">
              <span className="font-medium text-muted">Alasan (wajib)</span>
              <textarea
                className="input"
                rows={3}
                maxLength={500}
                placeholder="mis. kunjungan ke pelanggan di Jl. Merdeka"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                className="btn-ghost h-11 flex-1"
                onClick={() => {
                  tertunda.current = null;
                  setAlasan("");
                  setLangkah("diam");
                }}
              >
                Batal
              </button>
              <button className="btn-primary h-11 flex-1 disabled:opacity-60" disabled={alasan.trim().length < 5} onClick={() => kirim(null, true)}>
                Kirim pengajuan
              </button>
            </div>
          </section>
        )}

        {a && a.pengajuan.length > 0 && (
          <section className="glass rounded-2xl p-4">
            <h2 className="mb-2 text-sm font-semibold text-fg">Pengajuan di luar lokasi</h2>
            <ul className="space-y-2.5 text-sm">
              {a.pengajuan.map((p) => (
                <li key={p.id} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-fg">
                      {new Date(p.jam).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })} · {jamDari(p.jam)}
                    </span>
                    <span className="badge" style={soft(STATUS_AJUAN[p.status]?.warna ?? "var(--fg-subtle)", 18)}>
                      {STATUS_AJUAN[p.status]?.label ?? p.status}
                    </span>
                  </div>
                  <div className="text-xs text-subtle">
                    {p.alasan}
                    {p.lokasi && p.jarakM !== null ? ` · ${teksJarak(p.jarakM)} dari ${p.lokasi}` : ""}
                  </div>
                  {p.catatan && (
                    <div className="text-xs text-muted">
                      <b className="text-fg">Catatan owner:</b> {p.catatan}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="glass rounded-2xl p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
            <IconClock /> Absen hari ini
          </h2>
          {a && a.hariIni.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {a.hariIni.map((h) => (
                <li key={h.id} className="flex justify-between">
                  <span className="text-fg">{h.jenis === "out" ? "Pulang" : "Masuk"} · {jamDari(h.jam)}</span>
                  <span className="text-subtle">{h.lewat === "hp" ? "lewat HP" : h.lewat === "tim" ? "dicatat PIC" : "mesin"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-subtle">Belum ada absen hari ini.</p>
          )}
        </section>

        {a?.aktif && (
          <p className="px-1 text-xs leading-relaxed text-subtle">
            Absen diterima kalau Anda berada di{" "}
            {a.lokasi.length ? a.lokasi.map((l) => `${l.nama} (${l.radiusM} m)`).join(", ") : "lokasi kerja"}, berfoto, dan memakai
            HP yang sama dengan absen pertama Anda.
            {a.bolehLuar && " Sedang di luar lokasi (dinas, kunjungan)? Anda bisa mengajukan absen dengan alasan — tercatat setelah disetujui owner."}
          </p>
        )}
      </div>
    </main>
  );
}

/** Pemindai QR pakai kamera belakang — dipanggil kalau lokasinya mewajibkan QR. */
function PemindaiQr({ onDapat, onBatal }: { onDapat: (teks: string) => void; onBatal: () => void }) {
  // Pemanggilnya mengirim fungsi baru tiap render; lewat ref supaya kamera tidak dimatikan-nyalakan ulang.
  const dapatRef = useRef(onDapat);
  useEffect(() => {
    dapatRef.current = onDapat;
  });
  const video = useRef<HTMLVideoElement>(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let aliran: MediaStream | null = null;
    let jalan = true;
    const kanvas = document.createElement("canvas");
    (async () => {
      try {
        aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        // Dicopot selagi menunggu izin kamera (mis. Batal ditekan cepat): matikan alirannya di sini,
        // kalau tidak lampu kamera HP tetap menyala karena pembersihnya sudah lewat.
        const v = video.current;
        if (!jalan || !v) {
          aliran.getTracks().forEach((t) => t.stop());
          return;
        }
        v.srcObject = aliran;
        // play() bisa ditolak (dipotong muat ulang, kebijakan putar otomatis) padahal kameranya
        // menyala — bingkainya tetap terbaca untuk dipindai, jadi itu bukan alasan menampilkan galat.
        await v.play().catch(() => {});
        const pindai = () => {
          if (!jalan) return;
          if (v.videoWidth) {
            kanvas.width = v.videoWidth;
            kanvas.height = v.videoHeight;
            const ctx = kanvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const kode = jsQR(ctx.getImageData(0, 0, kanvas.width, kanvas.height).data, kanvas.width, kanvas.height);
            if (kode?.data?.startsWith("QE1.")) {
              jalan = false;
              dapatRef.current(kode.data);
              return;
            }
          }
          requestAnimationFrame(pindai);
        };
        pindai();
      } catch {
        if (jalan) setGalat("Kamera tidak bisa dibuka. Izinkan akses kamera untuk halaman ini.");
      }
    })();
    return () => {
      jalan = false;
      aliran?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <section className="glass-2 rounded-3xl p-4 text-center shadow-xl">
      <div className="mb-2 text-sm font-semibold text-fg">Arahkan kamera ke QR di layar toko</div>
      {galat ? (
        <p className="text-sm text-danger">{galat}</p>
      ) : (
        <video ref={video} playsInline muted className="aspect-square w-full rounded-2xl bg-black object-cover" />
      )}
      <button className="btn-ghost mt-3 h-10 w-full" onClick={onBatal}>Batal</button>
    </section>
  );
}

function Tengah({ children }: { children: React.ReactNode }) {
  return (
    <main className="ambient relative flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </main>
  );
}

function soft(c: string, pct = 14): React.CSSProperties {
  return { background: `color-mix(in oklab, ${c} ${pct}%, transparent)`, color: c };
}
