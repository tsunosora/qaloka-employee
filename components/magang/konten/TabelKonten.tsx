"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown, IconPencil, IconPlus, IconTrash } from "@/components/ui/icons";
import { hexWarna, namaTanggal, susunPekan, tautanSah, warnaSelKode } from "@/lib/services/magang/konten";
import { ChipTautan } from "@/components/magang/konten/PanelBrief";
import { FOKUS, latarWarna, titikWarna, type BarisJson, type DataKonten } from "@/components/magang/konten/tipe";

export type PatchBaris = Partial<Pick<BarisJson, "konsepId" | "pesertaId" | "grupId" | "statusId" | "judul" | "ref" | "caption" | "linkFootage" | "linkEkspor" | "usulan">>;
export type Saringan = { anak: number | null; grup: number | null; status: number | null };

type Opsi = { nilai: string; label: string; warna?: string | null; keterangan?: string; nonaktif?: boolean };

const latarHex = (hex: string | null, persen = 42): CSSProperties | undefined => (hex ? { background: `color-mix(in oklab, ${hex} ${persen}%, transparent)` } : undefined);
const LEBAR = [44, 162, 170, 150, 96, 176, 76, 110, 180, 124, 124, 104];
/** Kolom NO & TANGGAL tetap terlihat saat tabel digulir ke samping. */
const LEKAT_NO = "sticky left-0 z-[1]";
const LEKAT_TGL = "sticky left-[44px] z-[1] shadow-[1px_0_0_var(--border)]";
const LATAR_LEKAT: CSSProperties = { background: "var(--solid)" };
const KOLOM = ["NO", "TANGGAL", "JUDUL POSTINGAN", "KLASIFIKASI KONSEP", "REF", "STATUS", "CODE", "NAMA PKL", "CAPTION", "LINK FOLDER FOOTAGE", "LINK EKSPOR KONTEN", "AKSI"];

// ── Pilihan (listbox buatan sendiri — dropdown bawaan peramban tidak bisa diberi warna & tidak terpotret) ──

