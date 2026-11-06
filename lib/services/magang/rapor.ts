/**
 * Rapor magang: ringkasan per pos & keseluruhan dari penugasan + tugas mingguan. MURNI.
 * Dipakai halaman rapor (dicetak untuk lampiran sertifikat / bekal melamar kerja).
 */
import { ASPEK_PRAKTIK, predikat, type AspekKey } from "./nilai";
import { tambahMinggu } from "./rotasi";

type Penugasan = { posId: number; mulai: string; minggu: number };
type Tugas = {
  senin: string;
  posId: number | null;
  skorKuis: number | null;
  nilai: number | null;
  nilaiIngatan: number | null;
  praktik: Record<AspekKey, number | null>;
  terlambat: boolean;
};

export type BarisRapor = {
  posId: number;
  nama: string;
  mulai: string;
  minggu: number;
  tugasDikirim: number;
  nilai: number | null;
  predikat: string;
  praktik: Record<AspekKey, number | null>;
};

const rata = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, n) => s + n, 0) / xs.length) * 10) / 10 : null);

export function susunRapor(input: {
  penugasan: readonly Penugasan[];
  tugas: readonly Tugas[];
  namaPos: ReadonlyMap<number, string>;
  sampai: string; // Senin terakhir yang dihitung (minggu berjalan); penugasan mendatang tidak masuk
}) {
  const lalu = input.penugasan.filter((a) => a.mulai <= input.sampai).sort((a, b) => a.mulai.localeCompare(b.mulai));
  const baris: BarisRapor[] = lalu.map((a) => {
    const senin = Array.from({ length: a.minggu }, (_, k) => tambahMinggu(a.mulai, k));
    const milik = input.tugas.filter((t) => senin.includes(t.senin));
    const dinilai = milik.filter((t) => t.nilai != null);
    const praktik = Object.fromEntries(
      ASPEK_PRAKTIK.map((x) => [x.key, rata(dinilai.map((t) => t.praktik[x.key]).filter((n): n is number => n != null))])
    ) as Record<AspekKey, number | null>;
    const n = rata(dinilai.map((t) => t.nilai!));
    return {
      posId: a.posId,
      nama: input.namaPos.get(a.posId) ?? "(pos dihapus)",
      mulai: a.mulai,
      minggu: a.minggu,
      tugasDikirim: milik.length,
      nilai: n == null ? null : Math.round(n),
      predikat: predikat(n == null ? null : Math.round(n)),
      praktik,
    };
  });

  const semuaDinilai = input.tugas.filter((t) => t.nilai != null);
  const nilaiAkhir = rata(semuaDinilai.map((t) => t.nilai!));
  const mingguBerjalan = lalu.reduce((s, a) => s + a.minggu, 0);
  return {
    baris,
    nilaiAkhir: nilaiAkhir == null ? null : Math.round(nilaiAkhir),
    predikat: predikat(nilaiAkhir == null ? null : Math.round(nilaiAkhir)),
    praktik: Object.fromEntries(
      ASPEK_PRAKTIK.map((x) => [x.key, rata(semuaDinilai.map((t) => t.praktik[x.key]).filter((n): n is number => n != null))])
    ) as Record<AspekKey, number | null>,
    rataKuis: rata(input.tugas.map((t) => t.skorKuis).filter((n): n is number => n != null)),
    tugasDikirim: input.tugas.length,
    tugasTerlambat: input.tugas.filter((t) => t.terlambat).length,
    mingguBerjalan,
    jumlahPos: new Set(lalu.map((a) => a.posId)).size,
  };
}
