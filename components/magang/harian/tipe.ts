/** Bentuk data dasbor jadwal harian (GET /api/magang/harian). Tipe saja — aman untuk klien. */
import type { DataMinggu } from "@/lib/services/magang/harian-db";

export type { DataMinggu };
export type HariJson = DataMinggu["hari"][number];
export type SelJson = HariJson["sel"][number];
export type PasanganJson = DataMinggu["pasangan"][number];
export type AnakJson = DataMinggu["anak"][number];

/** "Anak A & Anak B" atau nama pasangan bila diisi. */
export function labelPasangan(p: Pick<PasanganJson, "nama" | "namaA" | "namaB">): string {
  return p.nama?.trim() || (p.namaB ? `${p.namaA} & ${p.namaB}` : `${p.namaA} (sendiri)`);
}
