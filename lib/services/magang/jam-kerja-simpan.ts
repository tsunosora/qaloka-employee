/**
 * Jam kerja khusus anak magang — data untuk dasbor + hitung ulang absensi tersimpan sesudah jam diubah.
 * Hitung ulang HANYA menyentuh karyawan peserta magang yang terdampak (anak sekolah itu / anak itu sendiri), mulai dari
 * tanggal mulai magangnya tapi paling jauh 62 hari ke belakang. Tanpa transaksi & tanpa DDL (UPDATE per baris).
 */
import type { PrismaClient } from "@prisma/client";
import { loadShiftConfig } from "@/lib/services/attendance/shift";
import { rencanaStatusTersimpan, terapkanPerubahan } from "@/lib/services/attendance/recompute";
import type { PetaJamMagang } from "@/lib/services/attendance/jam-magang";
import { atMidnight } from "@/lib/services/leave/service";
import { hariIni } from "./layanan";
import { daftarSekolah, kunciSekolah } from "./sekolah";
import { muatBarisJam } from "./jam-kerja-db";
import {
  awalHitungUlang,
  buatPetaJamMagang,
  jamEfektifPeserta,
  petaJamSekolah,
  ringkasPerubahan,
  type JamSekolahBaris,
  type PesertaJamBaris,
} from "./jam-kerja";
import { labelJamKerja } from "@/lib/services/attendance/jam-magang";

export type HasilHitungUlang = {
  /** true = pratinjau (tidak ada yang ditulis). */
  pratinjau: boolean;
  barisBerubah: number;
  anak: { pesertaId: number; employeeId: number; dari: string; baris: number; berubah: number; terlambatSebelum: number; terlambatSesudah: number }[];
};

/**
 * Hitung ulang absensi tersimpan untuk peserta ini. `peta` diisi = PRATINJAU dengan jam yang belum disimpan
 * (tidak menulis); kosong = jam di DB dipakai dan hasilnya DITULIS.
 */
export async function hitungUlangPeserta(
  prisma: PrismaClient,
  peserta: readonly Pick<PesertaJamBaris, "id" | "employeeId" | "mulai">[],
  opsi: { peta?: PetaJamMagang; hariIni?: string } = {}
): Promise<HasilHitungUlang> {
  const hari = opsi.hariIni ?? hariIni();
  const hasil: HasilHitungUlang = { pratinjau: !!opsi.peta, barisBerubah: 0, anak: [] };
  for (const p of peserta) {
    const dari = awalHitungUlang(p.mulai, hari);
    const { rows, perubahan } = await rencanaStatusTersimpan(prisma, { employeeIds: [p.employeeId], from: atMidnight(dari), jamMagang: opsi.peta });
    if (!opsi.peta) await terapkanPerubahan(prisma, perubahan);
    const r = ringkasPerubahan(rows, perubahan).get(p.employeeId) ?? { baris: 0, berubah: 0, terlambatSebelum: 0, terlambatSesudah: 0 };
    hasil.barisBerubah += perubahan.length;
    hasil.anak.push({ pesertaId: p.id, employeeId: p.employeeId, dari, ...r });
  }
  return hasil;
}

/** Peta jam dari baris (mungkin sudah diubah di memori untuk pratinjau). */
export async function petaDari(peserta: readonly PesertaJamBaris[], sekolah: readonly JamSekolahBaris[]): Promise<PetaJamMagang> {
  const cfg = await loadShiftConfig();
  return buatPetaJamMagang(peserta, sekolah, cfg.lateToleranceMinutes);
}

/** Data halaman: sekolah (dari tulisan sekolah peserta + baris jam yang ada) dan peserta dengan jam efektifnya. */
export async function dataJamKerja(prisma: PrismaClient) {
  const [{ peserta, sekolah }, cfg, nama] = await Promise.all([
    muatBarisJam(prisma),
    loadShiftConfig(),
    prisma.magangPeserta.findMany({
      where: { employee: { deletedAt: null } },
      select: { id: true, employee: { select: { fullName: true, nickname: true } } },
    }),
  ]);
  const namaPer = new Map(nama.map((n) => [n.id, n.employee]));
  const ps = petaJamSekolah(sekolah);
  const kelompok = daftarSekolah(peserta.map((p) => p.sekolah));
  const kunciAda = new Set(kelompok.map((k) => k.kunci));
  const keJam = (j: JamSekolahBaris | undefined) =>
    j ? { jamMasuk: j.jamMasuk, jamPulang: j.jamPulang, toleransiMenit: j.toleransiMenit, label: labelJamKerja(j.jamMasuk, j.jamPulang) } : null;
  return {
    toleransiUmum: cfg.lateToleranceMinutes,
    jamToko: { masuk: cfg.storeOpen, pulang: cfg.morningEnd },
    sekolah: [
      ...kelompok.map((k) => ({ kunci: k.kunci, label: k.label, jumlah: k.jumlah, jam: keJam(ps.get(k.kunci)) })),
      // Jam sekolah yang anaknya sudah tidak ada (tulisan sekolah diganti) — tetap tampil supaya bisa dihapus.
      ...sekolah.filter((s) => !kunciAda.has(kunciSekolah(s.sekolahKunci))).map((s) => ({ kunci: kunciSekolah(s.sekolahKunci), label: s.sekolahLabel, jumlah: 0, jam: keJam(s) })),
    ],
    peserta: peserta.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      nama: namaPer.get(p.id)?.fullName ?? "",
      panggilan: namaPer.get(p.id)?.nickname ?? null,
      sekolah: p.sekolah,
      sekolahKunci: kunciSekolah(p.sekolah),
      aktif: p.aktif && p.karyawanAktif !== false,
      mulai: p.mulai,
      selesai: p.selesai,
      jamMasuk: p.jamMasuk,
      jamPulang: p.jamPulang,
      toleransiMenit: p.toleransiMenit,
      efektif: jamEfektifPeserta(p, ps),
    })),
  };
}
