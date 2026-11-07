import { z } from "zod";
import { MAKS_INGATAN, MIN_INGATAN } from "@/lib/services/magang/nilai";
import { MIN_KEGIATAN, MAKS_KEGIATAN } from "@/lib/services/magang/jurnal";

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

// ── Jurnal harian & pendaftaran (7 Nov 2026) ─────────────────────────────────────────────────

/** Jurnal dari portal (multipart → objek). hapusFoto = indeks foto lama yang dibuang, mis. "0,2". */
export const jurnalSchema = z.object({
  tanggal: ymd,
  kegiatan: z
    .string()
    .trim()
    .min(MIN_KEGIATAN, `Ceritakan lebih lengkap — minimal ${MIN_KEGIATAN} huruf`)
    .max(MAKS_KEGIATAN),
  kendala: teksOpsional(2000),
  hapusFoto: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 10) : [])),
});

export const cekJurnalSchema = z.object({ komentar: teksOpsional(2000) });
/** Tandai banyak jurnal sekaligus (satu anak) — tanpa komentar per jurnal. */
export const cekJurnalMassalSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Pilih jurnal yang dicek").max(200),
  komentar: teksOpsional(2000),
});

export const tautanDaftarSchema = z
  .object({
    label: z.string().trim().min(2, "Beri nama, mis. PKL SMK Juli 2027").max(100),
    berlakuSampai: ymd,
    mulaiMagang: ymd.nullable().optional(),
    selesaiMagang: ymd.nullable().optional(),
  })
  .refine((d) => !d.mulaiMagang || !d.selesaiMagang || d.selesaiMagang >= d.mulaiMagang, {
    message: "Tanggal selesai sebelum tanggal mulai",
    path: ["selesaiMagang"],
  });

const pinMentah = z.string().min(1, "PIN wajib diisi").max(32);

/** Formulir pendaftaran mandiri (publik). */
export const pendaftaranSchema = z
  .object({
    namaLengkap: z.string().trim().min(3, "Tulis nama lengkap").max(150),
    panggilan: teksOpsional(50),
    hp: z
      .string()
      .trim()
      .regex(/^[0-9+\s-]{8,20}$/, "Nomor HP tidak sah")
      .transform((v) => v.replace(/[\s-]/g, "")),
    sekolah: z.string().trim().min(2, "Tulis nama sekolah/kampus").max(150),
    jurusan: teksOpsional(100),
    mulai: ymd,
    selesai: ymd.nullable().optional(),
    pin: pinMentah,
    confirm: pinMentah,
  })
  .refine((d) => d.pin === d.confirm, { message: "Ulangi PIN tidak sama.", path: ["confirm"] })
  .refine((d) => !d.selesai || d.selesai >= d.mulai, { message: "Tanggal selesai sebelum tanggal mulai", path: ["selesai"] });

export const keputusanPendaftarSchema = z
  .object({ aksi: z.enum(["setujui", "tolak"]), alasan: teksOpsional(255) })
  .refine((d) => d.aksi !== "tolak" || !!d.alasan, { message: "Tulis alasan penolakan", path: ["alasan"] });

/** Pengawas membuat akun anak sekaligus (tanpa lewat Direktori). */
export const pesertaBaruSchema = z
  .object({
    namaLengkap: z.string().trim().min(3).max(150),
    panggilan: teksOpsional(50),
    hp: teksOpsional(30),
    sekolah: teksOpsional(150),
    jurusan: teksOpsional(100),
    mulai: ymd,
    selesai: ymd.nullable().optional(),
    catatan: teksOpsional(2000),
  })
  .refine((p) => !p.selesai || p.selesai >= p.mulai, { message: "Tanggal selesai sebelum tanggal mulai", path: ["selesai"] });
