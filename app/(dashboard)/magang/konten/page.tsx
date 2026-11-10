"use client";

import { Suspense, useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconCheck, IconChevronLeft, IconChevronRight, IconPlus, IconSettings } from "@/components/ui/icons";
import { Judul, Memuat, Pesan } from "@/components/magang/ui";
import { geserBulan, namaBulan, namaTanggal } from "@/lib/services/magang/konten";
import { PanelBrief } from "@/components/magang/konten/PanelBrief";
import { LegendaKonten, TabelKonten, type PatchBaris, type Saringan } from "@/components/magang/konten/TabelKonten";
import { KartuKonten } from "@/components/magang/konten/KartuKonten";
import { DialogBuatBulan } from "@/components/magang/konten/DialogBuatBulan";
import { DialogPlatform } from "@/components/magang/konten/DialogPlatform";
import { SetelanKonten } from "@/components/magang/konten/SetelanKonten";
import { IkonPlatform } from "@/components/magang/konten/IkonPlatform";
import { Laci } from "@/components/magang/konten/Laci";
import { FOKUS, titikWarna, type BarisJson, type DataKonten } from "@/components/magang/konten/tipe";

/** Lebar layar: ≥1536 brief tampil bawaan di samping tabel; ≥1280 di samping (bisa disembunyikan); <1280 laci; <768 kartu. */
const MEDIA_LEBAR = "(min-width: 1536px)";
const MEDIA_XL = "(min-width: 1280px)";
const MEDIA_MD = "(min-width: 768px)";
function useMedia(q: string, server: boolean) {
  return useSyncExternalStore(
    useCallback(
      (ubah: () => void) => {
        const m = window.matchMedia(q);
        m.addEventListener("change", ubah);
        return () => m.removeEventListener("change", ubah);
      },
      [q]
    ),
    () => window.matchMedia(q).matches,
    () => server
  );
}

