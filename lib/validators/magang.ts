import { z } from "zod";
import { MAKS_INGATAN, MIN_INGATAN } from "@/lib/services/magang/nilai";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");
const teksOpsional = (maks: number) =>
  z
    .string()
    .max(maks)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null));

export const posSchema = z.object({
  nama: z.string().trim().min(2, "Nama pos minimal 2 huruf").max(80),
  deskripsi: teksOpsional(4000),
  durasiMinggu: z.number().int().min(1).max(4),
  kapasitas: z.number().int().min(1).max(10).default(1),
  urutan: z.number().int().min(0).max(999).default(0),
  pembimbingId: z.number().int().positive().nullable().optional(),
  aktif: z.boolean().default(true),
});

export const soalSchema = z
  .object({
    posId: z.number().int().positive(),
    pertanyaan: z.string().trim().min(5, "Pertanyaan terlalu pendek").max(1000),
    pilihan: z.array(z.string().trim().min(1, "Pilihan jawaban tidak boleh kosong").max(300)).min(2).max(6),
    benar: z.number().int().min(0),
    aktif: z.boolean().default(true),
  })
  .refine((s) => s.benar < s.pilihan.length, { message: "Pilih jawaban yang benar", path: ["benar"] });

export const pesertaSchema = z
  .object({
    employeeId: z.number().int().positive(),
    sekolah: teksOpsional(150),
    jurusan: teksOpsional(100),
    mulai: ymd,
    selesai: ymd.nullable().optional(),
    aktif: z.boolean().default(true),
    catatan: teksOpsional(2000),
  })
  .refine((p) => !p.selesai || p.selesai >= p.mulai, { message: "Tanggal selesai sebelum tanggal mulai", path: ["selesai"] });

/** Susun ulang rotasi mulai Senin minggu `dari` (penugasan sebelumnya dipertahankan). */
export const susunSchema = z.object({ dari: ymd });

/** Ganti pos satu penugasan dengan tangan. */
export const ubahPenugasanSchema = z.object({
  posId: z.number().int().positive(),
  minggu: z.number().int().min(1).max(4),
});

const skala = z.number().int().min(1).max(4);
export const nilaiTugasSchema = z.object({
  nilaiIngatan: skala,
  ketelitian: skala,
  kecepatan: skala,
  inisiatif: skala,
  sikap: skala,
  catatanPembimbing: teksOpsional(4000),
});

/** Kiriman anak dari portal. jawaban = { "<soalId>": indeksPilihan }. */
export const kirimTugasSchema = z.object({
  senin: ymd,
  ingatan: z
    .string()
    .trim()
    .min(MIN_INGATAN, `Tulis lebih lengkap — minimal ${MIN_INGATAN} huruf tentang apa yang kamu pelajari minggu ini`)
    .max(MAKS_INGATAN),
  jawaban: z.record(z.string(), z.number().int().min(0).max(9).nullable()).default({}),
});
