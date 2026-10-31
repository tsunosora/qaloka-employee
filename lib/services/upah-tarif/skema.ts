import { z } from "zod";
import { toYmd } from "@/lib/services/leave/service";

/** Angka rupiah dari form: "" / null → null, selain itu harus angka. Batas wajar di aturan.ts. */
const rupiahOpsional = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number().nullable(),
);

/** Tanggal "YYYY-MM-DD" opsional. */
const tanggalOpsional = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak sah.").nullable(),
);

// Bentuk dasar TANPA nilai bawaan: di zod 4, `.default()` tetap terisi di dalam `.partial()`,
// jadi PATCH tanpa `aktif` akan diam-diam menyalakan kembali baris yang dinonaktifkan.
const tarifDasar = z.object({
  kota: z.string().max(100),
  divisi: z.string().max(100),
  upahHarian: z.coerce.number(),
  lemburPerJam: z.coerce.number(),
  aktif: z.boolean(),
  catatan: z.string().max(255).nullable(),
});

export const tarifBaruSchema = tarifDasar.extend({
  lemburPerJam: z.coerce.number().default(0),
  aktif: z.boolean().default(true),
  catatan: z.string().max(255).nullable().optional(),
});

export const tarifUbahSchema = tarifDasar.partial();

const proyekDasar = z.object({
  kode: z.string().max(30).nullable(),
  nama: z.string().max(150),
  lokasi: z.string().max(150).nullable(),
  mulai: tanggalOpsional,
  selesai: tanggalOpsional,
  upahHarian: rupiahOpsional,
  lemburPerJam: rupiahOpsional,
  aktif: z.boolean(),
});

export const proyekBaruSchema = proyekDasar.partial().extend({
  nama: z.string().max(150),
  aktif: z.boolean().default(true),
});

// sumber & refId sengaja TIDAK ada di sini: disiapkan untuk proyek tarikan Qaloka Event (Tahap 2).
export const proyekUbahSchema = proyekDasar.partial();

/** Decimal Prisma / null → number / null. */
export const angka = (v: { toString(): string } | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v.toString());

type Desimal = { toString(): string } | number;

/** Bentuk satu tarif untuk layar: Decimal → angka. */
export function bentukTarif(t: {
  id: number; kota: string; divisi: string; upahHarian: Desimal; lemburPerJam: Desimal;
  aktif: boolean; catatan: string | null; updatedAt: Date;
}) {
  return {
    id: t.id,
    kota: t.kota,
    divisi: t.divisi,
    upahHarian: angka(t.upahHarian) ?? 0,
    lemburPerJam: angka(t.lemburPerJam) ?? 0,
    aktif: t.aktif,
    catatan: t.catatan,
    diubah: t.updatedAt,
  };
}

/** Bentuk satu proyek untuk layar. `dipakai` = jumlah catatan harian yang memakainya. */
export function bentukProyek(p: {
  id: number; kode: string | null; nama: string; lokasi: string | null; mulai: Date | null; selesai: Date | null;
  upahHarian: Desimal | null; lemburPerJam: Desimal | null; aktif: boolean; sumber: string; refId: string | null;
  _count?: { rekap: number };
}) {
  return {
    id: p.id,
    kode: p.kode,
    nama: p.nama,
    lokasi: p.lokasi,
    mulai: p.mulai ? toYmd(p.mulai) : null,
    selesai: p.selesai ? toYmd(p.selesai) : null,
    upahHarian: angka(p.upahHarian),
    lemburPerJam: angka(p.lemburPerJam),
    aktif: p.aktif,
    sumber: p.sumber,
    refId: p.refId,
    dipakai: p._count?.rekap ?? 0,
  };
}
