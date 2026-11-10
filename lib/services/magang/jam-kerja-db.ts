/**
 * Jam kerja khusus anak magang — bagian ber-DB (memuat baris). Aturan: ./jam-kerja.ts.
 * Dipakai semua jalur absensi (laporan/portal/pantau lewat aggregateAttendance, simpan status, input manual, impor,
 * baris tidak komplit) lewat muatPetaJamMagang — SEKALI per permintaan.
 */
import type { PrismaClient } from "@prisma/client";
import { toYmd } from "@/lib/services/leave/service";
import type { PetaJamMagang } from "@/lib/services/attendance/jam-magang";
import { buatPetaJamMagang, type JamSekolahBaris, type PesertaJamBaris } from "./jam-kerja";

type Db = Pick<PrismaClient, "magangPeserta" | "magangJamSekolah">;

/** Semua peserta (karyawan tidak dihapus) + semua jam sekolah. employeeIds = batasi peserta ke karyawan ini. */
export async function muatBarisJam(db: Db, employeeIds?: readonly number[]): Promise<{ peserta: PesertaJamBaris[]; sekolah: JamSekolahBaris[] }> {
  const [peserta, sekolah] = await Promise.all([
    db.magangPeserta.findMany({
      where: { employee: { deletedAt: null }, ...(employeeIds ? { employeeId: { in: [...employeeIds] } } : {}) },
      select: {
        id: true,
        employeeId: true,
        sekolah: true,
        mulai: true,
        selesai: true,
        aktif: true,
        jamMasuk: true,
        jamPulang: true,
        toleransiMenit: true,
        employee: { select: { isActive: true } },
      },
      orderBy: { id: "asc" },
    }),
    db.magangJamSekolah.findMany({
      select: { sekolahKunci: true, sekolahLabel: true, jamMasuk: true, jamPulang: true, toleransiMenit: true },
      orderBy: { sekolahLabel: "asc" },
    }),
  ]);
  return {
    peserta: peserta.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      sekolah: p.sekolah,
      mulai: toYmd(p.mulai),
      selesai: p.selesai ? toYmd(p.selesai) : null,
      aktif: p.aktif,
      karyawanAktif: p.employee.isActive,
      jamMasuk: p.jamMasuk,
      jamPulang: p.jamPulang,
      toleransiMenit: p.toleransiMenit,
    })),
    sekolah,
  };
}

/** Peta jam magang untuk karyawan ini (atau semua). toleransiUmum = ShiftConfig.lateToleranceMinutes. */
export async function muatPetaJamMagang(db: Db, toleransiUmum: number, employeeIds?: readonly number[]): Promise<PetaJamMagang> {
  if (employeeIds && employeeIds.length === 0) return buatPetaJamMagang([], [], toleransiUmum);
  const { peserta, sekolah } = await muatBarisJam(db, employeeIds);
  return buatPetaJamMagang(peserta, sekolah, toleransiUmum);
}