function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
type PilihanPlatform = number | "semua";
function bacaPlatform(v: string | null): PilihanPlatform | null {
  if (v === "semua") return "semua";
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Magang → Jadwal Konten: meniru sheet pembina (panel catatan & brief, tabel padat), per platform (tab) atau
 * "Semua platform". Sunting sel langsung (perubahan tampil seketika, dibatalkan bila server menolak). Layar HP
 * (<768 px) memakai kartu per hari; <1280 px brief di laci.
 */
export default function JadwalKontenPage() {
  return (
    <Suspense fallback={<Memuat baris={2} tinggi="h-64" />}>
      <JadwalKonten />
    </Suspense>
  );
}

function JadwalKonten() {
  const id = useId();
  const sp = useSearchParams();
  const awal = sp.get("bulan");
  const [bulan, setBulan] = useState(() => (awal && /^\d{4}-(0[1-9]|1[0-2])$/.test(awal) ? awal : bulanIni()));
  // null = biarkan server memilih platform aktif pertama; sesudah data datang diisi dari data.platformId.
  const [platform, setPlatform] = useState<PilihanPlatform | null>(() => bacaPlatform(sp.get("platform")));
  const [lihatArsip, setLihatArsip] = useState(false);
  const [data, setData] = useState<DataKonten | null>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [saring, setSaring] = useState<Saringan>({ anak: null, grup: null, status: null });
  const [buat, setBuat] = useState(false);
  const [setelan, setSetelan] = useState(false);
  const [kelola, setKelola] = useState(false);
  const [hapus, setHapus] = useState<BarisJson | null>(null);
  const [busy, setBusy] = useState(false);
  const layarLebar = useMedia(MEDIA_LEBAR, true);
  const layarXl = useMedia(MEDIA_XL, true);
  const layarMd = useMedia(MEDIA_MD, true);
  // ≥1280: catatan & brief di samping tabel (bawaan tampil ≥1536). <1280: laci, bawaan tertutup.
  const [pilihBrief, setPilihBrief] = useState<boolean | null>(null);
  const [laciBrief, setLaciBrief] = useState(false);
  const tampilBrief = pilihBrief ?? layarLebar;
  const dimuat = useRef<string | null>(null);

  const kunci = platform === null ? "" : String(platform);
  const ambil = useCallback((b: string, p: string) => api<DataKonten>(`/api/magang/konten?bulan=${b}${p ? `&platform=${p}` : ""}`), []);
  const terima = useCallback((d: DataKonten) => {
    setData(d);
    setGalatMuat("");
    const p: PilihanPlatform = d.platformId ?? "semua";
    dimuat.current = `${d.bulan}|${p}`;
    setPlatform(p);
  }, []);
  const muat = useCallback(() => ambil(bulan, kunci).then(terima, (e: unknown) => setGalatMuat(e instanceof Error ? e.message : "Gagal memuat jadwal.")), [ambil, bulan, kunci, terima]);
  useEffect(() => {
    if (dimuat.current === `${bulan}|${kunci}`) return; // baru saja dimuat (platform diisi dari jawaban server)
    let hidup = true;
    ambil(bulan, kunci).then(
      (d) => hidup && terima(d),
      (e: unknown) => hidup && setGalatMuat(e instanceof Error ? e.message : "Gagal memuat jadwal.")
    );
    return () => {
      hidup = false;
    };
  }, [ambil, bulan, kunci, terima]);
  useEffect(() => {
    window.history.replaceState(null, "", `?bulan=${bulan}${kunci ? `&platform=${kunci}` : ""}`);
  }, [bulan, kunci]);

  const pesan = (ok: string) => {
    setGalat("");
    setNotice(ok);
  };
  const gagal = (e: unknown, cadangan: string) => {
    setNotice("");
    setGalat(e instanceof Error ? e.message : cadangan);
  };

  /** Optimis: tampil dulu, kirim, lalu ganti dengan jawaban server — atau kembalikan bila ditolak. */
  async function ubah(b: BarisJson, patch: PatchBaris) {
    const status = data?.status.find((s) => s.id === (patch.statusId ?? b.statusId));
    const pindah = patch.platformId != null && data?.platformId != null && patch.platformId !== data.platformId;
    setData((d) => (d ? { ...d, baris: d.baris.map((x) => (x.id === b.id ? { ...x, ...patch } : x)) } : d));
    try {
      const baru = await api<BarisJson>(`/api/magang/konten/${b.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setData((d) => (d ? { ...d, baris: pindah ? d.baris.filter((x) => x.id !== b.id) : d.baris.map((x) => (x.id === b.id ? baru : x)) } : d));
      if (patch.usulan === false) pesan(`Usulan ${namaTanggal(b.tanggal)} disetujui.`);
      else if (patch.statusId && status?.final) pesan(`${namaTanggal(b.tanggal)} ditandai ${status.nama}.`);
      else if (patch.platformId) pesan(`${namaTanggal(b.tanggal)} dipindah ke ${data?.platform.find((p) => p.id === patch.platformId)?.nama ?? "platform lain"}.`);
      else setGalat("");
    } catch (e) {
      setData((d) => (d ? { ...d, baris: d.baris.map((x) => (x.id === b.id ? b : x)) } : d));
      gagal(e, "Gagal menyimpan perubahan.");
    }
  }

  async function tambah(tanggal: string) {
    if (!data || data.platformId == null) return;
    const hari = new Date(`${tanggal}T00:00:00`).getDay() as 1 | 2 | 3 | 4 | 5 | 6;
    const kunciPola = data.pola.hari[hari];
    const konsep = data.konsep.find((k) => k.aktif && k.kunci === kunciPola) ?? data.konsep.find((k) => k.aktif);
    if (!konsep) return gagal(null, "Belum ada konsep aktif. Tambahkan dulu di Setelan → Konsep.");
    try {
      const baru = await api<BarisJson>("/api/magang/konten", { method: "POST", body: JSON.stringify({ platformId: data.platformId, tanggal, konsepId: konsep.id }) });
      setData((d) => (d ? { ...d, baris: [...d.baris, baru] } : d));
      pesan(`Baris baru di ${namaTanggal(tanggal)}. Pilih kode anak/grup di kolom CODE.`);
    } catch (e) {
      gagal(e, "Gagal menambah baris.");
    }
  }

  async function hapusYa() {
    if (!hapus) return;
    setBusy(true);
    try {
      await api(`/api/magang/konten/${hapus.id}`, { method: "DELETE" });
      setData((d) => (d ? { ...d, baris: d.baris.filter((x) => x.id !== hapus.id) } : d));
      pesan(`Baris ${namaTanggal(hapus.tanggal)} dihapus.`);
      setHapus(null);
    } catch (e) {
      gagal(e, "Gagal menghapus.");
      setHapus(null);
    } finally {
      setBusy(false);
    }
  }

  async function setujuiSemua() {
    setBusy(true);
    try {
      const r = await api<{ disetujui: number }>("/api/magang/konten/setujui", {
        method: "POST",
        body: JSON.stringify({ bulan, ...(data?.platformId != null ? { platformId: data.platformId } : {}) }),
      });
      pesan(`${r.disetujui} usulan disetujui.`);
      await muat();
    } catch (e) {
      gagal(e, "Gagal menyetujui usulan.");
    } finally {
      setBusy(false);
    }
  }

  const pilihPlatform = (p: PilihanPlatform) => {
    if (p === platform) return;
    setNotice("");
    setGalat("");
    setLaciBrief(false);
    setPlatform(p);
  };

  const semua = data?.platformId == null;
  const terpilih = data && data.platformId != null ? data.platform.find((p) => p.id === data.platformId) : undefined;
  const jumlahUsulan = data?.baris.filter((b) => b.usulan).length ?? 0;
  const final = new Set(data?.status.filter((s) => s.final).map((s) => s.id));
  const selesai = data?.baris.filter((b) => final.has(b.statusId)).length ?? 0;
  const pilihSaring = (k: keyof Saringan, v: string) => setSaring((s) => ({ ...s, [k]: v ? Number(v) : null }));
  const adaArsip = data?.platform.some((p) => !p.aktif) ?? false;
  const tab = data?.platform.filter((p) => p.aktif || lihatArsip || p.id === data.platformId) ?? [];
  const bisaBuat = !!terpilih && terpilih.aktif;
  const brief =
    data && terpilih && data.brief ? (
      <PanelBrief key={`${terpilih.id}-${JSON.stringify(data.brief)}`} platform={terpilih} brief={data.brief} konsep={data.konsep} onTersimpan={muat} />
    ) : (
      <p className="glass rounded-2xl p-4 text-sm text-muted">Catatan & brief diatur per platform. Pilih satu platform di atas untuk melihat atau mengubahnya.</p>
    );

  return (
    <div className="space-y-4">
      <Judul
        judul="Jadwal Konten"
        keterangan="Jadwal konten harian anak magang per platform, seperti sheet pembina. Klik sel untuk mengubah; anak mengisi judul, tautan, dan statusnya dari HP."
        aksi={
          <>
            <button type="button" className={`btn-ghost h-11 px-3 text-sm ${FOKUS}`} onClick={() => setSetelan(true)} disabled={!data}>
              <IconSettings className="text-[16px]" aria-hidden="true" /> Setelan
            </button>
            <button
              type="button"
              className={`btn-primary h-11 px-4 text-sm ${FOKUS}`}
              onClick={() => setBuat(true)}
              disabled={!data || !bisaBuat}
              aria-describedby={data && !bisaBuat ? `${id}-buat-ket` : undefined}
              title={data && !bisaBuat ? "Pilih satu platform aktif dulu" : undefined}
            >
              <IconPlus className="text-[16px]" aria-hidden="true" /> Buat jadwal bulan berikut
            </button>
          </>
        }
      />

      {/* Platform: tab bergulir ke samping di layar sempit. */}
      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-2">
        <div role="group" aria-label="Platform" className="-m-1 flex min-w-0 flex-1 basis-full gap-1.5 overflow-x-auto p-1 md:basis-0 md:flex-wrap md:overflow-visible">
          {tab.map((p) => {
            const aktif = data?.platformId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={aktif}
                onClick={() => pilihPlatform(p.id)}
                className={`flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition ${FOKUS} ${
                  aktif ? "border-primary bg-primary/12 text-fg shadow-sm" : "border-border text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={titikWarna(p.warna)} aria-hidden="true" />
                <IkonPlatform ikon={p.ikon} className="shrink-0 text-[15px]" />
                {p.nama}
                {!p.aktif && <span className="text-xs font-normal text-muted">(arsip)</span>}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={!!data && semua}
            onClick={() => pilihPlatform("semua")}
            className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition ${FOKUS} ${
              data && semua ? "border-primary bg-primary/12 text-fg shadow-sm" : "border-dashed border-border-strong text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            Semua platform
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 md:self-start">
          {adaArsip && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm text-fg">
              <input type="checkbox" className="h-4 w-4" checked={lihatArsip} onChange={(e) => setLihatArsip(e.target.checked)} />
              Tampilkan arsip
            </label>
          )}
          <button type="button" className={`btn-ghost h-11 px-3 text-sm ${FOKUS}`} onClick={() => setKelola(true)} disabled={!data}>
            <IconSettings className="text-[16px]" aria-hidden="true" /> Kelola platform
          </button>
        </div>
      </div>
      {data && !bisaBuat && (
        <p id={`${id}-buat-ket`} className="-mt-2 px-1 text-xs text-muted">
          {semua ? "Tampilan semua platform: pilih satu platform untuk membuat jadwal atau menambah baris." : "Platform ini diarsipkan — buka arsipnya di Kelola platform untuk membuat jadwal."}
        </p>
      )}

      <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-3">
        <div className="flex items-end gap-1">
          <button type="button" className={`btn-ghost h-11 w-11 px-0 ${FOKUS}`} aria-label="Bulan sebelumnya" onClick={() => setBulan(geserBulan(bulan, -1))}>
            <IconChevronLeft className="text-[16px]" aria-hidden="true" />
          </button>
          <div>
            <label htmlFor={`${id}-bln`} className="block text-xs font-semibold text-muted">
              Bulan
            </label>
            <input id={`${id}-bln`} type="month" className="input mt-1 h-11 w-40 sm:w-44" value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
          </div>
          <button type="button" className={`btn-ghost h-11 w-11 px-0 ${FOKUS}`} aria-label="Bulan berikutnya" onClick={() => setBulan(geserBulan(bulan, 1))}>
            <IconChevronRight className="text-[16px]" aria-hidden="true" />
          </button>
        </div>
        {data && (
          <>
            <div className="min-w-[8.5rem] flex-1 sm:flex-none">
              <label htmlFor={`${id}-sa`} className="block text-xs font-semibold text-muted">
                Anak
              </label>
              <select id={`${id}-sa`} className="input mt-1 h-11 w-full sm:w-44" value={saring.anak ?? ""} onChange={(e) => pilihSaring("anak", e.target.value)}>
                <option value="">Semua anak</option>
                {data.anak
                  .filter((a) => a.aktif || a.kode != null)
                  .map((a) => (
                    <option key={a.pesertaId} value={a.pesertaId}>
                      {a.kode ?? "–"} · {a.panggilan}
                    </option>
                  ))}
              </select>
            </div>
            <div className="min-w-[7rem] flex-1 sm:flex-none">
              <label htmlFor={`${id}-sg`} className="block text-xs font-semibold text-muted">
                Grup
              </label>
              <select id={`${id}-sg`} className="input mt-1 h-11 w-full sm:w-36" value={saring.grup ?? ""} onChange={(e) => pilihSaring("grup", e.target.value)}>
                <option value="">Semua grup</option>
                {data.grup.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[8.5rem] flex-1 sm:flex-none">
              <label htmlFor={`${id}-ss`} className="block text-xs font-semibold text-muted">
                Status
              </label>
              <select id={`${id}-ss`} className="input mt-1 h-11 w-full sm:w-44" value={saring.status ?? ""} onChange={(e) => pilihSaring("status", e.target.value)}>
                <option value="">Semua status</option>
                {data.status.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </div>
            <p className="w-full self-center text-xs text-muted sm:ml-auto sm:w-auto" aria-live="polite">
              {namaBulan(bulan)}
              {terpilih ? ` · ${terpilih.nama}` : " · semua platform"}: <b className="text-fg">{data.baris.length}</b> konten · <b className="text-fg">{selesai}</b> selesai
              {jumlahUsulan > 0 && (
                <>
                  {" "}
                  · <b className="text-warning">{jumlahUsulan}</b> usulan
                </>
              )}
            </p>
            <button
              type="button"
              className={`btn-ghost h-11 px-3 text-sm ${FOKUS}`}
              aria-expanded={layarXl ? tampilBrief : laciBrief}
              aria-controls={`${id}-brief`}
              onClick={() => (layarXl ? setPilihBrief(!tampilBrief) : setLaciBrief(true))}
            >
              {layarXl ? (tampilBrief ? "Sembunyikan catatan" : "Tampilkan catatan") : "Catatan & brief"}
            </button>
            {jumlahUsulan > 0 && (
              <button type="button" className={`btn-ghost h-11 px-3 text-sm ${FOKUS}`} disabled={busy} onClick={setujuiSemua}>
                <IconCheck className="text-[15px] text-success" aria-hidden="true" /> Setujui semua usulan
              </button>
            )}
          </>
        )}
      </div>

      <div aria-live="polite">
        {notice && <Pesan jenis="ok">{notice}</Pesan>}
        {galat && (
          <div role="alert">
            <Pesan jenis="galat">{galat}</Pesan>
          </div>
        )}
      </div>

      {galatMuat ? (
        <div role="alert" className="space-y-2">
          <Pesan jenis="galat">{galatMuat}</Pesan>
          <button type="button" className={`btn-ghost h-11 px-4 text-sm ${FOKUS}`} onClick={muat}>
            Coba lagi
          </button>
        </div>
      ) : !data ? (
        <Memuat baris={2} tinggi="h-64" />
      ) : (
        <>
          {data.platform.length === 0 && <Pesan jenis="galat">Belum ada platform. Buka Kelola platform untuk menambah (mis. nama akun/brand tempat konten diposting).</Pesan>}
          {data.konsep.length === 0 && <Pesan jenis="galat">Belum ada klasifikasi konsep. Buka Setelan → Konsep untuk menambah (atau pakai konsep contoh).</Pesan>}
          <div className={`grid gap-4 ${layarXl && tampilBrief ? "grid-cols-[290px_minmax(0,1fr)]" : ""}`}>
            {layarXl && tampilBrief && (
              <aside id={`${id}-brief`} className="sticky top-4 max-h-[calc(100vh-2rem)] self-start overflow-y-auto">
                {brief}
              </aside>
            )}
            <div className="min-w-0 space-y-4">
              {layarMd ? (
                <TabelKonten data={data} saring={saring} onUbah={ubah} onTambah={semua ? null : tambah} onHapus={setHapus} />
              ) : (
                <KartuKonten data={data} saring={saring} onUbah={ubah} onTambah={semua ? null : tambah} onHapus={setHapus} />
              )}
              <LegendaKonten data={data} />
            </div>
          </div>
        </>
      )}

      {!layarXl && laciBrief && data && (
        <Laci id={`${id}-brief`} judul={terpilih ? `Catatan & brief — ${terpilih.nama}` : "Catatan & brief"} onClose={() => setLaciBrief(false)}>
          {brief}
        </Laci>
      )}
      {buat && data && terpilih && (
        <DialogBuatBulan
          data={data}
          platform={terpilih}
          bulanAwal={geserBulan(bulan, data.baris.length ? 1 : 0)}
          onClose={() => setBuat(false)}
          onTersimpan={(b, n) => {
            setBuat(false);
            pesan(`${n} baris usulan dibuat untuk ${terpilih.nama}, ${namaBulan(b)}.`);
            if (b === bulan) muat();
            else setBulan(b);
          }}
        />
      )}
      {setelan && data && <SetelanKonten data={data} onClose={() => setSetelan(false)} onUbah={muat} />}
      {kelola && data && (
        <DialogPlatform
          platform={data.platform}
          onClose={() => setKelola(false)}
          onUbah={(daftar) => {
            // Platform yang sedang dibuka terhapus → kembali ke platform bawaan server.
            if (typeof platform === "number" && !daftar.some((p) => p.id === platform)) setPlatform(null);
            else muat();
          }}
        />
      )}
      {hapus && (
        <Modal title="Hapus baris jadwal?" onClose={() => setHapus(null)}>
          <p className="text-sm text-fg">
            Baris <b>{namaTanggal(hapus.tanggal)}</b>
            {hapus.judul ? ` — "${hapus.judul}"` : ""} akan dihapus beserta isiannya (judul, tautan, caption). Tidak bisa dibatalkan.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={`btn-ghost h-11 px-4 text-sm ${FOKUS}`} onClick={() => setHapus(null)}>
              Batal
            </button>
            <button type="button" className={`btn-primary h-11 px-4 text-sm ${FOKUS}`} style={{ background: "var(--danger)" }} disabled={busy} aria-busy={busy} onClick={hapusYa}>
              {busy ? "Menghapus…" : "Ya, hapus"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
