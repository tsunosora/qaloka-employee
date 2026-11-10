import type { CSSProperties } from "react";
import { hexWarna } from "@/lib/services/magang/konten";
import type { AnakJson, BarisJson, GrupJson, KonsepJson, Rencana, StatusJson } from "@/lib/services/magang/konten-db";
import type { BriefKonten } from "@/lib/validators/magang-konten";
import type { PolaKonten } from "@/lib/services/magang/konten";

/** Bentuk JSON GET /api/magang/konten?bulan=… (lihat dataBulan di konten-db.ts). */
export type DataKonten = {
  bulan: string;
  baris: BarisJson[];
  konsep: KonsepJson[];
  status: StatusJson[];
  grup: GrupJson[];
  anak: AnakJson[];
  brief: BriefKonten;
  pola: PolaKonten;
  libur: { tanggal: string; nama: string }[];
};
export type { AnakJson, BarisJson, GrupJson, KonsepJson, Rencana, StatusJson, BriefKonten, PolaKonten };

/**
 * Latar sel dari warna palet: dicampur transparan supaya teks var(--fg) tetap terbaca di tema terang
 * maupun gelap. Tanpa warna (putih) → tanpa latar. Warna SELALU disertai teks (nama konsep/status).
 */
export function latarWarna(warna: string | null | undefined, persen = 42): CSSProperties | undefined {
  const hex = hexWarna(warna ?? null);
  return hex ? { background: `color-mix(in oklab, ${hex} ${persen}%, transparent)` } : undefined;
}
/** Titik warna kecil (legenda/status) — dekoratif, teks di sebelahnya yang membawa arti. */
export function titikWarna(warna: string | null | undefined): CSSProperties {
  const hex = hexWarna(warna ?? null);
  return hex ? { background: hex } : { background: "transparent", boxShadow: "inset 0 0 0 1px var(--border-strong)" };
}

/** Cincin fokus yang jelas untuk tombol/ sel buatan sendiri. */
export const FOKUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
