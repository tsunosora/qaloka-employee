"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { api } from "@/lib/fetcher";
import { Modal } from "@/components/ui/Modal";
import { Pesan } from "@/components/magang/ui";
import { IconPlus, IconTrash, IconX } from "@/components/ui/icons";
import { KUNCI_WARNA, WARNA_KONTEN, labelKonsep, tautanSah, type KunciWarna } from "@/lib/services/magang/konten";
import { FOKUS, titikWarna, type AnakJson, type DataKonten, type GrupJson, type KonsepJson, type StatusJson } from "@/components/magang/konten/tipe";

/**
 * Dialog "Setelan jadwal konten" untuk pembina: konsep, status, grup, kode anak, dan pola hari.
 * Tiap baris punya formulir sendiri (Simpan per baris); sesudah simpan berhasil → onUbah() (muat ulang).
 */

type Jalankan = (kunci: string, fn: () => Promise<unknown>, pesan: string) => Promise<boolean>;
type Ctx = { jalan: Jalankan; sibuk: string | null };
type Referensi = { label: string; url: string };

const TAB = [
  { id: "konsep", label: "Konsep" },
  { id: "status", label: "Status" },
  { id: "grup", label: "Grup" },
  { id: "kode", label: "Kode anak" },
  { id: "pola", label: "Pola hari" },
] as const;
type IdTab = (typeof TAB)[number]["id"];

const HARI = [
  { d: 1, nama: "Senin" },
  { d: 2, nama: "Selasa" },
  { d: 3, nama: "Rabu" },
  { d: 4, nama: "Kamis" },
  { d: 5, nama: "Jumat" },
  { d: 6, nama: "Sabtu" },
] as const;