function Pilihan({ label, nilai, opsi, onPilih, children, style, idAwal }: { label: string; nilai: string; opsi: Opsi[]; onPilih: (v: string) => void; children: ReactNode; style?: CSSProperties; idAwal?: string }) {
  const id = useId();
  const tombol = useRef<HTMLButtonElement>(null);
  const daftar = useRef<HTMLUListElement>(null);
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; minWidth: number; maxHeight: number } | null>(null);
  const bisa = opsi.map((o, i) => (o.nonaktif ? -1 : i)).filter((i) => i >= 0);

  // Posisi tetap (fixed) dari kotak tombol — tidak terpotong wadah tabel yang bergulir. Saat halaman/tabel
  // digulir posisinya dihitung ulang; tombol keluar layar → daftar ditutup.
  const hitung = useCallback(() => {
    const t = tombol.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return setBuka(false);
    const bawah = window.innerHeight - r.bottom - 8;
    const atas = r.top - 8;
    const perlu = Math.min(320, opsi.length * 40 + 8);
    const keBawah = bawah >= perlu || bawah >= atas;
    const tinggi = Math.min(320, keBawah ? bawah : atas);
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 268)), top: keBawah ? r.bottom + 4 : r.top - 4 - Math.min(tinggi, perlu), minWidth: Math.max(r.width, 220), maxHeight: tinggi });
  }, [opsi.length]);

  useLayoutEffect(() => {
    if (buka) hitung();
  }, [buka, hitung]);

  const terpasang = pos !== null;
  useEffect(() => {
    if (buka && terpasang) daftar.current?.focus({ preventScroll: true });
  }, [buka, terpasang]);

  useEffect(() => {
    if (!buka) return;
    const klik = (e: Event) => {
      if (daftar.current?.contains(e.target as Node) || tombol.current?.contains(e.target as Node)) return;
      setBuka(false);
    };
    const gulir = (e: Event) => {
      if (daftar.current?.contains(e.target as Node)) return;
      hitung();
    };
    window.addEventListener("mousedown", klik);
    window.addEventListener("scroll", gulir, true);
    window.addEventListener("resize", hitung);
    return () => {
      window.removeEventListener("mousedown", klik);
      window.removeEventListener("scroll", gulir, true);
      window.removeEventListener("resize", hitung);
    };
  }, [buka, hitung]);

  useEffect(() => {
    if (buka) document.getElementById(`${id}-o${aktif}`)?.scrollIntoView({ block: "nearest" });
  }, [aktif, buka, id]);

  function bukaDaftar() {
    const i = opsi.findIndex((o) => o.nilai === nilai);
    setAktif(i >= 0 ? i : (bisa[0] ?? 0));
    setBuka(true);
  }
  function pilih(i: number) {
    const o = opsi[i];
    if (!o || o.nonaktif) return;
    setBuka(false);
    tombol.current?.focus();
    if (o.nilai !== nilai) onPilih(o.nilai);
  }
  function tombolKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      bukaDaftar();
    }
  }
  function daftarKey(e: React.KeyboardEvent) {
    const k = bisa.indexOf(aktif);
    if (e.key === "ArrowDown") setAktif(bisa[Math.min(bisa.length - 1, k + 1)] ?? aktif);
    else if (e.key === "ArrowUp") setAktif(bisa[Math.max(0, k - 1)] ?? aktif);
    else if (e.key === "Home") setAktif(bisa[0] ?? aktif);
    else if (e.key === "End") setAktif(bisa[bisa.length - 1] ?? aktif);
    else if (e.key === "Enter" || e.key === " ") pilih(aktif);
    else if (e.key === "Escape" || e.key === "Tab") {
      setBuka(false);
      if (e.key === "Escape") tombol.current?.focus();
      return;
    } else return;
    e.preventDefault();
  }

  return (
    <>
      <button
        ref={tombol}
        id={idAwal}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={buka}
        aria-label={label}
        onClick={() => (buka ? setBuka(false) : bukaDaftar())}
        onKeyDown={tombolKey}
        className={`flex h-full min-h-10 w-full items-center gap-1 px-2 py-1.5 text-left hover:bg-surface-2/60 ${FOKUS} focus-visible:-outline-offset-2`}
        style={style}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <IconChevronDown className="shrink-0 text-[12px] text-muted" aria-hidden="true" />
      </button>
      {buka &&
        pos &&
        createPortal(
          <ul
            ref={daftar}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-o${aktif}`}
            onKeyDown={daftarKey}
            className="fixed z-[60] overflow-y-auto rounded-xl border border-border-strong p-1 text-sm shadow-2xl outline-none"
            style={{ left: pos.left, top: pos.top, minWidth: pos.minWidth, maxHeight: pos.maxHeight, background: "var(--solid)" }}
          >
            {opsi.map((o, i) => (
              <li
                key={o.nilai}
                id={`${id}-o${i}`}
                role="option"
                aria-selected={o.nilai === nilai}
                aria-disabled={o.nonaktif || undefined}
                onMouseEnter={() => !o.nonaktif && setAktif(i)}
                onClick={() => pilih(i)}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 ${i === aktif ? "bg-primary/15" : ""} ${o.nonaktif ? "cursor-default opacity-50" : ""}`}
              >
                {o.warna !== undefined && <span className="h-3 w-3 shrink-0 rounded-full" style={titikWarna(o.warna)} aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-fg">{o.label}</span>
                  {o.keterangan && <span className="block text-xs text-muted">{o.keterangan}</span>}
                </span>
                {o.nilai === nilai && <IconCheck className="shrink-0 text-[14px] text-primary" aria-hidden="true" />}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}

// ── Sel teks / tautan ─────────────────────────────────────────────────────────────────────────

function SelTeks({ label, nilai, onSimpan, panjang = false, maks, kosong }: { label: string; nilai: string | null; onSimpan: (v: string | null) => void; panjang?: boolean; maks: number; kosong: string }) {
  const [ubah, setUbah] = useState(false);
  const [isi, setIsi] = useState("");
  const batal = useRef(false);
  const mulai = () => {
    setIsi(nilai ?? "");
    batal.current = false;
    setUbah(true);
  };
  const selesai = () => {
    setUbah(false);
    if (batal.current) return;
    const v = isi.trim() ? isi.trim() : null;
    if (v !== (nilai ?? null)) onSimpan(v);
  };
  if (ubah) {
    const umum = {
      autoFocus: true,
      "aria-label": label,
      value: isi,
      maxLength: maks,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setIsi(e.target.value),
      onBlur: selesai,
    };
    const kelas = "input w-full rounded-md px-2 py-1 text-xs";
    return panjang ? (
      <div className="p-1">
        <textarea
          {...umum}
          rows={5}
          className={`${kelas} min-h-28`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              batal.current = true;
              (e.target as HTMLElement).blur();
            } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) (e.target as HTMLElement).blur();
          }}
        />
        <p className="mt-0.5 text-[10px] text-muted">Ctrl+Enter simpan · Esc batal</p>
      </div>
    ) : (
      <div className="p-1">
        <input
          {...umum}
          className={`${kelas} h-8`}
          onKeyDown={(e) => {
            if (e.key === "Escape") batal.current = true;
            if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLElement).blur();
          }}
        />
      </div>
    );
  }
  return (
    <button type="button" onClick={mulai} aria-label={`${label}: ${nilai || "kosong"}. Ubah`} className={`block h-full min-h-10 w-full px-2 py-1.5 text-left hover:bg-surface-2/60 ${FOKUS} focus-visible:-outline-offset-2`}>
      {nilai ? <span className={`block text-fg ${panjang ? "line-clamp-3 whitespace-pre-wrap" : ""}`}>{nilai}</span> : <span className="text-subtle">{kosong}</span>}
    </button>
  );
}

