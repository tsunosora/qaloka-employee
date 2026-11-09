"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconAlert, IconDownload, IconPlus, IconX } from "@/components/ui/icons";
import { kecilkan, pesanFotoGagal } from "@/components/absen/peramban";
import { soft } from "./ui";
import type { LampiranMeta } from "./types";

/**
 * Lampiran pengajuan izin (foto surat dokter / PDF) di sisi PERAMBAN. Batasnya sama dengan
 * server (lib/services/leave/lampiran.ts) — server tetap memeriksa ulang dari isi berkas.
 */
export const LAMPIRAN_MAKS_BITA = 5 * 1024 * 1024;
export const LAMPIRAN_MAKS_JUMLAH = 3;
/** Proxy Next menyangga badan kiriman ≤10 MB — kiriman dipecah per ≤9 MB. */
const KIRIM_MAKS_BITA = 9 * 1024 * 1024;
/** Isi atribut accept pemilih berkas (HEIC tetap boleh dipilih — dicoba diubah ke JPEG). */
export const TERIMA_LAMPIRAN = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.pdf,.heic,.heif";

export type LampiranBaru = { kunci: string; blob: Blob; nama: string; tipe: string; pratinjau: string | null };

export function teksUkuran(b: number): string {
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

const tampakPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const tampakHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
const tampakFoto = (f: File) => f.type.startsWith("image/") || tampakHeic(f) || /\.(jpe?g|png|webp)$/i.test(f.name);

const PESAN_HEIC =
  'Format foto HEIC tidak bisa dipakai. Di iPhone pilih "Paling kompatibel" (Pengaturan → Kamera → Format), atau kirim tangkapan layarnya.';

/**
 * Siapkan satu berkas: foto dikecilkan jadi JPEG lewat pembantu absen HP (3 jalan: bitmap → <img>
 * → berkas asli); HEIC ikut jalan yang sama bila peramban bisa membacanya. PDF dikirim apa adanya.
 */
export async function siapkanLampiran(f: File): Promise<LampiranBaru> {
  const kunci = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (tampakPdf(f)) {
    if (f.size > LAMPIRAN_MAKS_BITA) throw new Error(`"${f.name}" terlalu besar (maks. 5 MB).`);
    return { kunci, blob: f, nama: f.name, tipe: "application/pdf", pratinjau: null };
  }
  if (!tampakFoto(f)) throw new Error(`"${f.name}" tidak bisa dipakai. Pilih foto atau PDF.`);
  let blob: Blob;
  try {
    blob = await kecilkan(f);
  } catch (e) {
    throw new Error(tampakHeic(f) ? PESAN_HEIC : pesanFotoGagal(e, f));
  }
  if (blob.size > LAMPIRAN_MAKS_BITA) throw new Error(`"${f.name}" terlalu besar (maks. 5 MB).`);
  const jpeg = blob !== f;
  const nama = jpeg ? `${f.name.replace(/\.[^.]*$/, "") || "foto"}.jpg` : f.name;
  return { kunci, blob, nama, tipe: jpeg ? "image/jpeg" : f.type, pratinjau: URL.createObjectURL(blob) };
}

/** Pecah lampiran jadi beberapa kiriman, masing-masing ≤9 MB (urutan dipertahankan). */
export function kelompokkanKiriman<T extends { blob: { size: number } }>(daftar: readonly T[]): T[][] {
  const hasil: T[][] = [];
  let kini: T[] = [];
  let ukuran = 0;
  for (const l of daftar) {
    if (kini.length > 0 && ukuran + l.blob.size > KIRIM_MAKS_BITA) {
      hasil.push(kini);
      kini = [];
      ukuran = 0;
    }
    kini.push(l);
    ukuran += l.blob.size;
  }
  if (kini.length > 0) hasil.push(kini);
  return hasil;
}

export function tambahKeForm(form: FormData, daftar: readonly LampiranBaru[]) {
  for (const l of daftar) form.append("lampiran", l.blob, l.nama);
}

export function lepasPratinjau(daftar: readonly LampiranBaru[]) {
  for (const l of daftar) if (l.pratinjau) URL.revokeObjectURL(l.pratinjau);
}

function KotakPdf() {
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-danger/15 text-xs font-bold text-danger">
      PDF
    </span>
  );
}

/**
 * Pemilih lampiran untuk form pengajuan: daftar berkas terpilih (nama, ukuran, gambar kecil,
 * tombol buang), teks bantuan, dan galat tepat di bawah medannya.
 */