const MAKS_REF = 10;
const MAKS_ANGGOTA = 30;
const kirim = (url: string, method: string, body?: unknown) =>
  api(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export function SetelanKonten({ data, onClose, onUbah }: { data: DataKonten; onClose: () => void; onUbah: () => void }) {
  const [tab, setTab] = useState<IdTab>("konsep");
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [galat, setGalat] = useState("");
  const dasar = useId();

  const jalan: Jalankan = async (kunci, fn, pesan) => {
    setSibuk(kunci);
    setGalat("");
    setNotice("");
    try {
      await fn();
      onUbah();
      setNotice(pesan);
      return true;
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
      return false;
    } finally {
      setSibuk(null);
    }
  };
  const ctx: Ctx = { jalan, sibuk };

  function pindahTab(id: IdTab) {
    setTab(id);
    setNotice("");
    setGalat("");
  }
  function tombolTab(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = TAB.length;
    const ke = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (ke < 0) return;
    e.preventDefault();
    pindahTab(TAB[ke].id);
    document.getElementById(`${dasar}-tab-${TAB[ke].id}`)?.focus();
  }

  return (
    <Modal title="Setelan jadwal konten" size="xl" onClose={onClose}>
      <div className="space-y-4">
        <div role="tablist" aria-label="Bagian setelan" className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
          {TAB.map((t, i) => {
            const aktif = tab === t.id;
            return (
              <button
                key={t.id}
                id={`${dasar}-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={aktif}
                aria-controls={`${dasar}-panel`}
                tabIndex={aktif ? 0 : -1}
                onClick={() => pindahTab(t.id)}
                onKeyDown={(e) => tombolTab(e, i)}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition ${FOKUS} ${
                  aktif ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div aria-live="polite" className={`space-y-2 ${notice || galat ? "sticky top-0 z-10 -mx-1 rounded-xl bg-bg p-1 shadow-sm" : ""}`}>
          {notice && (
            <div role="status">
              <Pesan jenis="ok">{notice}</Pesan>
            </div>
          )}
          {galat && (
            <div role="alert">
              <Pesan jenis="galat">{galat}</Pesan>
            </div>
          )}
        </div>

        <div id={`${dasar}-panel`} role="tabpanel" aria-labelledby={`${dasar}-tab-${tab}`}>
          {tab === "konsep" && <TabKonsep data={data} ctx={ctx} />}
          {tab === "status" && <TabStatus data={data} ctx={ctx} />}
          {tab === "grup" && <TabGrup data={data} ctx={ctx} />}
          {tab === "kode" && <TabKode data={data} ctx={ctx} />}
          {tab === "pola" && <TabPola data={data} ctx={ctx} />}
        </div>
      </div>
    </Modal>
  );
}

// ── Pembantu ──────────────────────────────────────────────────────────────────────────────────

/**
 * Draf formulir yang mengikuti data server: bila nilai dari server berubah (sesudah muat ulang), draf
 * disetel ulang; baris lain yang sedang disunting tidak ikut terhapus karena nilainya tidak berubah.
 */
function useDraf<T>(asal: T): [T, (t: T) => void, boolean] {
  const kunci = JSON.stringify(asal);
  const [dari, setDari] = useState(kunci);
  const [draf, setDraf] = useState(asal);
  if (dari !== kunci) {
    setDari(kunci);
    setDraf(asal);
  }
  return [draf, setDraf, JSON.stringify(draf) !== kunci];
}

const angka = (v: string, min: number, maks: number) => Math.max(min, Math.min(maks, Math.trunc(Number(v)) || min));
const namaWarna = (w: string) => (WARNA_KONTEN as Record<string, { label: string }>)[w]?.label ?? "Warna khusus";
const labelAnak = (a: AnakJson) => `${a.kode ?? "–"} · ${a.panggilan}`;

function Bidang({ label, bantuan, children, className = "" }: { label: string; bantuan?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold text-fg">{label}</span>
      {bantuan && <span className="text-xs text-muted"> ({bantuan})</span>}
      {children}
    </label>
  );
}

function Centang({
  label,
  checked,
  onChange,
  disabled,
  bantuan,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  bantuan?: string;
}) {
  const id = useId();
  return (
    <div>
      <label className={`flex min-h-11 items-center gap-2 text-sm text-fg ${disabled ? "opacity-60" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={checked}
          disabled={disabled}
          aria-describedby={bantuan ? id : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      {bantuan && (
        <p id={id} className="-mt-1 text-xs text-muted">
          {bantuan}
        </p>
      )}
    </div>
  );
}

function InputUrutan({ nilai, onUbah }: { nilai: number; onUbah: (n: number) => void }) {
  return (
    <Bidang label="Urutan">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={999}
        className="input mt-1.5 h-11"
        value={nilai}
        onChange={(e) => onUbah(angka(e.target.value, 0, 999))}
      />
    </Bidang>
  );
}

/** Pilihan warna palet: tombol bulat ala radio (panah kiri/kanan untuk berpindah), nama warna tertulis. */
function PilihWarna({ nilai, onPilih, label = "Warna" }: { nilai: string; onPilih: (w: KunciWarna) => void; label?: string }) {
  const id = useId();
  const idx = KUNCI_WARNA.indexOf(nilai as KunciWarna);
  function tombol(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = KUNCI_WARNA.length;
    const ke =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % n
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (ke < 0) return;
    e.preventDefault();
    onPilih(KUNCI_WARNA[ke]);
    (e.currentTarget.parentElement?.children[ke] as HTMLElement | undefined)?.focus();
  }
  return (
    <div>
      <span id={id} className="text-sm font-semibold text-fg">
        {label}
      </span>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1">
          {KUNCI_WARNA.map((k, i) => {
            const pilih = k === nilai;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={pilih}
                aria-label={WARNA_KONTEN[k].label}
                title={WARNA_KONTEN[k].label}
                tabIndex={(idx < 0 ? i === 0 : pilih) ? 0 : -1}
                onClick={() => onPilih(k)}
                onKeyDown={(e) => tombol(e, i)}
                className={`grid h-10 w-10 place-items-center rounded-lg border-2 transition ${FOKUS} ${
                  pilih ? "border-fg bg-surface-2" : "border-transparent hover:bg-surface-2"
                }`}
              >
                <span aria-hidden="true" className="h-6 w-6 rounded-full" style={titikWarna(k)} />
              </button>
            );
          })}
        </div>
        <span className="text-sm text-muted">
          Terpilih: <b className="text-fg">{namaWarna(nilai)}</b>
        </span>
      </div>
    </div>
  );
}

/** Hapus dua langkah: "Hapus" → "Hapus …? Ya, hapus / Batal" (tanpa window.confirm). */
function HapusDuaLangkah({ nama, jenis, kunci, ctx, onHapus }: { nama: string; jenis: string; kunci: string; ctx: Ctx; onHapus: () => Promise<boolean> }) {
  const [tanya, setTanya] = useState(false);
  const batal = useRef<HTMLButtonElement>(null);
  const awal = useRef<HTMLButtonElement>(null);
  const pernahTanya = useRef(false);
  useEffect(() => {
    if (tanya) {
      pernahTanya.current = true;
      batal.current?.focus();
    } else if (pernahTanya.current) {
      awal.current?.focus();
    }
  }, [tanya]);

  if (!tanya)
    return (
      <button
        ref={awal}
        type="button"
        className="btn-ghost h-11 px-3 text-sm text-danger"
        aria-label={`Hapus ${jenis} ${nama}`}
        disabled={ctx.sibuk !== null}
        onClick={() => setTanya(true)}
      >
        <IconTrash aria-hidden="true" /> Hapus
      </button>
    );
  return (
    <div role="group" aria-label={`Konfirmasi hapus ${jenis} ${nama}`} className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-fg">Hapus “{nama}”?</span>
      <button
        type="button"
        className="btn-ghost h-11 px-3 text-sm text-danger"
        disabled={ctx.sibuk !== null}
        onClick={async () => {
          const ok = await onHapus();
          if (!ok) setTanya(false);
        }}
      >
        {ctx.sibuk === kunci ? "Menghapus…" : "Ya, hapus"}
      </button>
      <button ref={batal} type="button" className="btn-ghost h-11 px-3 text-sm" disabled={ctx.sibuk === kunci} onClick={() => setTanya(false)}>
        Batal
      </button>
    </div>
  );
}

function TombolSimpan({ kunci, ctx, bisa, label = "Simpan" }: { kunci: string; ctx: Ctx; bisa: boolean; label?: string }) {
  return (
    <button type="submit" className="btn-primary h-11 text-sm" disabled={ctx.sibuk !== null || !bisa}>
      {ctx.sibuk === kunci ? "Menyimpan…" : label}
    </button>
  );
}

function Kartu({ aktif = true, children }: { aktif?: boolean; children: ReactNode }) {
  return <li className={`rounded-xl border border-border p-3 ${aktif ? "" : "bg-surface-2"}`}>{children}</li>;
}

function JudulBaris({ warna, judul, aktif, ekstra }: { warna: string; judul: string; aktif: boolean; ekstra?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
      <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full" style={titikWarna(warna)} />
      {judul}
      {!aktif && <span className="text-xs font-normal text-subtle">(nonaktif)</span>}
      {ekstra}
    </p>
  );
}

function Kosong({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-2 p-4 text-sm text-subtle">{children}</p>;
}

// ── Konsep ────────────────────────────────────────────────────────────────────────────────────

function EditorReferensi({ nilai, onUbah }: { nilai: Referensi[]; onUbah: (r: Referensi[]) => void }) {
  const id = useId();
  const ubah = (i: number, x: Partial<Referensi>) => onUbah(nilai.map((r, j) => (j === i ? { ...r, ...x } : r)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-fg">
        Contoh / referensi <span className="text-xs font-normal text-muted">(boleh kosong, maks. {MAKS_REF})</span>
      </legend>
      {nilai.map((r, i) => {
        const salah = r.url.trim() !== "" && !tautanSah(r.url);
        return (
          <div key={i} className="grid items-start gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <Bidang label={`Label tautan ${i + 1}`}>
              <input className="input mt-1.5 h-11" value={r.label} maxLength={80} placeholder="mis. Contoh 1" onChange={(e) => ubah(i, { label: e.target.value })} />
            </Bidang>
            <div>
              <label className="block">
                <span className="text-sm font-semibold text-fg">Tautan {i + 1}</span>
                <input
                  className="input mt-1.5 h-11"
                  inputMode="url"
                  value={r.url}
                  maxLength={500}
                  placeholder="https://…"
                  aria-invalid={salah}
                  aria-describedby={salah ? `${id}-${i}` : undefined}
                  onChange={(e) => ubah(i, { url: e.target.value })}
                />
              </label>
              {salah && (
                <p id={`${id}-${i}`} className="mt-1 text-xs text-danger">
                  Tautan harus diawali http:// atau https://
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-ghost h-11 w-11 justify-center self-end p-0"
              aria-label={`Hapus tautan ${i + 1}`}
              onClick={() => onUbah(nilai.filter((_, j) => j !== i))}
            >
              <IconX aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <button type="button" className="btn-ghost h-11 text-sm" disabled={nilai.length >= MAKS_REF} onClick={() => onUbah([...nilai, { label: "", url: "" }])}>
        <IconPlus className="text-[16px]" aria-hidden="true" /> Tambah tautan
      </button>
    </fieldset>
  );
}

const refSah = (r: Referensi[]) => r.every((x) => x.url.trim() === "" || tautanSah(x.url));
const refBersih = (r: Referensi[]) => r.map((x) => ({ label: x.label.trim(), url: x.url.trim() })).filter((x) => x.url || x.label);

function TabKonsep({ data, ctx }: { data: DataKonten; ctx: Ctx }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Konsep = jenis konten (mis. SITKOM, TALK). Warnanya dipakai di sel jadwal. Konsep <b className="text-fg">nonaktif</b> tidak muncul di pilihan baru, tapi
        baris lama tetap tersimpan.
      </p>
      {data.konsep.length === 0 ? (
        <div className="space-y-3 rounded-xl bg-surface-2 p-4">
          <p className="text-sm text-muted">Belum ada konsep. Pakai 4 konsep contoh lalu sesuaikan, atau tambahkan sendiri di bawah.</p>
          <button
            type="button"
            className="btn-primary h-11 text-sm"
            disabled={ctx.sibuk !== null}
            onClick={() => ctx.jalan("konsep-contoh", () => kirim("/api/magang/konten/konsep/contoh", "POST"), "Konsep contoh dipasang.")}
          >
            {ctx.sibuk === "konsep-contoh" ? "Menyimpan…" : "Pakai konsep contoh"}
          </button>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Daftar konsep">
          {data.konsep.map((k) => (
            <BarisKonsep key={k.id} k={k} ctx={ctx} />
          ))}
        </ul>
      )}
      <KonsepBaru ctx={ctx} />
    </div>
  );
}

function BarisKonsep({ k, ctx }: { k: KonsepJson; ctx: Ctx }) {
  const [d, setD, berubah] = useDraf({
    nama: k.nama,
    sub: k.sub ?? "",
    warna: k.warna as string,
    urutan: k.urutan,
    aktif: k.aktif,
    referensi: k.referensi as Referensi[],
  });
  const kunci = `konsep-${k.id}`;
  const bisa = berubah && d.nama.trim().length >= 2 && refSah(d.referensi);
  return (
    <Kartu aktif={k.aktif}>
      <form
        className="space-y-3"
        aria-label={`Konsep ${labelKonsep(k)}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!bisa || ctx.sibuk) return;
          ctx.jalan(
            kunci,
            () => kirim(`/api/magang/konten/konsep/${k.id}`, "PATCH", { ...d, nama: d.nama.trim(), sub: d.sub.trim() || null, referensi: refBersih(d.referensi) }),
            `Konsep "${d.nama.trim()}" tersimpan.`
          );
        }}
      >
        <JudulBaris warna={k.warna} judul={labelKonsep(k)} aktif={k.aktif} ekstra={<span className="text-xs font-normal text-subtle">kunci: {k.kunci}</span>} />
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
          <Bidang label="Nama konsep">
            <input className="input mt-1.5 h-11" value={d.nama} maxLength={60} required onChange={(e) => setD({ ...d, nama: e.target.value })} />
          </Bidang>
          <Bidang label="Sub" bantuan="boleh kosong">
            <input className="input mt-1.5 h-11" value={d.sub} maxLength={60} placeholder="mis. SITKOM" onChange={(e) => setD({ ...d, sub: e.target.value })} />
          </Bidang>
          <InputUrutan nilai={d.urutan} onUbah={(urutan) => setD({ ...d, urutan })} />
        </div>
        <PilihWarna nilai={d.warna} onPilih={(warna) => setD({ ...d, warna })} />
        <Centang label="Aktif" checked={d.aktif} onChange={(aktif) => setD({ ...d, aktif })} />
        <EditorReferensi nilai={d.referensi} onUbah={(referensi) => setD({ ...d, referensi })} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <HapusDuaLangkah
            nama={labelKonsep(k)}
            jenis="konsep"
            kunci={`${kunci}-hapus`}
            ctx={ctx}
            onHapus={() => ctx.jalan(`${kunci}-hapus`, () => kirim(`/api/magang/konten/konsep/${k.id}`, "DELETE"), `Konsep "${labelKonsep(k)}" dihapus.`)}
          />
          <TombolSimpan kunci={kunci} ctx={ctx} bisa={bisa} />
        </div>
      </form>
    </Kartu>
  );
}

const KONSEP_KOSONG = { nama: "", sub: "", warna: "putih" as string, referensi: [] as Referensi[] };

function KonsepBaru({ ctx }: { ctx: Ctx }) {
  const [d, setD] = useState(KONSEP_KOSONG);
  const bisa = d.nama.trim().length >= 2 && refSah(d.referensi);
  return (
    <form
      className="space-y-3 rounded-xl border border-dashed border-border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!bisa || ctx.sibuk) return;
        const ok = await ctx.jalan(
          "konsep-baru",
          () =>
            kirim("/api/magang/konten/konsep", "POST", { nama: d.nama.trim(), sub: d.sub.trim() || null, warna: d.warna, referensi: refBersih(d.referensi), aktif: true }),
          `Konsep "${d.nama.trim()}" ditambahkan.`
        );
        if (ok) setD(KONSEP_KOSONG);
      }}
    >
      <h3 className="text-sm font-bold text-fg">Tambah konsep</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Bidang label="Nama konsep">
          <input className="input mt-1.5 h-11" value={d.nama} maxLength={60} placeholder="mis. ENTERTAINMENT" onChange={(e) => setD({ ...d, nama: e.target.value })} />
        </Bidang>
        <Bidang label="Sub" bantuan="boleh kosong">
          <input className="input mt-1.5 h-11" value={d.sub} maxLength={60} placeholder="mis. SITKOM" onChange={(e) => setD({ ...d, sub: e.target.value })} />
        </Bidang>
      </div>
      <PilihWarna nilai={d.warna} onPilih={(warna) => setD({ ...d, warna })} />
      <EditorReferensi nilai={d.referensi} onUbah={(referensi) => setD({ ...d, referensi })} />
      <div className="flex justify-end">
        <TombolSimpan kunci="konsep-baru" ctx={ctx} bisa={bisa} label="Tambah konsep" />
      </div>
    </form>
  );
}

// ── Status ────────────────────────────────────────────────────────────────────────────────────

const BANTU_FINAL = "Status final hanya bisa dipasang pembina & dihitung selesai";

function TabStatus({ data, ctx }: { data: DataKonten; ctx: Ctx }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Status = tahap pengerjaan konten. Centang <b className="text-fg">Anak boleh pilih</b> agar anak bisa memasangnya dari HP.
      </p>
      {data.status.length === 0 ? (
        <Kosong>Belum ada status. Tambahkan di bawah.</Kosong>
      ) : (
        <ul className="space-y-2" aria-label="Daftar status">
          {data.status.map((s) => (
            <BarisStatus key={s.id} s={s} ctx={ctx} />
          ))}
        </ul>
      )}
      <StatusBaru ctx={ctx} />
    </div>
  );
}

function IsianFlagStatus({ d, setD }: { d: { anakBoleh: boolean; final: boolean }; setD: (x: { anakBoleh: boolean; final: boolean }) => void }) {
  return (
    <div className="flex flex-wrap gap-x-6">
      <Centang label="Final (selesai)" checked={d.final} onChange={(final) => setD({ final, anakBoleh: final ? false : d.anakBoleh })} />
      <Centang
        label="Anak boleh pilih"
        checked={d.anakBoleh && !d.final}
        disabled={d.final}
        bantuan={d.final ? BANTU_FINAL : undefined}
        onChange={(anakBoleh) => setD({ ...d, anakBoleh })}
      />
    </div>
  );
}

function BarisStatus({ s, ctx }: { s: StatusJson; ctx: Ctx }) {
  const [d, setD, berubah] = useDraf({ nama: s.nama, warna: s.warna as string, urutan: s.urutan, aktif: s.aktif, anakBoleh: s.anakBoleh, final: s.final });
  const kunci = `status-${s.id}`;
  const bisa = berubah && d.nama.trim().length >= 2;
  return (
    <Kartu aktif={s.aktif}>
      <form
        className="space-y-3"
        aria-label={`Status ${s.nama}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!bisa || ctx.sibuk) return;
          ctx.jalan(kunci, () => kirim(`/api/magang/konten/status/${s.id}`, "PATCH", { ...d, nama: d.nama.trim() }), `Status "${d.nama.trim()}" tersimpan.`);
        }}
      >
        <JudulBaris warna={s.warna} judul={s.nama} aktif={s.aktif} ekstra={s.final ? <span className="text-xs font-normal text-subtle">final</span> : null} />
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <Bidang label="Nama status">
            <input className="input mt-1.5 h-11" value={d.nama} maxLength={60} required onChange={(e) => setD({ ...d, nama: e.target.value })} />
          </Bidang>
          <InputUrutan nilai={d.urutan} onUbah={(urutan) => setD({ ...d, urutan })} />
        </div>
        <PilihWarna nilai={d.warna} onPilih={(warna) => setD({ ...d, warna })} />
        <div className="flex flex-wrap gap-x-6">
          <Centang label="Aktif" checked={d.aktif} onChange={(aktif) => setD({ ...d, aktif })} />
        </div>
        <IsianFlagStatus d={d} setD={(x) => setD({ ...d, ...x })} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <HapusDuaLangkah
            nama={s.nama}
            jenis="status"
            kunci={`${kunci}-hapus`}
            ctx={ctx}
            onHapus={() => ctx.jalan(`${kunci}-hapus`, () => kirim(`/api/magang/konten/status/${s.id}`, "DELETE"), `Status "${s.nama}" dihapus.`)}
          />
          <TombolSimpan kunci={kunci} ctx={ctx} bisa={bisa} />
        </div>
      </form>
    </Kartu>
  );
}

const STATUS_KOSONG = { nama: "", warna: "abu" as string, anakBoleh: false, final: false };

function StatusBaru({ ctx }: { ctx: Ctx }) {
  const [d, setD] = useState(STATUS_KOSONG);
  const bisa = d.nama.trim().length >= 2;
  return (
    <form
      className="space-y-3 rounded-xl border border-dashed border-border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!bisa || ctx.sibuk) return;
        const ok = await ctx.jalan(
          "status-baru",
          () => kirim("/api/magang/konten/status", "POST", { ...d, nama: d.nama.trim(), aktif: true }),
          `Status "${d.nama.trim()}" ditambahkan.`
        );
        if (ok) setD(STATUS_KOSONG);
      }}
    >
      <h3 className="text-sm font-bold text-fg">Tambah status</h3>
      <Bidang label="Nama status">
        <input className="input mt-1.5 h-11" value={d.nama} maxLength={60} placeholder="mis. Sudah edit" onChange={(e) => setD({ ...d, nama: e.target.value })} />
      </Bidang>
      <PilihWarna nilai={d.warna} onPilih={(warna) => setD({ ...d, warna })} />
      <IsianFlagStatus d={d} setD={(x) => setD({ ...d, ...x })} />
      <div className="flex justify-end">
        <TombolSimpan kunci="status-baru" ctx={ctx} bisa={bisa} label="Tambah status" />
      </div>
    </form>
  );
}

// ── Grup ──────────────────────────────────────────────────────────────────────────────────────

function TabGrup({ data, ctx }: { data: DataKonten; ctx: Ctx }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Grup = beberapa anak yang membuat satu konten bersama di hari grup (lihat tab Pola hari). Giliran grup mengikuti urutan di sini.
      </p>
      {data.grup.length === 0 ? (
        <Kosong>Belum ada grup. Tambahkan di bawah.</Kosong>
      ) : (
        <ul className="space-y-2" aria-label="Daftar grup">
          {data.grup.map((g) => (
            <BarisGrup key={g.id} g={g} anak={data.anak} ctx={ctx} />
          ))}
        </ul>
      )}
      <GrupBaru anak={data.anak} ctx={ctx} />
    </div>
  );
}

function PilihAnggota({ anak, nilai, onUbah }: { anak: AnakJson[]; nilai: number[]; onUbah: (a: number[]) => void }) {
  const tampil = anak.filter((a) => a.aktif || nilai.includes(a.pesertaId));
  const penuh = nilai.length >= MAKS_ANGGOTA;
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-fg">
        Anggota <span className="text-xs font-normal text-muted">({nilai.length} dipilih)</span>
      </legend>
      {tampil.length === 0 ? (
        <p className="mt-1 text-sm text-subtle">Belum ada anak magang aktif.</p>
      ) : (
        <div className="mt-1 grid gap-x-3 sm:grid-cols-3">
          {tampil.map((a) => {
            const cek = nilai.includes(a.pesertaId);
            return (
              <Centang
                key={a.pesertaId}
                label={`${labelAnak(a)}${a.aktif ? "" : " (nonaktif)"}`}
                checked={cek}
                disabled={!cek && penuh}
                onChange={(v) => onUbah(v ? [...nilai, a.pesertaId].sort((x, y) => x - y) : nilai.filter((x) => x !== a.pesertaId))}
              />
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function BarisGrup({ g, anak, ctx }: { g: GrupJson; anak: AnakJson[]; ctx: Ctx }) {
  const [d, setD, berubah] = useDraf({ nama: g.nama, warna: g.warna as string, urutan: g.urutan, aktif: g.aktif, anggota: g.anggota });
  const kunci = `grup-${g.id}`;
  const bisa = berubah && d.nama.trim().length >= 1;
  return (
    <Kartu aktif={g.aktif}>
      <form
        className="space-y-3"
        aria-label={`Grup ${g.nama}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!bisa || ctx.sibuk) return;
          ctx.jalan(kunci, () => kirim(`/api/magang/konten/grup/${g.id}`, "PATCH", { ...d, nama: d.nama.trim() }), `Grup "${d.nama.trim()}" tersimpan.`);
        }}
      >
        <JudulBaris warna={g.warna} judul={g.nama} aktif={g.aktif} />
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <Bidang label="Nama grup">
            <input className="input mt-1.5 h-11" value={d.nama} maxLength={60} required onChange={(e) => setD({ ...d, nama: e.target.value })} />
          </Bidang>
          <InputUrutan nilai={d.urutan} onUbah={(urutan) => setD({ ...d, urutan })} />
        </div>
        <PilihWarna nilai={d.warna} onPilih={(warna) => setD({ ...d, warna })} />
        <Centang label="Aktif" checked={d.aktif} onChange={(aktif) => setD({ ...d, aktif })} />
        <PilihAnggota anak={anak} nilai={d.anggota} onUbah={(anggota) => setD({ ...d, anggota })} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <HapusDuaLangkah
            nama={g.nama}
            jenis="grup"
            kunci={`${kunci}-hapus`}
            ctx={ctx}
            onHapus={() => ctx.jalan(`${kunci}-hapus`, () => kirim(`/api/magang/konten/grup/${g.id}`, "DELETE"), `Grup "${g.nama}" dihapus.`)}
          />
          <TombolSimpan kunci={kunci} ctx={ctx} bisa={bisa} />
        </div>
      </form>
    </Kartu>
  );
}

const GRUP_KOSONG = { nama: "", warna: "merah" as string, anggota: [] as number[] };

function GrupBaru({ anak, ctx }: { anak: AnakJson[]; ctx: Ctx }) {
  const [d, setD] = useState(GRUP_KOSONG);
  const bisa = d.nama.trim().length >= 1;
  return (
    <form
      className="space-y-3 rounded-xl border border-dashed border-border p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!bisa || ctx.sibuk) return;
        const ok = await ctx.jalan(
          "grup-baru",
          () => kirim("/api/magang/konten/grup", "POST", { ...d, nama: d.nama.trim(), aktif: true }),
          `Grup "${d.nama.trim()}" ditambahkan.`
        );
        if (ok) setD(GRUP_KOSONG);
      }}
    >
      <h3 className="text-sm font-bold text-fg">Tambah grup</h3>
      <Bidang label="Nama grup">
        <input className="input mt-1.5 h-11" value={d.nama} maxLength={60} placeholder="mis. Grup A" onChange={(e) => setD({ ...d, nama: e.target.value })} />
      </Bidang>
      <PilihWarna nilai={d.warna} onPilih={(warna) => setD({ ...d, warna })} />
      <PilihAnggota anak={anak} nilai={d.anggota} onUbah={(anggota) => setD({ ...d, anggota })} />
      <div className="flex justify-end">
        <TombolSimpan kunci="grup-baru" ctx={ctx} bisa={bisa} label="Tambah grup" />
      </div>
    </form>
  );
}

// ── Kode anak ─────────────────────────────────────────────────────────────────────────────────

function TabKode({ data, ctx }: { data: DataKonten; ctx: Ctx }) {
  const id = useId();
  const tampil = data.anak.filter((a) => a.aktif || a.kode != null);
  const [d, setD, berubah] = useDraf<Record<string, string>>(Object.fromEntries(tampil.map((a) => [String(a.pesertaId), a.kode == null ? "" : String(a.kode)])));

  // Galat per anak: bukan angka 1–99, atau kode yang sama dipakai anak lain di daftar.
  const pemegang = new Map<number, AnakJson[]>();
  for (const a of tampil) {
    const v = (d[a.pesertaId] ?? "").trim();
    if (/^\d+$/.test(v)) pemegang.set(Number(v), [...(pemegang.get(Number(v)) ?? []), a]);
  }
  const galat = new Map<number, string>();
  for (const a of tampil) {
    const v = (d[a.pesertaId] ?? "").trim();
    if (v === "") continue;
    const n = Number(v);
    if (!/^\d+$/.test(v) || n < 1 || n > 99) galat.set(a.pesertaId, "Isi angka 1–99, atau kosongkan.");
    else {
      const lain = (pemegang.get(n) ?? []).filter((x) => x.pesertaId !== a.pesertaId);
      if (lain.length) galat.set(a.pesertaId, `Kode ${n} dipakai juga oleh ${lain.map((x) => x.panggilan).join(", ")}.`);
    }
  }
  const bisa = berubah && galat.size === 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bisa || ctx.sibuk) return;
        const kode = tampil.map((a) => {
          const v = (d[a.pesertaId] ?? "").trim();
          return { pesertaId: a.pesertaId, kode: v === "" ? null : Number(v) };
        });
        ctx.jalan("kode", () => kirim("/api/magang/konten/kode", "PUT", { kode }), "Kode anak tersimpan.");
      }}
    >
      <p className="text-sm text-muted">
        Kode = nomor anak di kolom CODE jadwal (1–99, satu kode untuk satu anak). Kosongkan bila anak belum diberi kode.
      </p>
      {tampil.length === 0 ? (
        <Kosong>Belum ada anak magang aktif.</Kosong>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-ghost h-11 text-sm"
              disabled={ctx.sibuk !== null}
              onClick={() => {
                let n = 0;
                const baru = { ...d };
                for (const a of tampil) if (a.aktif) baru[a.pesertaId] = String(++n);
                setD(baru);
              }}
            >
              Isi berurutan
            </button>
            <span className="text-xs text-muted">Memberi kode 1, 2, 3, … ke anak aktif sesuai urutan daftar. Belum tersimpan sampai Anda menekan Simpan.</span>
          </div>
          <ul className="grid gap-x-4 gap-y-3 sm:grid-cols-2" aria-label="Kode anak">
            {tampil.map((a) => {
              const g = galat.get(a.pesertaId);
              const idInput = `${id}-${a.pesertaId}`;
              return (
                <li key={a.pesertaId}>
                  <label htmlFor={idInput} className="block text-sm font-semibold text-fg">
                    {a.panggilan} <span className="font-normal text-muted">({a.namaLengkap})</span>
                    {!a.aktif && <span className="ml-1 text-xs font-normal text-subtle">nonaktif</span>}
                  </label>
                  <input
                    id={idInput}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    className="input mt-1.5 h-11 w-24"
                    value={d[a.pesertaId] ?? ""}
                    aria-invalid={!!g}
                    aria-describedby={g ? `${idInput}-galat` : undefined}
                    onChange={(e) => setD({ ...d, [a.pesertaId]: e.target.value })}
                  />
                  {g && (
                    <p id={`${idInput}-galat`} className="mt-1 text-xs text-danger">
                      {g}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
            {galat.size > 0 && <span className="text-sm text-danger">Perbaiki kode yang ditandai dulu.</span>}
            <TombolSimpan kunci="kode" ctx={ctx} bisa={bisa} label="Simpan kode" />
          </div>
        </>
      )}
    </form>
  );
}

// ── Pola hari ─────────────────────────────────────────────────────────────────────────────────

type DrafPola = { hari: Record<1 | 2 | 3 | 4 | 5 | 6, string | null>; empathy: string | null; selangHari: number };

function PilihKonsep({ label, nilai, konsep, onUbah }: { label: string; nilai: string | null; konsep: KonsepJson[]; onUbah: (v: string | null) => void }) {
  const pilihan = konsep.filter((k) => k.aktif || k.kunci === nilai);
  const hilang = nilai !== null && !konsep.some((k) => k.kunci === nilai);
  return (
    <Bidang label={label}>
      <select className="input mt-1.5 h-11" value={nilai ?? ""} onChange={(e) => onUbah(e.target.value || null)}>
        <option value="">— Tidak ada —</option>
        {pilihan.map((k) => (
          <option key={k.kunci} value={k.kunci}>
            {labelKonsep(k)}
            {k.aktif ? "" : " (nonaktif)"}
          </option>
        ))}
        {hilang && <option value={nilai}>{nilai} (konsep tidak ditemukan)</option>}
      </select>
    </Bidang>
  );
}

function TabPola({ data, ctx }: { data: DataKonten; ctx: Ctx }) {
  const id = useId();
  const p = data.pola;
  const [d, setD, berubah] = useDraf<DrafPola>({
    hari: { 1: p.hari[1] ?? null, 2: p.hari[2] ?? null, 3: p.hari[3] ?? null, 4: p.hari[4] ?? null, 5: p.hari[5] ?? null, 6: p.hari[6] ?? null },
    empathy: p.empathy,
    selangHari: p.selangHari,
  });
  const selangSah = Number.isInteger(d.selangHari) && d.selangHari >= 7 && d.selangHari <= 56;
  const bisa = berubah && selangSah;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bisa || ctx.sibuk) return;
        ctx.jalan("pola", () => kirim("/api/magang/konten/pola", "PUT", d), "Pola hari tersimpan. Dipakai saat membuat jadwal bulan berikutnya.");
      }}
    >
      <p className="text-sm text-muted">Pola dipakai tombol &quot;Buat jadwal&quot;: konsep apa yang diisi otomatis tiap hari. Minggu selalu libur.</p>
      {data.konsep.length === 0 && <Kosong>Belum ada konsep. Tambahkan dulu di tab Konsep.</Kosong>}
      <fieldset>
        <legend className="text-sm font-bold text-fg">Konsep per hari</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {HARI.map((h) => (
            <PilihKonsep key={h.d} label={h.nama} nilai={d.hari[h.d]} konsep={data.konsep} onUbah={(v) => setD({ ...d, hari: { ...d.hari, [h.d]: v } })} />
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-xl bg-surface-2 p-3">
        <legend className="sr-only">Hari grup</legend>
        <p className="text-sm font-bold text-fg">Hari grup</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PilihKonsep label="Konsep hari grup" nilai={d.empathy} konsep={data.konsep} onUbah={(empathy) => setD({ ...d, empathy })} />
          <div>
            <label className="block" htmlFor={`${id}-selang`}>
              <span className="text-sm font-semibold text-fg">Selang hari</span>
              <span className="text-xs text-muted"> (7–56)</span>
            </label>
            <input
              id={`${id}-selang`}
              type="number"
              inputMode="numeric"
              min={7}
              max={56}
              className="input mt-1.5 h-11 w-28"
              value={Number.isNaN(d.selangHari) ? "" : d.selangHari}
              aria-invalid={!selangSah}
              aria-describedby={`${id}-selang-ket`}
              onChange={(e) => setD({ ...d, selangHari: e.target.value === "" ? NaN : Math.trunc(Number(e.target.value)) })}
            />
            {!selangSah && <p className="mt-1 text-xs text-danger">Isi angka 7 sampai 56.</p>}
          </div>
        </div>
        <p id={`${id}-selang-ket`} className="text-sm text-muted">
          Hari grup: tiap {selangSah ? d.selangHari : "…"} hari pada hari Sabtu, bergiliran sesuai urutan grup.
        </p>
      </fieldset>
      <div className="flex justify-end border-t border-border pt-3">
        <TombolSimpan kunci="pola" ctx={ctx} bisa={bisa} label="Simpan pola" />
      </div>
    </form>
  );
}
