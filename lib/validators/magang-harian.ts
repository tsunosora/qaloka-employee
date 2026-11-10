import { z } from "zod";
import { bentukYmd, hariDalamMinggu, JENIS_PENGECUALIAN, TUGAS_HARIAN } from "@/lib/services/magang/harian";
import { teksParsial } from "@/lib/validators/magang-konten";

/**
 * Validasi jadwal harian berpasangan. Skema UBAH (PATCH) tanpa .default() (zod 4 mengisi bawaan di dalam
 * .partial()) dan tanpa mengubah "tidak dikirim" menjadi null — route menulis tanpaUndefined(data).
 */

const ymd = z.string().refine(bentukYmd, "Format tanggal harus YYYY-MM-DD");
const id = z.number().int().positive();
const tugas = z.enum(TUGAS_HARIAN);
/** Patokan bukan hari Minggu (Minggu tidak pernah hari kerja). */
const patokan = ymd.refine((v) => !bentukYmd(v) || hariDalamMinggu(v) !== 0, "Tanggal patokan tidak boleh hari Minggu");
/** Teks opsional untuk BUAT: kosong → null. */
const teksBuat = (maks: number) =>
  z
    .string()
    .max(maks)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null));

export const mingguSchema = ymd;

export const pasanganSchema = z
  .object({
    nama: teksBuat(80),
    pesertaAId: id,
    pesertaBId: id.nullable().optional().transform((v) => v ?? null),
    patokanTanggal: patokan,
    patokanTugas: tugas,
    aktif: z.boolean().optional().transform((v) => v ?? true),
    urutan: z.number().int().min(0).max(999).optional(),
  })
  .strict()
  .refine((d) => d.pesertaAId !== d.pesertaBId, { message: "Dua anak dalam pasangan harus berbeda", path: ["pesertaBId"] });

/** PATCH sebagian: kolom yang tidak dikirim = undefined (tidak ditulis). pesertaBId null = jadikan sendiri. */
export const ubahPasanganSchema = z
  .object({
    nama: teksParsial(80),
    pesertaAId: id.optional(),
    pesertaBId: id.nullable().optional(),
    patokanTanggal: patokan.optional(),
    patokanTugas: tugas.optional(),
    aktif: z.boolean().optional(),
    urutan: z.number().int().min(0).max(999).optional(),
  })
  .strict();

/**
 * Pengecualian satu tanggal. Sasaran: pasanganId (tingkat pasangan: "tugas" | "libur") ATAU pesertaId (tingkat anak:
 * "pasangan" wajib pasanganPesertaId, "tugas", "libur"). jenis "tugas" wajib tugas.
 */
export const pengecualianSchema = z
  .object({
    tanggal: ymd,
    pasanganId: id.nullable().optional().transform((v) => v ?? null),
    pesertaId: id.nullable().optional().transform((v) => v ?? null),
    jenis: z.enum(JENIS_PENGECUALIAN),
    tugas: tugas.nullable().optional().transform((v) => v ?? null),
    pasanganPesertaId: id.nullable().optional().transform((v) => v ?? null),
    catatan: teksBuat(200),
  })
  .strict()
  .superRefine((d, ctx) => {
    if ((d.pasanganId == null) === (d.pesertaId == null))
      ctx.addIssue({ code: "custom", message: "Pilih pasangan ATAU satu anak", path: ["pasanganId"] });
    if (d.jenis === "tugas" && !d.tugas) ctx.addIssue({ code: "custom", message: "Pilih tugasnya", path: ["tugas"] });
    if (d.jenis === "pasangan") {
      if (d.pesertaId == null) ctx.addIssue({ code: "custom", message: "Ganti pasangan hanya untuk satu anak", path: ["pesertaId"] });
      if (d.pasanganPesertaId == null) ctx.addIssue({ code: "custom", message: "Pilih rekan pengganti", path: ["pasanganPesertaId"] });
      else if (d.pasanganPesertaId === d.pesertaId) ctx.addIssue({ code: "custom", message: "Rekan harus anak lain", path: ["pasanganPesertaId"] });
    } else if (d.pasanganPesertaId != null) ctx.addIssue({ code: "custom", message: "Rekan hanya untuk ganti pasangan", path: ["pasanganPesertaId"] });
  });

/** PATCH pengecualian: hanya tugas / rekan / catatan (sasaran, tanggal & jenis tetap — hapus lalu buat baru). */
export const ubahPengecualianSchema = z
  .object({
    tugas: tugas.nullable().optional(),
    pasanganPesertaId: id.optional(),
    catatan: teksParsial(200),
  })
  .strict();
