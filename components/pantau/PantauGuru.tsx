"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { IconAlert, IconChevronLeft, IconChevronRight, IconDownload, IconLogout, IconUsers } from "@/components/ui/icons";
import { soft } from "@/components/portal/ui";
import { tglPendek } from "@/components/magang/ui";
import { seninDari } from "@/lib/services/magang/rotasi";
import { BagianAnak, Bilah, Chip, teksKehadiran, warnaHadir } from "./BagianAnak";
import { RekapCetak } from "./RekapCetak";
import type { AnakRingkas, DetailAnak, KepalaPantau } from "./tipe";

type Tahap =
  | { jenis: "memuat" }
  | { jenis: "tidak-berlaku"; pesan: string }
  | { jenis: "galat"; pesan: string }
  | { jenis: "pin"; sekolah: string }
  | { jenis: "masuk"; kepala: KepalaPantau };

type Mode = "semua" | "minggu" | "bulan" | "atur";

/** fetch JSON + status (status 401/404 menentukan layar, jadi tidak memakai api() yang hanya melempar pesan). */
async function ambil<T>(url: string, init?: RequestInit): Promise<{ status: number; data: T & { message?: string } }> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  return { status: res.status, data };
}

const PESAN_UMUM = "Tautan tidak berlaku. Minta tautan baru ke admin.";

function pantauHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function rentangUntuk(mode: Mode, k: KepalaPantau, atur: { dari: string; sampai: string }) {
  if (mode === "minggu") return { dari: seninDari(k.hariIni), sampai: k.hariIni };
  if (mode === "bulan") return { dari: `${k.hariIni.slice(0, 8)}01`, sampai: k.hariIni };
  if (mode === "atur") return atur;
  return { dari: k.awalMagang, sampai: k.hariIni };
}

