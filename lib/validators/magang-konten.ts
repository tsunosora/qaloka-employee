import { z } from "zod";
import { MAKS_TAUTAN, bulanSah, tanggalSah, tautanSah, warnaSah } from "@/lib/services/magang/konten";

const ymd = z.string().refine(tanggalSah, "Format tanggal harus YYYY-MM-DD");
export const bulanSchema = z.string().refine(bulanSah, "Format bulan harus YYYY-MM");
const warna = z.string().trim().refine(warnaSah, "Warna tidak dikenal");
const id = z.number().int().positive();

const teksOpsional = (maks: number) =>
  z
    .string()
    .max(maks)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null));

/** Tautan opsional: kosong → null; terisi → wajib http(s). */
const tautanOpsional = z
  .string()
  .max(MAKS_TAUTAN, "Tautan terlalu panjang")
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))
  .refine((v) => v === null || tautanSah(v), "Tautan harus diawali http:// atau https://");

/**
 * Untuk PATCH (sunting sebagian): TIDAK DIKIRIM = tidak diubah (undefined, kunci tidak ikut ditulis);
 * null / "" / spasi = dikosongkan (null); terisi = di-trim. Jangan pakai teksOpsional/tautanOpsional di skema
 * ubah — keduanya mengubah "tidak dikirim" menjadi null dan menghapus isi kolom (bug 10 Nov 2026).
 */
export const teksParsial = (maks: number) =>
  z
    .string()
    .max(maks)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null));

/** Tautan untuk PATCH: tidak dikirim = undefined; kosong → null; terisi → wajib http(s). */
export const tautanParsial = z
  .string()
  .max(MAKS_TAUTAN, "Tautan terlalu panjang")
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null))
  .refine((v) => v == null || tautanSah(v), "Tautan harus diawali http:// atau https://");

const tautanBerlabel = z.object({
  label: z.string().trim().max(80).default(""),
  url: z
    .string()
    .trim()
    .max(MAKS_TAUTAN)
    .refine((v) => v === "" || tautanSah(v), "Tautan harus diawali http:// atau https://"),
});

// ── Baris jadwal ──────────────────────────────────────────────────────────────────────────────

const isiBaris = {
  judul: teksOpsional(200),
  ref: tautanOpsional,
  caption: teksOpsional(5000),
  linkFootage: tautanOpsional,
  linkEkspor: tautanOpsional,
  catatan: teksOpsional(2000),
};
/** Sama dengan isiBaris, tetapi kolom yang tidak dikirim tetap undefined (tidak ditimpa). */
const isiBarisUbah = {
  judul: teksParsial(200),
  ref: tautanParsial,
  caption: teksParsial(5000),
  linkFootage: tautanParsial,
  linkEkspor: tautanParsial,
  catatan: teksParsial(2000),
};

/** Pembina menambah baris. pesertaId & grupId: paling banyak satu. */
export const kontenBaruSchema = z
  .object({
    tanggal: ymd,
    konsepId: id,
    pesertaId: id.nullable().optional(),
    grupId: id.nullable().optional(),
    statusId: id.optional(),
    ...isiBaris,
    usulan: z.boolean().default(false),
  })
  .refine((b) => !(b.pesertaId && b.grupId), { message: "Pilih anak ATAU grup, bukan keduanya", path: ["pesertaId"] });

/** Pembina mengubah sebagian kolom (sunting sel). Kolom yang tidak dikirim = tidak diubah. */
export const ubahKontenSchema = z
  .object({
    tanggal: ymd.optional(),
    konsepId: id.optional(),
    pesertaId: id.nullable().optional(),
    grupId: id.nullable().optional(),
    statusId: id.optional(),
    ...isiBarisUbah,
    usulan: z.boolean().optional(),
    urutan: z.number().int().min(0).max(99).optional(),
  })
  .refine((b) => !(b.pesertaId && b.grupId), { message: "Pilih anak ATAU grup, bukan keduanya", path: ["pesertaId"] });

/** Anak (dari HP) hanya boleh judul, dua tautan, dan status yang anakBoleh. Tidak dikirim = tidak diubah. */
export const ubahKontenAnakSchema = z
  .object({
    judul: teksParsial(200),
    linkFootage: tautanParsial,
    linkEkspor: tautanParsial,
    statusId: id.optional(),
  })
  .strict();

export const buatBulanSchema = z.object({
  bulan: bulanSchema,
  ganti: z.boolean().default(false),
  simpan: z.boolean().default(false),
});