function SelTautan({ label, nilai, onSimpan }: { label: string; nilai: string | null; onSimpan: (v: string | null) => void }) {
  const [ubah, setUbah] = useState(false);
  const [isi, setIsi] = useState("");
  const [salah, setSalah] = useState(false);
  const batal = useRef(false);
  const idGalat = useId();
  const mulai = () => {
    setIsi(nilai ?? "");
    setSalah(false);
    batal.current = false;
    setUbah(true);
  };
  const selesai = () => {
    if (batal.current) return setUbah(false);
    const v = isi.trim() || null;
    if (v && !tautanSah(v)) return setSalah(true);
    setUbah(false);
    if (v !== (nilai ?? null)) onSimpan(v);
  };
  if (ubah)
    return (
      <div className="p-1">
        <input
          autoFocus
          type="url"
          inputMode="url"
          aria-label={label}
          aria-invalid={salah}
          aria-describedby={salah ? idGalat : undefined}
          placeholder="https://…"
          maxLength={500}
          value={isi}
          onChange={(e) => {
            setIsi(e.target.value);
            setSalah(false);
          }}
          onBlur={selesai}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              batal.current = true;
              setUbah(false);
            } else if (e.key === "Enter") selesai();
          }}
          className={`input h-8 w-full rounded-md px-2 py-1 text-xs ${salah ? "border-danger" : ""}`}
        />
        {salah && (
          <p id={idGalat} className="mt-0.5 text-[11px] font-medium text-danger">
            Harus diawali http:// atau https://
          </p>
        )}
      </div>
    );
  return (
    <div className="flex min-h-10 items-center gap-1 px-1.5 py-1">
      {nilai ? <ChipTautan t={{ label: "", url: nilai }} kecil /> : <span className="px-1 text-subtle">–</span>}
      <button type="button" onClick={mulai} aria-label={`${nilai ? "Ubah" : "Isi"} ${label}`} title={`${nilai ? "Ubah" : "Isi"} tautan`} className={`ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg ${FOKUS}`}>
        {nilai ? <IconPencil className="text-[13px]" aria-hidden="true" /> : <IconPlus className="text-[13px]" aria-hidden="true" />}
      </button>
    </div>
  );
}

// ── Tabel ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Tabel padat seperti sheet pembina: kepala lengket, pemisah kuning tiap Minggu, sel konsep berwarna, sunting
 * di tempat (klik sel → isian/pilihan, Enter/keluar = simpan, Esc = batal). Warna selalu disertai teks.
 */
