/**
 * Jam kerja khusus anak magang (15 Nov 2026) — aturan MURNI (tanpa DB).
 *
 * Kenapa bukan Jadwal Kerja (WorkSchedule) biasa: di mode shift otomatis (selalu aktif di laporan, simpan status,
 * input manual & impor) telat dihitung dari jam toko global (buka 08:00, akhir pagi 16:00) dan jadwal per-karyawan
 * diabaikan. Anak magang dari sekolah berbeda punya jam berbeda (mis. 09:00–17:00), jadi jamnya diatur di sini.
 *
 * Urutan: kolom anak (MagangPeserta.jamMasuk/jamPulang/toleransiMenit) → jam sekolahnya (MagangJamSekolah, dicocokkan
 * dengan kunciSekolah, tanpa peduli huruf besar/spasi) → tidak ada (aturan umum jam toko). Per kolom: jam masuk anak
 * boleh diisi sendiri sementara jam pulang ikut sekolah. Toleransi null = ikut sekolah → toleransi umum.
 * Berlaku HANYA untuk peserta aktif (peserta.aktif & karyawan aktif) pada tanggal di dalam masa magang (mulai..selesai);
 * di luar itu jam toko berlaku seperti karyawan biasa. Hari kerja tetap Senin–Sabtu (tidak diatur di sini).
 */
import { labelJamKerja, menitJam, type JamMagangHari, type PetaJamMagang } from "@/lib/services/attendance/jam-magang";
import { kunciSekolah } from "./sekolah";

export const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TOLERANSI_MAKS = 180;

export type JamSekolahBaris = {
  sekolahKunci: string;
  sekolahLabel: string;
  jamMasuk: string;
  jamPulang: string;
  toleransiMenit: number | null;
};

export type PesertaJamBaris = {
  id: number;
  employeeId: number;
  sekolah: string | null;
  mulai: string; // YYYY-MM-DD
  selesai: string | null;
  aktif: boolean;
  /** Employee.isActive; undefined = dianggap aktif. */
  karyawanAktif?: boolean;
  jamMasuk: string | null;
  jamPulang: string | null;
  toleransiMenit: number | null;
};

export type JamEfektif = {
  jamMasuk: string;
  jamPulang: string;
  /** null = toleransi umum. */
  toleransiMenit: number | null;
  /** "anak" = minimal satu kolom diisi khusus untuk anak ini; "sekolah" = semuanya dari jam sekolah. */
  sumber: "anak" | "sekolah";
  label: string;
};

export function jamSah(v: string | null | undefined): v is string {
  return typeof v === "string" && POLA_JAM.test(v);
}

/** Jam masuk harus sebelum jam pulang (shift malam lewat tengah malam tidak didukung). */
export function urutanJamSah(masuk: string, pulang: string): boolean {
  const a = menitJam(masuk);
  const b = menitJam(pulang);
  return a != null && b != null && a < b;
}

export function petaJamSekolah(baris: readonly JamSekolahBaris[]): Map<string, JamSekolahBaris> {
  return new Map(baris.map((b) => [kunciSekolah(b.sekolahKunci), b]));
}

/** Jam yang berlaku untuk anak ini (tanpa melihat tanggal/aktif). null = ikut aturan umum jam toko. */
export function jamEfektifPeserta(
  p: Pick<PesertaJamBaris, "sekolah" | "jamMasuk" | "jamPulang" | "toleransiMenit">,
  sekolah: ReadonlyMap<string, JamSekolahBaris>
): JamEfektif | null {
  const s = sekolah.get(kunciSekolah(p.sekolah)) ?? null;
  const jamMasuk = jamSah(p.jamMasuk) ? p.jamMasuk : s?.jamMasuk ?? null;
  const jamPulang = jamSah(p.jamPulang) ? p.jamPulang : s?.jamPulang ?? null;
  if (!jamSah(jamMasuk) || !jamSah(jamPulang) || !urutanJamSah(jamMasuk, jamPulang)) return null;
  const toleransiMenit = p.toleransiMenit ?? s?.toleransiMenit ?? null;
  const khusus = jamSah(p.jamMasuk) || jamSah(p.jamPulang) || p.toleransiMenit != null;
  return { jamMasuk, jamPulang, toleransiMenit, sumber: khusus ? "anak" : "sekolah", label: labelJamKerja(jamMasuk, jamPulang) };
}