// ── Konsep, status, grup, kode ────────────────────────────────────────────────────────────────

export const konsepSchema = z.object({
  nama: z.string().trim().min(2, "Nama konsep minimal 2 huruf").max(60),
  sub: teksOpsional(60),
  warna: warna.default("putih"),
  referensi: z.array(tautanBerlabel).max(10).default([]),
  urutan: z.number().int().min(0).max(999).optional(),
  aktif: z.boolean().default(true),
});
// Skema ubah ditulis tanpa .default(): di zod 4 nilai bawaan tetap terisi di dalam .partial(), jadi
// PATCH {referensi} (panel brief) dulu mengembalikan warna ke "putih" dan aktif ke true.
export const ubahKonsepSchema = z.object({
  nama: konsepSchema.shape.nama.optional(),
  sub: teksParsial(60),
  warna: warna.optional(),
  referensi: z.array(tautanBerlabel).max(10).optional(),
  urutan: z.number().int().min(0).max(999).optional(),
  aktif: z.boolean().optional(),
});

export const statusKontenSchema = z.object({
  nama: z.string().trim().min(2, "Nama status minimal 2 huruf").max(60),
  warna: warna.default("abu"),
  urutan: z.number().int().min(0).max(999).optional(),
  aktif: z.boolean().default(true),
  anakBoleh: z.boolean().default(false),
  final: z.boolean().default(false),
});
export const ubahStatusKontenSchema = z.object({
  nama: statusKontenSchema.shape.nama.optional(),
  warna: warna.optional(),
  urutan: z.number().int().min(0).max(999).optional(),
  aktif: z.boolean().optional(),
  anakBoleh: z.boolean().optional(),
  final: z.boolean().optional(),
});

export const grupKontenSchema = z.object({
  nama: z.string().trim().min(1, "Nama grup wajib diisi").max(60),
  warna: warna.default("merah"),
  urutan: z.number().int().min(0).max(999).optional(),
  aktif: z.boolean().default(true),
  anggota: z.array(id).max(30).default([]),
});
/** anggota tidak dikirim = anggota tidak diubah (dulu .partial() mengisi [] → semua anggota terhapus). */
export const ubahGrupKontenSchema = z.object({
  nama: grupKontenSchema.shape.nama.optional(),
  warna: warna.optional(),
  urutan: z.number().int().min(0).max(999).optional(),
  aktif: z.boolean().optional(),
  anggota: z.array(id).max(30).optional(),
});

/** Kode anak (CODE di sheet). null = tanpa kode. Kode yang sama dipakai dua anak → ditolak. */
export const kodeAnakSchema = z
  .object({ kode: z.array(z.object({ pesertaId: id, kode: z.number().int().min(1).max(99).nullable() })).max(200) })
  .refine((v) => {
    const k = v.kode.map((x) => x.kode).filter((x): x is number => x != null);
    return new Set(k).size === k.length;
  }, "Satu kode hanya untuk satu anak");

// ── Catatan & brief (Setting magang_konten_brief) + pola hari ─────────────────────────────────

export const briefSchema = z.object({
  drive: z.array(tautanBerlabel).max(10).default([]),
  catatan: z.string().trim().max(1000).default(""),
  font: z.string().trim().max(120).default(""),
  preset: z.string().trim().max(120).default(""),
  caption: z.string().trim().max(5000).default(""),
  hashtag: z.string().trim().max(2000).default(""),
});
export type BriefKonten = z.infer<typeof briefSchema>;
export const BRIEF_KOSONG: BriefKonten = { drive: [], catatan: "", font: "", preset: "", caption: "", hashtag: "" };

/** Isi Setting yang rusak/kosong → brief kosong (tidak melempar). */
export function uraiBrief(nilai: string | null | undefined): BriefKonten {
  if (!nilai) return { ...BRIEF_KOSONG };
  try {
    const r = briefSchema.safeParse(JSON.parse(nilai));
    return r.success ? r.data : { ...BRIEF_KOSONG };
  } catch {
    return { ...BRIEF_KOSONG };
  }
}

const kunciKonsep = z.string().trim().max(40).nullable().optional();
export const polaSchema = z.object({
  hari: z.object({ 1: kunciKonsep, 2: kunciKonsep, 3: kunciKonsep, 4: kunciKonsep, 5: kunciKonsep, 6: kunciKonsep }),
  empathy: z.string().trim().max(40).nullable(),
  selangHari: z.number().int().min(7).max(56).default(14),
});
