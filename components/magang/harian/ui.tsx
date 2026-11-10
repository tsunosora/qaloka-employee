"use client";

import type { SVGProps } from "react";
import { LABEL_TUGAS, type TugasHarian } from "@/lib/services/magang/harian";

/** Kamera — KONTEN. */
export const IkonKonten = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);

/** Kardus — PRODUKSI (membuat & mengemas barang). */
export const IkonProduksi = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </svg>
);

/** Bulan sabit — libur. */
export const IkonLibur = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
);

export const WARNA_TUGAS: Record<TugasHarian, string> = { konten: "var(--konten)", produksi: "var(--produksi)" };
/** Kelas utilitas (token @theme --color-konten / --color-produksi) — warna teks, garis, latar lembut. */
export const KELAS_TUGAS: Record<TugasHarian, string> = {
  konten: "text-konten border-konten/45 bg-konten/15",
  produksi: "text-produksi border-produksi/45 bg-produksi/15",
};
export const IKON_TUGAS = { konten: IkonKonten, produksi: IkonProduksi } as const;

/**
 * Lencana tugas: warna berbeda + TEKS "KONTEN"/"PRODUKSI" + ikon (tidak bergantung warna saja). ukuran "besar" untuk
 * kartu HP anak, "sedang" untuk grid pembina, "kecil" untuk daftar.
 */
export function LencanaTugas({ tugas, ukuran = "sedang", className = "" }: { tugas: TugasHarian; ukuran?: "kecil" | "sedang" | "besar"; className?: string }) {
  const Ikon = IKON_TUGAS[tugas];
  const kelas =
    ukuran === "besar"
      ? "gap-2 rounded-2xl px-4 py-2 text-2xl"
      : ukuran === "sedang"
        ? "gap-1.5 rounded-xl px-2.5 py-1 text-sm"
        : "gap-1 rounded-lg px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center border font-display font-extrabold tracking-wide print:border-current ${KELAS_TUGAS[tugas]} ${kelas} ${className}`}>
      <Ikon className="shrink-0" />
      {LABEL_TUGAS[tugas]}
    </span>
  );
}

export function LencanaLibur({ ukuran = "sedang", label = "LIBUR" }: { ukuran?: "kecil" | "sedang" | "besar"; label?: string }) {
  const kelas = ukuran === "besar" ? "gap-2 rounded-2xl px-4 py-2 text-2xl" : ukuran === "sedang" ? "gap-1.5 rounded-xl px-2.5 py-1 text-sm" : "gap-1 rounded-lg px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center border border-border-strong bg-surface-2 font-display font-extrabold tracking-wide text-muted ${kelas}`}>
      <IkonLibur className="shrink-0" />
      {label}
    </span>
  );
}