/** Halaman guru pembimbing: PIN → daftar anak sekolahnya → detail per anak; cetak rekap anak/sekolah. */
export function PantauGuru({ token }: { token: string }) {
  const dasar = `/api/public/pantau/${token}`;
  const [tahap, setTahap] = useState<Tahap>({ jenis: "memuat" });
  const [mode, setMode] = useState<Mode>("semua");
  const [atur, setAtur] = useState({ dari: "", sampai: "" });
  const [anak, setAnak] = useState<{ kunci: string; items: AnakRingkas[] } | null>(null);
  const [galatAnak, setGalatAnak] = useState("");
  const [detail, setDetail] = useState<{ kunci: string; d: DetailAnak } | null>(null);
  const [galatDetail, setGalatDetail] = useState("");
  const [cetak, setCetak] = useState<{ jenis: "anak" | "sekolah"; items: DetailAnak[] | null } | null>(null);

  const hash = useSyncExternalStore(pantauHash, () => window.location.hash, () => "");
  const dipilih = Number(/^#anak-(\d+)$/.exec(hash)?.[1] ?? 0) || null;

  const tanganiStatus = useCallback((status: number, pesan?: string) => {
    if (status === 404) setTahap({ jenis: "tidak-berlaku", pesan: pesan || PESAN_UMUM });
    else if (status === 401) setTahap((t) => ({ jenis: "pin", sekolah: t.jenis === "masuk" ? t.kepala.sekolah : t.jenis === "pin" ? t.sekolah : "" }));
    else setTahap({ jenis: "galat", pesan: pesan || "Halaman tidak bisa dimuat. Coba muat ulang." });
  }, []);

  const muatStatus = useCallback(() => {
    ambil<{ masuk: boolean; sekolah: string } & Partial<KepalaPantau>>(dasar).then(
      ({ status, data }) => {
        if (status !== 200) return tanganiStatus(status, data.message);
        setTahap(data.masuk ? { jenis: "masuk", kepala: data as KepalaPantau } : { jenis: "pin", sekolah: data.sekolah });
      },
      () => setTahap({ jenis: "galat", pesan: "Tidak tersambung ke server. Periksa internet lalu muat ulang." })
    );
  }, [dasar, tanganiStatus]);

  useEffect(() => {
    muatStatus();
  }, [muatStatus]);

  const kepala = tahap.jenis === "masuk" ? tahap.kepala : null;
  const r = kepala ? rentangUntuk(mode, kepala, atur.dari && atur.sampai ? atur : { dari: kepala.awalMagang, sampai: kepala.hariIni }) : null;
  const kunciR = r ? `${r.dari}_${r.sampai}` : "";

  useEffect(() => {
    if (!kunciR) return;
    let hidup = true;
    const [dari, sampai] = kunciR.split("_");
    ambil<{ anak: AnakRingkas[] }>(`${dasar}/anak?dari=${dari}&sampai=${sampai}`).then(
      ({ status, data }) => {
        if (!hidup) return;
        if (status !== 200) return status === 401 || status === 404 ? tanganiStatus(status, data.message) : setGalatAnak(data.message || "Gagal memuat daftar anak.");
        setGalatAnak("");
        setAnak({ kunci: kunciR, items: data.anak });
      },
      () => hidup && setGalatAnak("Tidak tersambung ke server.")
    );
    return () => {
      hidup = false;
    };
  }, [kunciR, dasar, tanganiStatus]);

  const kunciDetail = dipilih && kunciR ? `${dipilih}_${kunciR}` : "";
  useEffect(() => {
    if (!kunciDetail) return;
    let hidup = true;
    const [id, dari, sampai] = kunciDetail.split("_");
    ambil<DetailAnak>(`${dasar}/anak/${id}?dari=${dari}&sampai=${sampai}`).then(
      ({ status, data }) => {
        if (!hidup) return;
        if (status === 401 || (status === 404 && data.message === PESAN_UMUM)) return tanganiStatus(status, data.message);
        if (status !== 200) return setGalatDetail(data.message || "Data anak tidak bisa dimuat.");
        setGalatDetail("");
        setDetail({ kunci: kunciDetail, d: data });
      },
      () => hidup && setGalatDetail("Tidak tersambung ke server.")
    );
    return () => {
      hidup = false;
    };
  }, [kunciDetail, dasar, tanganiStatus]);

  // Buka/tutup detail lewat #anak-<id> → mulai dari atas (tombol Kembali peramban ikut bekerja).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [dipilih]);

  // Cetak: tunggu isi cetakan ter-render, lalu buka dialog cetak peramban.
  useEffect(() => {
    if (!cetak?.items) return;
    const selesai = () => setCetak(null);
    window.addEventListener("afterprint", selesai, { once: true });
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", selesai);
    };
  }, [cetak]);

  async function cetakSekolah(items: AnakRingkas[]) {
    if (!r) return;
    setCetak({ jenis: "sekolah", items: null });
    const hasil: DetailAnak[] = new Array(items.length);
    let i = 0;
    let gagal = false;
    const pekerja = async () => {
      while (i < items.length && !gagal) {
        const k = i++;
        const { status, data } = await ambil<DetailAnak>(`${dasar}/anak/${items[k].id}?dari=${r.dari}&sampai=${r.sampai}`);
        if (status !== 200) gagal = true;
        else hasil[k] = data;
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, pekerja));
    if (gagal) {
      setCetak(null);
      setGalatAnak("Sebagian data gagal dimuat untuk dicetak. Coba lagi.");
      return;
    }
    setCetak({ jenis: "sekolah", items: hasil });
  }

  async function keluar() {
    await fetch(`${dasar}/keluar`, { method: "POST" }).catch(() => undefined);
    window.location.hash = "";
    setAnak(null);
    setDetail(null);
    setTahap((t) => ({ jenis: "pin", sekolah: t.jenis === "masuk" ? t.kepala.sekolah : "" }));
  }

  // ── Layar selain "masuk" ──
  if (tahap.jenis === "memuat") {
    return (
      <Bingkai>
        <div role="status" className="glass h-40 w-full max-w-md animate-pulse rounded-3xl">
          <span className="sr-only">Memuat…</span>
        </div>
      </Bingkai>
    );
  }
  if (tahap.jenis === "tidak-berlaku" || tahap.jenis === "galat") {
    return (
      <Bingkai>
        <div className="glass-2 w-full max-w-md rounded-3xl p-6 text-center sm:p-8">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl text-danger" style={soft("var(--danger)")}>
            <IconAlert className="text-[22px]" aria-hidden="true" />
          </span>
          <h1 className="font-display text-xl font-bold text-fg">{tahap.jenis === "tidak-berlaku" ? "Tautan tidak berlaku" : "Terjadi kendala"}</h1>
          <p className="mt-2 text-sm text-muted">{tahap.pesan}</p>
        </div>
      </Bingkai>
    );
  }
  if (tahap.jenis === "pin") {
    return (
      <Bingkai>
        <LayarPin dasar={dasar} sekolah={tahap.sekolah} onMasuk={muatStatus} />
      </Bingkai>
    );
  }

  const k = tahap.kepala;
  const daftar = anak && anak.kunci === kunciR ? anak.items : null;
  const det = detail && detail.kunci === kunciDetail ? detail.d : null;
  const anakDipilih = dipilih ? daftar?.find((a) => a.id === dipilih) ?? null : null;

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 print:hidden sm:py-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pantauan guru pembimbing</p>
            <h1 className="font-display text-2xl font-bold text-fg">{k.sekolah}</h1>
            {k.usaha && <p className="text-sm text-muted">Tempat magang: {k.usaha}</p>}
          </div>
          <button type="button" className="btn-ghost h-11 px-3 text-sm" onClick={keluar}>
            <IconLogout aria-hidden="true" /> Keluar
          </button>
        </header>
        <p className="rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted">
          Halaman ini hanya untuk guru pembimbing {k.sekolah}. Jangan bagikan tautan &amp; PIN. Data hanya bisa dilihat, tidak bisa diubah.
        </p>

        <Saringan mode={mode} setMode={setMode} r={r!} setAtur={setAtur} kepala={k} />

        {dipilih ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="btn-ghost h-11 px-3 text-sm" onClick={() => (window.location.hash = "")}>
                <IconChevronLeft aria-hidden="true" /> Semua anak
              </button>
              <button type="button" className="btn-primary h-11 text-sm" disabled={!det} onClick={() => det && setCetak({ jenis: "anak", items: [det] })}>
                <IconDownload aria-hidden="true" /> Cetak rekap anak
              </button>
            </div>
            {(det?.anak ?? anakDipilih) && <KepalaAnak a={(det?.anak ?? anakDipilih)!} />}
            {galatDetail ? (
              <Galat>{galatDetail}</Galat>
            ) : !det ? (
              <Kerangka baris={3} />
            ) : (
              <BagianAnak d={det} />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-fg">Anak magang{daftar ? ` (${daftar.length})` : ""}</h2>
              <button type="button" className="btn-ghost h-11 px-3 text-sm" disabled={!daftar?.length || !!cetak} onClick={() => daftar && cetakSekolah(daftar)}>
                <IconDownload aria-hidden="true" /> {cetak?.jenis === "sekolah" && !cetak.items ? "Menyiapkan…" : "Cetak rekap sekolah"}
              </button>
            </div>
            {galatAnak && <Galat>{galatAnak}</Galat>}
            {!daftar ? (
              !galatAnak && <Kerangka baris={3} />
            ) : daftar.length === 0 ? (
              <p className="glass rounded-2xl p-8 text-center text-sm text-subtle">Belum ada anak magang dari sekolah ini.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {daftar.map((a) => (
                  <li key={a.id}>
                    <KartuAnak a={a} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {cetak?.items && (
        <div className="hidden print:block">
          {cetak.items.map((d, i) => (
            <div key={d.anak.id} style={i < cetak.items!.length - 1 ? { breakAfter: "page" } : undefined}>
              <RekapCetak d={d} kepala={k} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Bingkai({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4 py-10">{children}</main>;
}

function Galat({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-danger" style={soft("var(--danger)")}>
      <IconAlert className="shrink-0" aria-hidden="true" /> {children}
    </p>
  );
}

function Kerangka({ baris }: { baris: number }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Memuat…</span>
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className="glass h-28 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}

function LayarPin({ dasar, sekolah, onMasuk }: { dasar: string; sekolah: string; onMasuk: () => void }) {
  const [pin, setPin] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    if (!pin) return setGalat("Masukkan PIN.");
    setSibuk(true);
    try {
      const { status, data } = await ambil<{ ok?: boolean }>(`${dasar}/masuk`, { method: "POST", body: JSON.stringify({ pin }) });
      if (status === 200) return onMasuk();
      if (status === 404) return onMasuk(); // tautan baru saja dicabut → layar "tidak berlaku"
      setGalat(data.message || "Gagal masuk.");
      setPin("");
    } catch {
      setGalat("Tidak tersambung ke server.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={kirim} className="glass-2 w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8" noValidate>
      <div className="mb-5 flex flex-col items-center text-center">
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-2 text-on-primary">
          <IconUsers className="text-[22px]" aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pantauan guru pembimbing</p>
        {sekolah && <h1 className="mt-1 font-display text-xl font-bold text-fg">{sekolah}</h1>}
      </div>
      <p className="mb-4 rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted">
        Halaman ini hanya untuk guru pembimbing{sekolah ? ` ${sekolah}` : ""}. Jangan bagikan tautan &amp; PIN.
      </p>
      {galat && (
        <p id="pin-galat" role="alert" className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger" style={soft("var(--danger)")}>
          <IconAlert className="shrink-0" aria-hidden="true" /> {galat}
        </p>
      )}
      <label htmlFor="pin-guru" className="block text-sm font-medium text-fg">
        PIN dari admin
      </label>
      <input
        id="pin-guru"
        className="input mt-1.5 h-12 text-center text-xl tracking-[0.4em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={pin}
        aria-invalid={!!galat}
        aria-describedby={galat ? "pin-galat" : undefined}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
      />
      <button type="submit" disabled={sibuk} className="btn-primary mt-4 h-11 w-full">
        {sibuk ? "Memeriksa…" : "Masuk"}
      </button>
      <p className="mt-4 text-center text-xs text-subtle">Lupa PIN? Hubungi admin tempat magang.</p>
    </form>
  );
}

function Saringan({
  mode,
  setMode,
  r,
  setAtur,
  kepala,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  r: { dari: string; sampai: string };
  setAtur: (a: { dari: string; sampai: string }) => void;
  kepala: KepalaPantau;
}) {
  const chip: { m: Mode; label: string }[] = [
    { m: "semua", label: "Semua" },
    { m: "minggu", label: "Minggu ini" },
    { m: "bulan", label: "Bulan ini" },
  ];
  return (
    <fieldset className="glass rounded-2xl p-3">
      <legend className="sr-only">Rentang tanggal</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pilihan cepat rentang">
        {chip.map((c) => (
          <button
            key={c.m}
            type="button"
            aria-pressed={mode === c.m}
            onClick={() => setMode(c.m)}
            className={`h-11 rounded-xl border px-4 text-sm font-semibold transition ${
              mode === c.m ? "border-primary bg-primary/10 text-fg" : "border-border text-muted hover:text-fg"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium text-muted">
          Dari
          <input
            type="date"
            className="input mt-1 h-11"
            value={r.dari}
            min={kepala.awalMagang}
            max={kepala.hariIni}
            onChange={(e) => {
              if (!e.target.value) return;
              setAtur({ dari: e.target.value, sampai: r.sampai });
              setMode("atur");
            }}
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Sampai
          <input
            type="date"
            className="input mt-1 h-11"
            value={r.sampai}
            max={kepala.hariIni}
            onChange={(e) => {
              if (!e.target.value) return;
              setAtur({ dari: r.dari, sampai: e.target.value });
              setMode("atur");
            }}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">
        Menampilkan {tglPendek(r.dari)} {r.dari.slice(0, 4)} – {tglPendek(r.sampai)} {r.sampai.slice(0, 4)}. Hari sebelum anak mulai magang, Minggu, dan libur tidak dihitung.
      </p>
    </fieldset>
  );
}

function KepalaAnak({ a }: { a: AnakRingkas }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-bold text-fg">{a.namaLengkap}</h2>
        <Chip label={a.aktif ? "Aktif" : "Selesai/nonaktif"} warna={a.aktif ? "var(--success)" : "var(--fg-subtle)"} />
      </div>
      <p className="text-sm text-muted">
        {a.jurusan ? `${a.jurusan} · ` : ""}
        {tglPendek(a.mulai)} {a.mulai.slice(0, 4)}
        {a.selesai ? ` – ${tglPendek(a.selesai)} ${a.selesai.slice(0, 4)}` : ""}
      </p>
    </div>
  );
}

function KartuAnak({ a }: { a: AnakRingkas }) {
  const k = a.kehadiran;
  return (
    <a
      href={`#anak-${a.id}`}
      className="glass block rounded-2xl p-4 transition hover:border-border-strong"
      aria-label={`Lihat detail ${a.nama}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold text-fg">{a.nama}</h3>
          <p className="truncate text-xs text-muted">{a.jurusan ?? a.namaLengkap}</p>
        </div>
        {!a.aktif && <Chip label="Selesai/nonaktif" warna="var(--fg-subtle)" />}
      </div>
      <p className="mt-2 text-sm text-fg">
        {a.posIni ? (
          <>
            Pos minggu ini: <b>{a.posIni.nama}</b>
            {a.posIni.lokasi && <span className="text-muted"> · {a.posIni.lokasi}</span>}
          </>
        ) : (
          <span className="text-muted">Tidak ada pos minggu ini</span>
        )}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-medium text-muted">Kehadiran</span>
        <span className="tabular font-bold" style={{ color: warnaHadir(k.persen) }}>
          {k.persen == null ? "—" : `${k.persen}%`}
        </span>
      </div>
      <div className="mt-1">
        <Bilah persen={k.persen} warna={warnaHadir(k.persen)} label={`Kehadiran ${a.nama}`} />
      </div>
      <p className="mt-1 text-xs text-muted">{teksKehadiran(k)}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          Jurnal {a.jurnal.terisi}/{a.jurnal.dari} · Side quest {a.sideQuest ? `${a.sideQuest.selesai}/${a.sideQuest.total}` : "—"}
        </span>
        <span className="inline-flex items-center gap-0.5 font-semibold text-primary">
          Detail <IconChevronRight aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}
