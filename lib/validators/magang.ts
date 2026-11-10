import { z } from "zod";
import { MAKS_INGATAN, MIN_INGATAN } from "@/lib/services/magang/nilai";
import { MIN_KEGIATAN, MAKS_KEGIATAN } from "@/lib/services/magang/jurnal";
import {
  KUNCI_BUKTI,
  KUNCI_LEVEL,
  MAKS_KUNCI_KATEGORI,
  MAKS_NAMA_KATEGORI,
  MAKS_TEKS_MISI,
  POLA_KUNCI_KATEGORI,
} from "@/lib/services/magang/misi";

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
  lokasi: teksOpsional(80),
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
    guruPembimbing: teksOpsional(150),
    kontakGuru: teksOpsional(60),
    mulai: ymd,
    selesai: ymd.nullable().optional(),
    aktif: z.boolean().default(true),
    catatan: teksOpsional(2000),
  })
  .refine((p) => !p.selesai || p.selesai >= p.mulai, { message: "Tanggal selesai sebelum tanggal mulai", path: ["selesai"] });

/**
 * Susun rotasi mulai Senin minggu `dari`.
 * - mode "semua" (bawaan, perilaku lama): semua peserta aktif disusun ulang dari `dari`.
 * - mode "baru": HANYA peserta yang belum punya jadwal sejak `dari` (atau `pesertaIds` bila diisi) yang
 *   disusun; jadwal anak lain TIDAK berubah dan dihitung sebagai isi pos (kapasitas tetap dihormati).
 */
export const susunSchema = z.object({
  dari: ymd,
  mode: z.enum(["semua", "baru"]).default("semua"),
  pesertaIds: z.array(z.number().int().positive()).max(200).optional(),
});

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
    sekolah: teksOpsional(150),
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
    guruPembimbing: teksOpsional(150),
    kontakGuru: teksOpsional(60),
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
    guruPembimbing: teksOpsional(150),
    kontakGuru: teksOpsional(60),
    mulai: ymd,
    selesai: ymd.nullable().optional(),
    catatan: teksOpsional(2000),
  })
  .refine((p) => !p.selesai || p.selesai >= p.mulai, { message: "Tanggal selesai sebelum tanggal mulai", path: ["selesai"] });

// ── Side quest (9 Nov 2026) ───────────────────────────────────────────────────────────────────

/** Kunci kategori (slug). Keberadaan & status aktifnya diperiksa di route terhadap DB. */
const kunciKategori = z
  .string({ error: "Pilih kategori" })
  .trim()
  .min(1, "Pilih kategori")
  .max(MAKS_KUNCI_KATEGORI)
  .regex(POLA_KUNCI_KATEGORI, "Kategori tidak dikenal");

export const misiSchema = z.object({
  kategori: kunciKategori,
  level: z.enum(KUNCI_LEVEL).default("dasar"),
  judul: z.string().trim().min(3, "Judul minimal 3 huruf").max(150),
  deskripsi: teksOpsional(4000),
  bukti: z.array(z.enum(KUNCI_BUKTI)).min(1, "Pilih minimal satu jenis bukti").max(3),
  poin: z.number().int().min(0).max(1000).default(10),
  urutan: z.number().int().min(0).max(999).default(0),
  aktif: z.boolean().default(true),
});

// ── Kategori side quest dikelola admin (10 Nov 2026) ───────────────────────────────────────────

const namaKategori = z.string().trim().min(2, "Nama kategori minimal 2 huruf").max(MAKS_NAMA_KATEGORI, "Nama kategori terlalu panjang");
/** Untuk PATCH: tidak dikirim = tidak diubah; "" / null = dikosongkan. */
const teksUbah = (maks: number) =>
  z
    .string()
    .max(maks)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v && v.trim() ? v.trim() : null));

export const kategoriMisiSchema = z.object({
  nama: namaKategori,
  ringkas: teksOpsional(200),
  prioritas: teksOpsional(30),
});

export const ubahKategoriMisiSchema = z
  .object({
    nama: namaKategori.optional(),
    ringkas: teksUbah(200),
    prioritas: teksUbah(30),
    aktif: z.boolean().optional(),
    urutan: z.number().int().min(0).max(9999).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "Tidak ada yang diubah" });

/** Urutan baru: semua id kategori dari atas ke bawah. */
export const urutanKategoriMisiSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
});

export const pindahKategoriMisiSchema = z.object({ ke: kunciKategori });

/** Bukti misi dari portal (multipart → objek). hapusFoto = indeks foto lama yang dibuang, mis. "0,2". */
export const kirimMisiSchema = z.object({
  misiId: z.coerce.number().int().positive(),
  teks: teksOpsional(MAKS_TEKS_MISI),
  tautan: teksOpsional(500),
  hapusFoto: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 10) : [])),
});

export const putusMisiSchema = z
  .object({ aksi: z.enum(["setujui", "tolak"]), catatan: teksOpsional(2000) })
  .refine((d) => d.aksi !== "tolak" || !!d.catatan, { message: "Tulis apa yang perlu diperbaiki", path: ["catatan"] });

// ── Pantauan guru sekolah (11 Nov 2026) ──
const pinPantau = z.string().trim().regex(/^\d{6,8}$/, "PIN harus 6–8 angka");

export const buatPantauSchema = z.object({
  sekolahKunci: z.string().trim().min(1, "Pilih sekolah").max(150),
  pin: pinPantau,
  kedaluwarsa: ymd.nullable().optional(),
  tampilLampiranIzin: z.boolean().default(false),
});

export const ubahPantauSchema = z
  .object({
    pin: pinPantau.optional(),
    kedaluwarsa: ymd.nullable().optional(),
    tampilLampiranIzin: z.boolean().optional(),
  })
  .refine((d) => d.pin !== undefined || d.kedaluwarsa !== undefined || d.tampilLampiranIzin !== undefined, { message: "Tidak ada yang diubah" });

export const gantiPantauSchema = z.object({ pin: pinPantau.optional() });

export const masukPantauSchema = z.object({ pin: z.string().trim().min(1, "Masukkan PIN").max(20) });
