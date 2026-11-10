import type { ReactNode, SVGProps } from "react";
import { IKON_PLATFORM, type KunciIkon } from "@/lib/services/magang/konten";
import { titikWarna } from "@/components/magang/konten/tipe";

/**
 * Ikon platform (garis 24×24, currentColor — ikut tema). Hanya hiasan: nama platform selalu tertulis di
 * sebelahnya. Kunci tak dikenal / null → titik warna saja.
 */
function Svg({ children, ...p }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}

const JALUR: Record<KunciIkon, ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </>
  ),
  tiktok: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.1 4.3 5 4.6" />,
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" />
    </>
  ),
  facebook: <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />,
  toko: (
    <>
      <path d="M4 10v10h16V10" />
      <path d="M3 10 5 4h14l2 6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3" />
    </>
  ),
  kamera: (
    <>
      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
};

export function IkonPlatform({ ikon, className = "" }: { ikon: string | null | undefined; className?: string }) {
  if (!ikon || !(ikon in JALUR)) return null;
  return <Svg className={className}>{JALUR[ikon as KunciIkon]}</Svg>;
}

export const labelIkon = (ikon: string | null | undefined) => (ikon && ikon in IKON_PLATFORM ? IKON_PLATFORM[ikon as KunciIkon] : "Tanpa ikon");

/** Label platform: titik warna + ikon + nama (+ "arsip"). Warna & ikon hiasan; nama yang membawa arti. */
export function ChipPlatform({ p, kecil = false, className = "" }: { p: { nama: string; warna: string; ikon: string | null; aktif?: boolean }; kecil?: boolean; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 ${kecil ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} font-semibold text-fg ${className}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={titikWarna(p.warna)} aria-hidden="true" />
      <IkonPlatform ikon={p.ikon} className="shrink-0 text-[13px] text-muted" />
      <span className="truncate">{p.nama}</span>
      {p.aktif === false && <span className="font-normal text-muted">(arsip)</span>}
    </span>
  );
}
