/**
 * Aturan tampilan side quest di halaman pribadi (anak & pembimbing) — MURNI, tanpa React, supaya
 * bisa diuji (tests/portal-side-quest.test.ts). Aturan bukti yang sebenarnya tetap di server
 * (lib/services/magang/misi.ts → periksaBukti); di sini hanya cek dini per kolom supaya pesan
 * muncul di dekat kolom yang salah sebelum dikirim.
 */
import { tautanSah, type JenisBukti } from "@/lib/services/magang/misi";

export type StatusMisiTampil = "belum" | "menunggu" | "ditolak" | "selesai";

export const STATUS_MISI_META: Record<StatusMisiTampil, { label: string; color: string }> = {
  belum: { label: "Belum dikerjakan", color: "var(--fg-subtle)" },
  menunggu: { label: "Menunggu dicek", color: "var(--warning)" },
  ditolak: { label: "Perlu diperbaiki", color: "var(--danger)" },
  selesai: { label: "Selesai", color: "var(--success)" },
};

/** Status kiriman server → status tampil. Tanpa kiriman = belum dikerjakan. */
export function statusMisi(kiriman: { status: string } | null | undefined): StatusMisiTampil {
  switch (kiriman?.status) {
    case "menunggu":
      return "menunggu";
    case "ditolak":
      return "ditolak";
    case "disetujui":
      return "selesai";
    default:
      return "belum";
  }
}

/** 0–100, aman untuk total 0. */
export function persen(x: number, dari: number): number {
  if (dari <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((x / dari) * 100)));
}

const LABEL_BUKTI: Record<JenisBukti, string> = { foto: "foto", tautan: "tautan", teks: "tulisan" };

/** ["foto","teks"] → "Kirim foto + tulisan". */
export function ringkasBukti(bukti: readonly JenisBukti[]): string {
  return `Kirim ${bukti.map((b) => LABEL_BUKTI[b]).join(" + ")}`;
}

export type GalatBukti = Partial<Record<JenisBukti, string>>;

/** Cek dini per kolom (bahasa anak). Kosong = siap dikirim. */
export function galatBukti(
  diminta: readonly JenisBukti[],
  isi: { teks: string; tautan: string; jumlahFoto: number },
  batas: { minTeks: number; maksFoto: number }
): GalatBukti {
  const g: GalatBukti = {};
  if (diminta.includes("foto")) {
    if (isi.jumlahFoto < 1) g.foto = "Lampirkan minimal 1 foto hasil kerjamu.";
    else if (isi.jumlahFoto > batas.maksFoto) g.foto = `Foto maksimal ${batas.maksFoto}.`;
  }
  const tautan = isi.tautan.trim();
  if (diminta.includes("tautan") && !tautan) g.tautan = "Tempelkan tautan hasil kerjamu.";
  else if (tautan && !tautanSah(tautan)) g.tautan = "Tautan harus diawali https://";
  if (diminta.includes("teks") && isi.teks.trim().length < batas.minTeks)
    g.teks = `Ceritakan lebih lengkap — minimal ${batas.minTeks} huruf.`;
  return g;
}

/**
 * Pesan galat 422 server → kolom. Bentuk server: `{ foto: [...] }`, `{ formErrors: [...] }`, atau
 * zod flatten `{ formErrors, fieldErrors: { teks, tautan } }`. Yang tak bisa dipetakan → `umum`.
 */
export function petakanGalatServer(errors: unknown): GalatBukti & { umum?: string } {
  const hasil: GalatBukti & { umum?: string } = {};
  if (!errors || typeof errors !== "object") return hasil;
  const e = errors as Record<string, unknown>;
  const pertama = (v: unknown) => (Array.isArray(v) && typeof v[0] === "string" ? v[0] : undefined);
  const medan: Record<string, unknown> = { ...(e.fieldErrors && typeof e.fieldErrors === "object" ? (e.fieldErrors as Record<string, unknown>) : {}), foto: e.foto };
  for (const k of ["foto", "tautan", "teks"] as const) {
    const m = pertama(medan[k]);
    if (m) hasil[k] = m;
  }
  const umum = pertama(e.formErrors);
  if (umum) hasil.umum = umum;
  return hasil;
}
