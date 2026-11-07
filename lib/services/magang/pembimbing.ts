/**
 * Pembimbing pos magang bekerja dari halaman pribadinya sendiri (/me/<token>) — menilai tugas
 * mingguan & mengecek jurnal harian anak di POS YANG DIA BIMBING saja, tanpa login dashboard
 * (yang membuka seluruh data HR). Aturan cakupannya di sini, MURNI, supaya bisa diuji.
 */
import { penugasanPada, mingguKe } from "./rotasi";

export type PosBimbingan = { id: number; pembimbingId: number | null; aktif: boolean; deletedAt: Date | string | null };

/** Id pos yang dibimbing karyawan ini: dia pembimbingnya, pos aktif & tidak dihapus. */
export function posMilik(pos: readonly PosBimbingan[], employeeId: number): number[] {
  return pos.filter((p) => p.pembimbingId === employeeId && p.aktif && !p.deletedAt).map((p) => p.id);
}

/** Boleh mengurus (menilai/mengecek/melihat foto) baris dengan posId ini? Tanpa pos = tidak. */
export function bolehUrus(posId: number | null | undefined, posIds: readonly number[]): boolean {
  return posId != null && posIds.includes(posId);
}

/** Id jurnal yang boleh ditandai massal: pos miliknya DAN belum dicek (yang lain dilewati diam-diam). */
export function jurnalBolehDicek(jurnal: readonly { id: number; posId: number | null; dicekAt: Date | string | null }[], posIds: readonly number[]): number[] {
  return jurnal.filter((j) => !j.dicekAt && bolehUrus(j.posId, posIds)).map((j) => j.id);
}

/** Anak yang penugasan MINGGU INI (Senin `senin`) ada di salah satu pos milik pembimbing. */
export function anakDiPos<P extends { posId: number; mulai: string; minggu: number }>(
  peserta: readonly { pesertaId: number; nama: string; penugasan: readonly P[] }[],
  posIds: readonly number[],
  senin: string
): { pesertaId: number; nama: string; posId: number; mingguKe: number; dari: number }[] {
  const hasil: { pesertaId: number; nama: string; posId: number; mingguKe: number; dari: number }[] = [];
  for (const p of peserta) {
    const a = penugasanPada(p.penugasan, senin);
    if (a && bolehUrus(a.posId, posIds)) hasil.push({ pesertaId: p.pesertaId, nama: p.nama, posId: a.posId, mingguKe: mingguKe(a, senin), dari: a.minggu });
  }
  return hasil.sort((x, y) => x.nama.localeCompare(y.nama, "id"));
}