/** Peserta aktif & tanggal di dalam masa magangnya. */
export function dalamMasa(p: Pick<PesertaJamBaris, "mulai" | "selesai" | "aktif" | "karyawanAktif">, ymd: string): boolean {
  if (!p.aktif || p.karyawanAktif === false) return false;
  if (ymd < p.mulai) return false;
  if (p.selesai && ymd > p.selesai) return false;
  return true;
}

/**
 * Peta (karyawan, tanggal) → jam magang untuk computeAttendanceRow. Dimuat SEKALI per permintaan.
 * Karyawan yang bukan peserta / tanpa jam / di luar masa → null (aturan umum, tak berubah).
 */
export function buatPetaJamMagang(
  peserta: readonly PesertaJamBaris[],
  sekolah: readonly JamSekolahBaris[],
  toleransiUmum: number
): PetaJamMagang {
  const ps = petaJamSekolah(sekolah);
  const per = new Map<number, { p: PesertaJamBaris; jam: JamEfektif }>();
  for (const p of peserta) {
    const jam = jamEfektifPeserta(p, ps);
    if (jam) per.set(p.employeeId, { p, jam });
  }
  return {
    employeeIds: [...per.keys()],
    get(employeeId: number, ymd: string): JamMagangHari | null {
      const x = per.get(employeeId);
      if (!x || !dalamMasa(x.p, ymd)) return null;
      return { jamMasuk: x.jam.jamMasuk, jamPulang: x.jam.jamPulang, toleransiMenit: x.jam.toleransiMenit ?? toleransiUmum };
    },
  };
}

/** Peserta sekolah ini (kunci tanpa peduli huruf besar/spasi). */
export function pesertaSekolahIni<T extends Pick<PesertaJamBaris, "sekolah">>(peserta: readonly T[], kunci: string): T[] {
  const k = kunciSekolah(kunci);
  return peserta.filter((p) => k !== "" && kunciSekolah(p.sekolah) === k);
}

/** YYYY-MM-DD dikurangi n hari (kalender lokal). */
export function kurangiHari(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(y, m - 1, d - n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Batas mundur hitung ulang absensi tersimpan sesudah jam diubah. */
export const HARI_HITUNG_ULANG = 62;

/** Hitung ulang dari mulai magang, tapi paling jauh 62 hari ke belakang. */
export function awalHitungUlang(mulai: string, hariIni: string, batasHari = HARI_HITUNG_ULANG): string {
  const batas = kurangiHari(hariIni, batasHari);
  return mulai > batas ? mulai : batas;
}

/** Ringkas rencana hitung ulang per karyawan: baris berubah + hari terlambat (scan masuk telat) sebelum → sesudah. */
export function ringkasPerubahan(
  rows: readonly { id: number; employeeId: number; scanType: string | null; lateMinutes: number }[],
  perubahan: readonly { id: number; sesudah: { lateMinutes: number } }[]
): Map<number, { baris: number; berubah: number; terlambatSebelum: number; terlambatSesudah: number }> {
  const baru = new Map(perubahan.map((p) => [p.id, p.sesudah.lateMinutes]));
  const out = new Map<number, { baris: number; berubah: number; terlambatSebelum: number; terlambatSesudah: number }>();
  for (const r of rows) {
    const x = out.get(r.employeeId) ?? { baris: 0, berubah: 0, terlambatSebelum: 0, terlambatSesudah: 0 };
    x.baris++;
    if (baru.has(r.id)) x.berubah++;
    if (r.scanType === "in") {
      if (r.lateMinutes > 0) x.terlambatSebelum++;
      if ((baru.get(r.id) ?? r.lateMinutes) > 0) x.terlambatSesudah++;
    }
    out.set(r.employeeId, x);
  }
  return out;
}
