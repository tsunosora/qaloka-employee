"use client";

import { Suspense, useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { IconCheck, IconChevronLeft, IconChevronRight, IconPlus, IconSettings } from "@/components/ui/icons";
import { Judul, Memuat, Pesan } from "@/components/magang/ui";
import { geserBulan, namaBulan, namaTanggal } from "@/lib/services/magang/konten";
import { PanelBrief } from "@/components/magang/konten/PanelBrief";
import { LegendaKonten, TabelKonten, type PatchBaris, type Saringan } from "@/components/magang/konten/TabelKonten";
import { DialogBuatBulan } from "@/components/magang/konten/DialogBuatBulan";
import { SetelanKonten } from "@/components/magang/konten/SetelanKonten";
import { FOKUS, type BarisJson, type DataKonten } from "@/components/magang/konten/tipe";

const MEDIA_LEBAR = "(min-width: 1536px)";
function langgananLebar(ubah: () => void) {
  const m = window.matchMedia(MEDIA_LEBAR);
  m.addEventListener("change", ubah);
  return () => m.removeEventListener("change", ubah);
}

function bulanIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Magang → Jadwal Konten: meniru sheet pembina (panel catatan & brief di kiri, tabel padat di kanan). Sunting
 * sel langsung di tabel (perubahan tampil seketika, dibatalkan bila server menolak).
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
  const awal = useSearchParams().get("bulan");
  const [bulan, setBulan] = useState(() => (awal && /^\d{4}-(0[1-9]|1[0-2])$/.test(awal) ? awal : bulanIni()));
  const [data, setData] = useState<DataKonten | null>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [galat, setGalat] = useState("");
  const [notice, setNotice] = useState("");
  const [saring, setSaring] = useState<Saringan>({ anak: null, grup: null, status: null });
  const [buat, setBuat] = useState(false);
  const [setelan, setSetelan] = useState(false);
  const [hapus, setHapus] = useState<BarisJson | null>(null);
  const [busy, setBusy] = useState(false);
  // Catatan & brief di samping tabel: bawaan tampil di layar lebar (≥1536 px), tersembunyi di layar lebih
  // kecil supaya kolom tabel muat; tombol "Tampilkan/Sembunyikan catatan" menimpa bawaan.
  const layarLebar = useSyncExternalStore(langgananLebar, () => window.matchMedia(MEDIA_LEBAR).matches, () => true);
  const [pilihBrief, setPilihBrief] = useState<boolean | null>(null);
  const tampilBrief = pilihBrief ?? layarLebar;

  const ambil = useCallback((b: string) => api<DataKonten>(`/api/magang/konten?bulan=${b}`), []);
  const muat = useCallback(
    () =>
      ambil(bulan).then(
        (d) => {
          setData(d);
          setGalatMuat("");
        },
        (e: unknown) => setGalatMuat(e instanceof Error ? e.message : "Gagal memuat jadwal.")
      ),
    [ambil, bulan]
  );
  useEffect(() => {
    let hidup = true;
    ambil(bulan).then(
      (d) => {
        if (!hidup) return;
        setData(d);
        setGalatMuat("");
      },
      (e: unknown) => hidup && setGalatMuat(e instanceof Error ? e.message : "Gagal memuat jadwal.")
    );
    window.history.replaceState(null, "", `?bulan=${bulan}`);
    return () => {
      hidup = false;
    };
  }, [ambil, bulan]);

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
    setData((d) => (d ? { ...d, baris: d.baris.map((x) => (x.id === b.id ? { ...x, ...patch } : x)) } : d));
    try {
      const baru = await api<BarisJson>(`/api/magang/konten/${b.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setData((d) => (d ? { ...d, baris: d.baris.map((x) => (x.id === b.id ? baru : x)) } : d));
      if (patch.usulan === false) pesan(`Usulan ${namaTanggal(b.tanggal)} disetujui.`);
      else if (patch.statusId && status?.final) pesan(`${namaTanggal(b.tanggal)} ditandai ${status.nama}.`);
      else setGalat("");
    } catch (e) {
      setData((d) => (d ? { ...d, baris: d.baris.map((x) => (x.id === b.id ? b : x)) } : d));
      gagal(e, "Gagal menyimpan perubahan.");
    }
  }

  async function tambah(tanggal: string) {
    if (!data) return;
    const hari = new Date(`${tanggal}T00:00:00`).getDay() as 1 | 2 | 3 | 4 | 5 | 6;
    const kunci = data.pola.hari[hari];
    const konsep = data.konsep.find((k) => k.aktif && k.kunci === kunci) ?? data.konsep.find((k) => k.aktif);
    if (!konsep) return gagal(null, "Belum ada konsep aktif. Tambahkan dulu di Setelan → Konsep.");
    try {
      const baru = await api<BarisJson>("/api/magang/konten", { method: "POST", body: JSON.stringify({ tanggal, konsepId: konsep.id }) });
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
      const r = await api<{ disetujui: number }>("/api/magang/konten/setujui", { method: "POST", body: JSON.stringify({ bulan }) });
      pesan(`${r.disetujui} usulan disetujui.`);
      await muat();
    } catch (e) {
      gagal(e, "Gagal menyetujui usulan.");
    } finally {
      setBusy(false);
    }
  }

  const jumlahUsulan = data?.baris.filter((b) => b.usulan).length ?? 0;
  const final = new Set(data?.status.filter((s) => s.final).map((s) => s.id));
  const selesai = data?.baris.filter((b) => final.has(b.statusId)).length ?? 0;
  const pilihSaring = (k: keyof Saringan, v: string) => setSaring((s) => ({ ...s, [k]: v ? Number(v) : null }));

  return (
    <div className="space-y-4">
      <Judul
        judul="Jadwal Konten"
        keterangan="Jadwal konten harian anak magang seperti sheet pembina. Klik sel untuk mengubah; anak mengisi judul, tautan, dan statusnya dari HP."
        aksi={
          <>
            <button type="button" className={`btn-ghost h-10 px-3 text-sm ${FOKUS}`} onClick={() => setSetelan(true)} disabled={!data}>
              <IconSettings className="text-[16px]" aria-hidden="true" /> Setelan
            </button>
            <button type="button" className={`btn-primary h-10 px-4 text-sm ${FOKUS}`} onClick={() => setBuat(true)} disabled={!data}>
              <IconPlus className="text-[16px]" aria-hidden="true" /> Buat jadwal bulan berikut
            </button>
          </>
        }
      />

      <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-3">
        <div className="flex items-end gap-1">
          <button type="button" className={`btn-ghost h-10 w-10 px-0 ${FOKUS}`} aria-label="Bulan sebelumnya" onClick={() => setBulan(geserBulan(bulan, -1))}>
            <IconChevronLeft className="text-[16px]" aria-hidden="true" />
          </button>
          <div>
            <label htmlFor={`${id}-bln`} className="block text-xs font-semibold text-muted">
              Bulan
            </label>
            <input id={`${id}-bln`} type="month" className="input mt-1 h-10 w-44" value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
          </div>
          <button type="button" className={`btn-ghost h-10 w-10 px-0 ${FOKUS}`} aria-label="Bulan berikutnya" onClick={() => setBulan(geserBulan(bulan, 1))}>
            <IconChevronRight className="text-[16px]" aria-hidden="true" />
          </button>
        </div>
        {data && (
          <>
            <div>
              <label htmlFor={`${id}-sa`} className="block text-xs font-semibold text-muted">
                Anak
              </label>
              <select id={`${id}-sa`} className="input mt-1 h-10 w-44" value={saring.anak ?? ""} onChange={(e) => pilihSaring("anak", e.target.value)}>
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
            <div>
              <label htmlFor={`${id}-sg`} className="block text-xs font-semibold text-muted">
                Grup
              </label>
              <select id={`${id}-sg`} className="input mt-1 h-10 w-36" value={saring.grup ?? ""} onChange={(e) => pilihSaring("grup", e.target.value)}>
                <option value="">Semua grup</option>
                {data.grup.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-ss`} className="block text-xs font-semibold text-muted">
                Status
              </label>
              <select id={`${id}-ss`} className="input mt-1 h-10 w-44" value={saring.status ?? ""} onChange={(e) => pilihSaring("status", e.target.value)}>
                <option value="">Semua status</option>
                {data.status.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </div>
            <p className="ml-auto self-center text-xs text-muted" aria-live="polite">
              {namaBulan(bulan)}: <b className="text-fg">{data.baris.length}</b> konten · <b className="text-fg">{selesai}</b> selesai
              {jumlahUsulan > 0 && (
                <>
                  {" "}
                  · <b className="text-warning">{jumlahUsulan}</b> usulan
                </>
              )}
            </p>
            <button type="button" className={`btn-ghost h-10 px-3 text-sm ${FOKUS}`} aria-expanded={tampilBrief} aria-controls={`${id}-brief`} onClick={() => setPilihBrief(!tampilBrief)}>
              {tampilBrief ? "Sembunyikan catatan" : "Tampilkan catatan"}
            </button>
            {jumlahUsulan > 0 && (
              <button type="button" className={`btn-ghost h-10 px-3 text-sm ${FOKUS}`} disabled={busy} onClick={setujuiSemua}>
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
          <button type="button" className={`btn-ghost h-10 px-4 text-sm ${FOKUS}`} onClick={muat}>
            Coba lagi
          </button>
        </div>
      ) : !data ? (
        <Memuat baris={2} tinggi="h-64" />
      ) : (
        <>
          {data.konsep.length === 0 && (
            <Pesan jenis="galat">Belum ada klasifikasi konsep. Buka Setelan → Konsep untuk menambah (atau pakai konsep contoh).</Pesan>
          )}
          <div className={`grid gap-4 ${tampilBrief ? "xl:grid-cols-[290px_minmax(0,1fr)]" : ""}`}>
            {tampilBrief && (
              <aside id={`${id}-brief`} className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
                <PanelBrief key={JSON.stringify(data.brief)} brief={data.brief} konsep={data.konsep} onTersimpan={muat} />
              </aside>
            )}
            <div className="min-w-0 space-y-4">
              <TabelKonten data={data} saring={saring} onUbah={ubah} onTambah={tambah} onHapus={setHapus} />
              <LegendaKonten data={data} />
            </div>
          </div>
        </>
      )}

      {buat && data && (
        <DialogBuatBulan
          data={data}
          bulanAwal={geserBulan(bulan, data.baris.length ? 1 : 0)}
          onClose={() => setBuat(false)}
          onTersimpan={(b, n) => {
            setBuat(false);
            pesan(`${n} baris usulan dibuat untuk ${namaBulan(b)}.`);
            if (b === bulan) muat();
            else setBulan(b);
          }}
        />
      )}
      {setelan && data && <SetelanKonten data={data} onClose={() => setSetelan(false)} onUbah={muat} />}
      {hapus && (
        <Modal title="Hapus baris jadwal?" onClose={() => setHapus(null)}>
          <p className="text-sm text-fg">
            Baris <b>{namaTanggal(hapus.tanggal)}</b>
            {hapus.judul ? ` — "${hapus.judul}"` : ""} akan dihapus beserta isiannya (judul, tautan, caption). Tidak bisa dibatalkan.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className={`btn-ghost h-10 px-4 text-sm ${FOKUS}`} onClick={() => setHapus(null)}>
              Batal
            </button>
            <button type="button" className={`btn-primary h-10 px-4 text-sm ${FOKUS}`} style={{ background: "var(--danger)" }} disabled={busy} aria-busy={busy} onClick={hapusYa}>
              {busy ? "Menghapus…" : "Ya, hapus"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