export function PilihLampiran({
  nilai,
  onUbah,
  sudahAda = 0,
  disabled = false,
}: {
  nilai: LampiranBaru[];
  onUbah: (v: LampiranBaru[]) => void;
  sudahAda?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [siap, setSiap] = useState(false);
  const [galat, setGalat] = useState("");
  const sisa = LAMPIRAN_MAKS_JUMLAH - sudahAda - nilai.length;

  async function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const berkas = [...(e.target.files ?? [])];
    e.target.value = "";
    if (berkas.length === 0) return;
    setGalat("");
    const masuk = berkas.slice(0, Math.max(0, sisa));
    const pesan: string[] = [];
    if (berkas.length > masuk.length) pesan.push(`Maksimal ${LAMPIRAN_MAKS_JUMLAH} berkas — sebagian tidak diambil.`);
    setSiap(true);
    const baru: LampiranBaru[] = [];
    for (const f of masuk) {
      try {
        baru.push(await siapkanLampiran(f));
      } catch (err) {
        pesan.push(err instanceof Error ? err.message : `"${f.name}" tidak bisa dipakai.`);
      }
    }
    setSiap(false);
    if (baru.length) onUbah([...nilai, ...baru]);
    if (pesan.length) setGalat(pesan.join(" "));
  }

  function buang(kunci: string) {
    const l = nilai.find((x) => x.kunci === kunci);
    if (l) lepasPratinjau([l]);
    onUbah(nilai.filter((x) => x.kunci !== kunci));
    setGalat("");
  }

  return (
    <div>
      <span id={`${id}-label`} className="mb-1 block text-sm font-medium text-muted">
        Lampiran
      </span>
      <p id={`${id}-bantu`} className="mb-2 text-xs text-subtle">
        Opsional — foto surat dokter atau PDF, maks 3 berkas, 5&nbsp;MB per berkas
      </p>

      {nilai.length > 0 && (
        <ul className="mb-2 space-y-2" aria-labelledby={`${id}-label`}>
          {nilai.map((l) => (
            <li key={l.kunci} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
              {l.pratinjau ? (
                // eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal (blob:), bukan aset situs
                <img src={l.pratinjau} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <KotakPdf />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{l.nama}</p>
                <p className="text-xs text-subtle">{teksUkuran(l.blob.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => buang(l.kunci)}
                disabled={disabled}
                aria-label={`Buang ${l.nama}`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-subtle transition hover:bg-surface hover:text-danger"
              >
                <IconX className="text-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {sisa > 0 && (
        <>
          <input
            ref={input}
            type="file"
            multiple
            accept={TERIMA_LAMPIRAN}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={pilih}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={disabled || siap}
            aria-describedby={`${id}-bantu${galat ? ` ${id}-galat` : ""}`}
            className="btn-ghost h-11 w-full text-sm"
          >
            <IconPlus className="text-[15px]" />
            {siap ? "Menyiapkan berkas…" : nilai.length > 0 ? `Tambah berkas (sisa ${sisa})` : "Pilih foto atau PDF"}
          </button>
        </>
      )}

      {galat && (
        <p id={`${id}-galat`} role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs text-danger" style={soft("var(--danger)")}>
          <IconAlert className="mt-px shrink-0 text-[14px]" /> {galat}
        </p>
      )}
    </div>
  );
}

/**
 * Lampiran yang sudah tersimpan: foto sebagai gambar kecil (klik → `onBuka`, atau tab baru),
 * PDF sebagai tautan "Unduh PDF" + ukurannya. `onHapus` memunculkan tombol buang.
 */
export function DaftarLampiran({
  lampiran,
  urlDari,
  onBuka,
  onHapus,
  sibuk,
}: {
  lampiran: LampiranMeta[];
  urlDari: (id: number) => string;
  onBuka?: (l: LampiranMeta) => void;
  onHapus?: (l: LampiranMeta) => void;
  sibuk?: number | null;
}) {
  if (lampiran.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label="Lampiran">
      {lampiran.map((l) => {
        const foto = l.tipe.startsWith("image/");
        return (
          <li key={l.id} className="relative">
            {foto ? (
              <a
                href={urlDari(l.id)}
                target="_blank"
                rel="noopener"
                onClick={onBuka ? (e) => { e.preventDefault(); onBuka(l); } : undefined}
                className="block rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                title={l.nama}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- lampiran pribadi lewat rute ber-login/PIN */}
                <img src={urlDari(l.id)} alt={`Lampiran: ${l.nama}`} loading="lazy" className="h-16 w-16 rounded-lg border border-border object-cover" />
              </a>
            ) : (
              <a
                href={urlDari(l.id)}
                download={l.nama}
                className="flex h-16 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium text-fg hover:bg-surface"
                title={l.nama}
              >
                <IconDownload className="text-[16px] text-danger" />
                <span>
                  Unduh PDF
                  <span className="block font-normal text-subtle">{teksUkuran(l.ukuran)}</span>
                </span>
              </a>
            )}
            {onHapus && (
              <button
                type="button"
                onClick={() => onHapus(l)}
                disabled={sibuk === l.id}
                aria-label={`Hapus lampiran ${l.nama}`}
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-danger text-white shadow disabled:opacity-60"
              >
                <IconX className="text-[13px]" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Lepas URL pratinjau saat komponen pemakai dilepas. */
export function useLepasPratinjau(daftar: LampiranBaru[]) {
  const ref = useRef(daftar);
  useEffect(() => {
    ref.current = daftar;
  }, [daftar]);
  useEffect(() => () => lepasPratinjau(ref.current), []);
}