export function TabelKonten({
  data,
  saring,
  onUbah,
  onTambah,
  onHapus,
}: {
  data: DataKonten;
  saring: Saringan;
  onUbah: (b: BarisJson, patch: PatchBaris) => void;
  onTambah: (tanggal: string) => void;
  onHapus: (b: BarisJson) => void;
}) {
  const konsep = new Map(data.konsep.map((k) => [k.id, k]));
  const status = new Map(data.status.map((s) => [s.id, s]));
  const grup = new Map(data.grup.map((g) => [g.id, g]));
  const anak = new Map(data.anak.map((a) => [a.pesertaId, a]));
  const libur = new Map(data.libur.map((l) => [l.tanggal, l.nama]));
  const adaSaringan = saring.anak != null || saring.grup != null || saring.status != null;
  const lolos = (b: BarisJson) =>
    (saring.anak == null || b.pesertaId === saring.anak || (b.grupId != null && !!grup.get(b.grupId)?.anggota.includes(saring.anak))) &&
    (saring.grup == null || b.grupId === saring.grup) &&
    (saring.status == null || b.statusId === saring.status);
  const item = susunPekan(data.bulan, data.baris.filter(lolos), libur);

  const opsiKonsep: Opsi[] = data.konsep.filter((k) => k.aktif).map((k) => ({ nilai: String(k.id), label: k.label, warna: k.warna }));
  const opsiStatus: Opsi[] = data.status.filter((s) => s.aktif).map((s) => ({ nilai: String(s.id), label: s.nama, warna: s.warna, keterangan: s.final ? "Final — dihitung selesai" : s.anakBoleh ? "Anak boleh memilih" : "Hanya pembina" }));
  const opsiKode: Opsi[] = [
    { nilai: "", label: "— belum dibagi —" },
    ...data.anak.filter((a) => a.aktif && a.kode != null).map((a) => ({ nilai: `p:${a.pesertaId}`, label: `${a.kode} · ${a.panggilan}` })),
    ...data.anak.filter((a) => a.aktif && a.kode == null).map((a) => ({ nilai: `p:${a.pesertaId}`, label: `– · ${a.panggilan}`, keterangan: "Belum punya kode" })),
    ...data.grup.filter((g) => g.aktif).map((g) => ({ nilai: `g:${g.id}`, label: g.nama, warna: g.warna, keterangan: g.anggota.map((p) => anak.get(p)?.panggilan).filter(Boolean).join(", ") || "Belum ada anggota" })),
  ];

  let no = 0;
  const baris: ReactNode[] = [];
  for (const it of item) {
    if (it.jenis === "minggu") {
      if (!adaSaringan || it.baris.length)
        baris.push(
          <tr key={`m-${it.tanggal}`}>
            <td colSpan={KOLOM.length} className="border-y border-border px-3 py-1 text-xs font-semibold text-fg" style={latarHex(WARNA_KUNING, 55)}>
              <span className="sticky left-3">{namaTanggal(it.tanggal)}</span>
            </td>
          </tr>
        );
    } else if (it.baris.length === 0) {
      if (adaSaringan) continue;
      baris.push(
        <tr key={`k-${it.tanggal}`} className="border-b border-border">
          <td className={`${LEKAT_NO} px-2 py-1.5 text-center text-subtle`} style={LATAR_LEKAT} />
          <td className={`${LEKAT_TGL} whitespace-nowrap px-2 py-1.5 text-muted`} style={LATAR_LEKAT}>
            {namaTanggal(it.tanggal)}
          </td>
          <td colSpan={KOLOM.length - 3} className="px-2 py-1.5 text-xs text-muted">
            {it.libur ? <span className="font-semibold text-danger">Libur: {it.libur}</span> : "Belum ada jadwal."}
          </td>
          <td className="px-1 py-1">
            <button type="button" onClick={() => onTambah(it.tanggal)} aria-label={`Tambah baris ${namaTanggal(it.tanggal)}`} title="Tambah baris" className={`grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg ${FOKUS}`}>
              <IconPlus className="text-[14px]" aria-hidden="true" />
            </button>
          </td>
        </tr>
      );
      continue;
    }
    for (const b of it.baris) {
      no++;
      const k = konsep.get(b.konsepId);
      const s = status.get(b.statusId);
      const g = b.grupId != null ? grup.get(b.grupId) : undefined;
      const a = b.pesertaId != null ? anak.get(b.pesertaId) : undefined;
      const kode = g ? g.nama : a ? (a.kode != null ? String(a.kode) : "–") : "";
      const nama = g ? g.anggota.map((p) => anak.get(p)?.panggilan).filter(Boolean).join(", ") : (a?.panggilan ?? "");
      const tgl = namaTanggal(b.tanggal);
      const nilaiKode = b.grupId != null ? `g:${b.grupId}` : b.pesertaId != null ? `p:${b.pesertaId}` : "";
      const opsiK = opsiKode.some((o) => o.nilai === nilaiKode) ? opsiKode : [...opsiKode, { nilai: nilaiKode, label: kode || "?", keterangan: "Nonaktif", nonaktif: true }];
      const opsiS = opsiStatus.some((o) => o.nilai === String(b.statusId)) ? opsiStatus : [...opsiStatus, { nilai: String(b.statusId), label: s?.nama ?? "?", warna: s?.warna, nonaktif: true }];
      const opsiKn = opsiKonsep.some((o) => o.nilai === String(b.konsepId)) ? opsiKonsep : [...opsiKonsep, { nilai: String(b.konsepId), label: k?.label ?? "?", warna: k?.warna, nonaktif: true }];
      baris.push(
        <tr key={b.id} className={`border-b border-border align-top ${s?.final ? "bg-success/5" : ""}`}>
          <td className={`${LEKAT_NO} px-2 py-1.5 text-center tabular text-muted`} style={LATAR_LEKAT}>
            {no}
          </td>
          <td className={`${LEKAT_TGL} whitespace-nowrap px-2 py-1.5`} style={LATAR_LEKAT}>
            <span className="block text-fg">{tgl}</span>
            {b.usulan && (
              <span className="mt-0.5 inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-warning" style={{ background: "color-mix(in oklab, var(--warning) 18%, transparent)" }}>
                Usulan
              </span>
            )}
          </td>
          <td className="p-0">
            <SelTeks label={`Judul postingan ${tgl}`} nilai={b.judul} maks={200} kosong="–" onSimpan={(v) => onUbah(b, { judul: v })} />
          </td>
          <td className="p-0 text-center font-semibold" style={latarWarna(k?.warna, 42)}>
            <Pilihan label={`Klasifikasi konsep ${tgl}`} nilai={String(b.konsepId)} opsi={opsiKn} onPilih={(v) => onUbah(b, { konsepId: Number(v) })}>
              <span className="block text-[11px] leading-tight text-fg">{k?.label ?? "(konsep dihapus)"}</span>
            </Pilihan>
          </td>
          <td className="p-0">
            <SelTautan label={`Referensi ${tgl}`} nilai={b.ref} onSimpan={(v) => onUbah(b, { ref: v })} />
          </td>
          <td className="p-0">
            <Pilihan label={`Status ${tgl}`} nilai={String(b.statusId)} opsi={opsiS} onPilih={(v) => onUbah(b, { statusId: Number(v) })}>
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-fg" style={latarWarna(s?.warna, 30) ?? { background: "var(--surface-2)" }}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={titikWarna(s?.warna)} aria-hidden="true" />
                <span className="truncate">{s?.nama ?? "?"}</span>
              </span>
            </Pilihan>
          </td>
          <td className="p-0 text-center font-semibold" style={latarHex(warnaSelKode(k?.warna, g ? g.warna : null))}>
            <Pilihan label={`Kode anak atau grup ${tgl}`} nilai={nilaiKode} opsi={opsiK} onPilih={(v) => onUbah(b, v.startsWith("g:") ? { grupId: Number(v.slice(2)), pesertaId: null } : v.startsWith("p:") ? { pesertaId: Number(v.slice(2)), grupId: null } : { pesertaId: null, grupId: null })}>
              <span className="block text-fg">{kode || <span className="font-normal text-subtle">–</span>}</span>
            </Pilihan>
          </td>
          <td className="px-2 py-1.5 text-fg">{nama || <span className="text-subtle">–</span>}</td>
          <td className="p-0">
            <SelTeks label={`Caption ${tgl}`} nilai={b.caption} maks={5000} panjang kosong="–" onSimpan={(v) => onUbah(b, { caption: v })} />
          </td>
          <td className="p-0">
            <SelTautan label={`Link folder footage ${tgl}`} nilai={b.linkFootage} onSimpan={(v) => onUbah(b, { linkFootage: v })} />
          </td>
          <td className="p-0">
            <SelTautan label={`Link ekspor konten ${tgl}`} nilai={b.linkEkspor} onSimpan={(v) => onUbah(b, { linkEkspor: v })} />
          </td>
          <td className="px-1 py-1">
            <div className="flex items-center gap-0.5">
              {b.usulan && (
                <button type="button" onClick={() => onUbah(b, { usulan: false })} aria-label={`Tandai disetujui ${tgl}`} title="Tandai disetujui" className={`grid h-8 w-8 place-items-center rounded-lg text-success hover:bg-surface-2 ${FOKUS}`}>
                  <IconCheck className="text-[14px]" aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={() => onTambah(b.tanggal)} aria-label={`Tambah baris lagi ${tgl}`} title="Tambah baris di tanggal ini" className={`grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg ${FOKUS}`}>
                <IconPlus className="text-[14px]" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onHapus(b)} aria-label={`Hapus baris ${tgl}`} title="Hapus baris" className={`grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-danger ${FOKUS}`}>
                <IconTrash className="text-[14px]" aria-hidden="true" />
              </button>
            </div>
          </td>
        </tr>
      );
    }
  }

  return (
    <div className="glass max-h-[calc(100vh-15rem)] min-h-80 overflow-auto rounded-2xl print:max-h-none print:overflow-visible">
      <table className="w-full table-fixed border-collapse text-xs" style={{ minWidth: LEBAR.reduce((a, b) => a + b, 0) }}>
        <caption className="sr-only">Jadwal konten {data.bulan}. Klik sel untuk mengubah.</caption>
        <colgroup>
          {LEBAR.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {KOLOM.map((kol, i) => (
              <th
                key={kol}
                scope="col"
                className={`sticky top-0 ${i === 0 ? "left-0 z-20" : i === 1 ? "left-[44px] z-20" : "z-10"} border-b border-border-strong px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-wide text-muted`}
                style={{ background: "color-mix(in oklab, var(--solid) 88%, var(--info))" }}
              >
                {kol === "AKSI" ? <span className="sr-only">Aksi</span> : kol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.length ? (
            baris
          ) : (
            <tr>
              <td colSpan={KOLOM.length} className="px-4 py-10 text-center text-sm text-muted">
                Tidak ada baris yang cocok dengan saringan.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const WARNA_KUNING = hexWarna("kuning");

/** Legenda di bawah tabel (seperti bagian bawah sheet): kode anak & grup + anggotanya. */
export function LegendaKonten({ data }: { data: DataKonten }) {
  const anak = data.anak.filter((a) => a.kode != null || a.aktif).sort((x, y) => (x.kode ?? 999) - (y.kode ?? 999));
  const namaAnak = new Map(data.anak.map((a) => [a.pesertaId, a]));
  return (
    <section aria-label="Legenda kode & grup" className="glass grid gap-4 rounded-2xl p-4 text-xs md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Kode anak</h3>
        {anak.length === 0 ? (
          <p className="text-muted">Belum ada peserta magang.</p>
        ) : (
          <table className="w-full">
            <thead className="sr-only">
              <tr>
                <th>Kode</th>
                <th>Panggilan</th>
                <th>Nama lengkap</th>
              </tr>
            </thead>
            <tbody>
              {anak.map((a) => (
                <tr key={a.pesertaId} className="border-b border-border last:border-0">
                  <td className="w-10 py-1 text-center font-bold text-fg">{a.kode ?? "–"}</td>
                  <td className="py-1 font-semibold text-fg">{a.panggilan}</td>
                  <td className="py-1 text-muted">
                    {a.namaLengkap}
                    {!a.aktif && " (nonaktif)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Grup (urutan giliran hari grup)</h3>
        {data.grup.length === 0 ? (
          <p className="text-muted">Belum ada grup. Tambahkan di Setelan → Grup.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.grup.map((g) => (
              <li key={g.id} className="flex items-start gap-2">
                <span className="min-w-20 rounded-md px-2 py-0.5 text-center font-bold text-fg" style={latarWarna(g.warna, 55)}>
                  {g.nama}
                </span>
                <span className="text-fg">
                  {g.anggota.map((p) => namaAnak.get(p)).filter(Boolean).map((a) => `${a!.kode ?? "–"} · ${a!.panggilan}`).join(", ") || <span className="text-muted">Belum ada anggota</span>}
                  {!g.aktif && <span className="text-muted"> (nonaktif)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {data.brief.catatan && <p className="mt-3 rounded-xl bg-surface-2 p-2.5 text-fg">{data.brief.catatan}</p>}
      </div>
    </section>
  );
}
