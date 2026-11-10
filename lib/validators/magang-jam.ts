import { z } from "zod";
import { POLA_JAM, TOLERANSI_MAKS, urutanJamSah } from "@/lib/services/magang/jam-kerja";

/**
 * Validasi jam kerja khusus anak magang. Skema UBAH tanpa .default() dan tanpa mengubah "tidak dikirim" menjadi null —
 * route menulis hanya kunci yang dikirim (tanpaUndefined).
 */

const jam = z.string().regex(POLA_JAM, "Format jam HH:MM (00:00–23:59)");
const toleransi = z.number().int().min(0, "Toleransi tidak boleh negatif").max(TOLERANSI_MAKS, `Toleransi paling lama ${TOLERANSI_MAKS} menit`);

/** PUT jam sekolah. toleransiMenit: tidak dikirim = tetap (baris baru: null = toleransi umum); null = toleransi umum. */
export const jamSekolahSchema = z
  .object({
    sekolahKunci: z.string().trim().min(1).max(150),
    jamMasuk: jam,
    jamPulang: jam,
    toleransiMenit: toleransi.nullable().optional(),
  })
  .strict()
  .refine((d) => urutanJamSah(d.jamMasuk, d.jamPulang), { message: "Jam masuk harus sebelum jam pulang", path: ["jamPulang"] });

/** PATCH jam khusus satu anak: hanya kunci yang dikirim ditulis; null = ikut sekolah. */
export const ubahJamPesertaSchema = z
  .object({
    jamMasuk: jam.nullable().optional(),
    jamPulang: jam.nullable().optional(),
    toleransiMenit: toleransi.nullable().optional(),
  })
  .strict()
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "Tidak ada yang diubah" });
