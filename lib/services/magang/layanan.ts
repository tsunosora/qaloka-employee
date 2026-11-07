import type { Prisma, PrismaClient } from "@prisma/client";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { susunRotasi, seninDari, tambahMinggu, penugasanPada, mingguKe, type PenugasanAda } from "./rotasi";
import { keadaanJendela, jendelaTugas, nilaiMinggu, pilihSoal, type JawabanKuis, type SoalBank } from "./nilai";

type Db = PrismaClient | Prisma.TransactionClient;

export function hariIni(): string {
  return toYmd(new Date());
}

export type PenugasanYmd = { id: number; pesertaId: number; posId: number; mulai: string; minggu: number; berbagi: boolean };

export function keYmd(p: { id: number; pesertaId: number; posId: number; mulai: Date; minggu: number; berbagi: boolean }): PenugasanYmd {
  return { id: p.id, pesertaId: p.pesertaId, posId: p.posId, mulai: toYmd(p.mulai), minggu: p.minggu, berbagi: p.berbagi };
}

/**
 * Susun ulang rotasi mulai Senin minggu `dari`. Penugasan yang MULAI sebelum `dari` dipertahankan
 * (riwayat + yang sedang berjalan); yang mulai ≥ dari dihapus lalu disusun lagi. Tugas mingguan
 * tidak terhubung ke baris penugasan, jadi tidak ada nilai yang hilang.
 */
export async function susunUlang(db: PrismaClient, dariInput: string): Promise<{ dibuat: number; dari: string }> {
  const dari = seninDari(dariInput);
  const [peserta, pos] = await Promise.all([
    db.magangPeserta.findMany({
      where: { aktif: true, employee: { deletedAt: null, isActive: true } },
      select: { id: true, mulai: true, selesai: true },
    }),
    db.magangPos.findMany({
      where: { aktif: true, deletedAt: null },
      orderBy: [{ urutan: "asc" }, { id: "asc" }],
      select: { id: true, durasiMinggu: true, kapasitas: true },
    }),
  ]);
  const ids = peserta.map((p) => p.id);
  const ada = (
    await db.magangPenugasan.findMany({
      where: { pesertaId: { in: ids }, mulai: { lt: atMidnight(dari) } },
    })
  ).map(keYmd);

  const baru = susunRotasi({
    pos,
    peserta: peserta.map((p) => ({ id: p.id, mulai: toYmd(p.mulai), selesai: p.selesai ? toYmd(p.selesai) : null })),
    ada: ada as PenugasanAda[],
    dari,
  });

  await db.$transaction([
    db.magangPenugasan.deleteMany({ where: { pesertaId: { in: ids }, mulai: { gte: atMidnight(dari) } } }),
    db.magangPenugasan.createMany({
      data: baru.map((b) => ({ pesertaId: b.pesertaId, posId: b.posId, mulai: atMidnight(b.mulai), minggu: b.minggu, berbagi: b.berbagi })),
    }),
  ]);
  return { dibuat: baru.length, dari };
}

export function soalDariBaris(s: { id: number; pertanyaan: string; pilihan: Prisma.JsonValue; benar: number }): SoalBank {
  const pilihan = Array.isArray(s.pilihan) ? s.pilihan.map((x) => String(x)) : [];
  return { id: s.id, pertanyaan: s.pertanyaan, pilihan, benar: s.benar };
}

/** Bank soal aktif suatu pos yang SAH (punya ≥2 pilihan & kunci di dalam rentang). */
export async function bankSoal(db: Db, posId: number): Promise<SoalBank[]> {
  const baris = await db.magangSoal.findMany({ where: { posId, aktif: true }, orderBy: { id: "asc" } });
  return baris.map(soalDariBaris).filter((s) => s.pilihan.length >= 2 && s.benar >= 0 && s.benar < s.pilihan.length);
}

/** Soal yang diberikan ke anak untuk minggu itu (tetap, lihat pilihSoal). */
export async function soalMinggu(db: Db, pesertaId: number, posId: number, senin: string): Promise<SoalBank[]> {
  return pilihSoal(await bankSoal(db, posId), pesertaId, senin);
}

export function serialisasiTugas(t: {
  id: number;
  senin: Date;
  posId: number | null;
  ingatan: string;
  jawabanKuis: Prisma.JsonValue;
  skorKuis: number | null;
  terlambat: boolean;
  dikirimAt: Date;
  nilaiIngatan: number | null;
  ketelitian: number | null;
  kecepatan: number | null;
  inisiatif: number | null;
  sikap: number | null;
  nilai: number | null;
  catatanPembimbing: string | null;
  dinilaiAt: Date | null;
}) {
  return {
    id: t.id,
    senin: toYmd(t.senin),
    posId: t.posId,
    ingatan: t.ingatan,
    kuis: (Array.isArray(t.jawabanKuis) ? t.jawabanKuis : []) as unknown as JawabanKuis[],
    skorKuis: t.skorKuis,
    terlambat: t.terlambat,
    dikirimAt: t.dikirimAt.toISOString(),
    nilaiIngatan: t.nilaiIngatan,
    praktik: { ketelitian: t.ketelitian, kecepatan: t.kecepatan, inisiatif: t.inisiatif, sikap: t.sikap },
    nilai: t.nilai,
    catatanPembimbing: t.catatanPembimbing,
    dinilaiAt: t.dinilaiAt?.toISOString() ?? null,
  };
}
export type TugasTampil = ReturnType<typeof serialisasiTugas>;

/** Hitung ulang kolom `nilai` dari isinya (dipanggil saat pembimbing menilai). */
export function hitungNilai(t: {
  skorKuis: number | null;
  nilaiIngatan: number | null;
  ketelitian: number | null;
  kecepatan: number | null;
  inisiatif: number | null;
  sikap: number | null;
}): number | null {
  return nilaiMinggu({
    skorKuis: t.skorKuis,
    nilaiIngatan: t.nilaiIngatan,
    praktik: { ketelitian: t.ketelitian, kecepatan: t.kecepatan, inisiatif: t.inisiatif, sikap: t.sikap },
  });
}

/**
 * Kolom yang disimpan saat pembimbing menilai satu tugas (dasbor maupun halaman pribadi pembimbing):
 * isian rubrik + nilai yang dihitung ulang di server + waktu dinilai. Siapa penilainya ditambah pemanggil.
 */
export function dataPenilaian(
  skorKuis: number | null,
  d: { nilaiIngatan: number; ketelitian: number; kecepatan: number; inisiatif: number; sikap: number; catatanPembimbing: string | null }
) {
  return { ...d, nilai: hitungNilai({ skorKuis, ...d }), dinilaiAt: new Date() };
}

/**
 * Minggu-minggu yang tugasnya bisa/harus diisi anak hari ini: minggu ini (bila sudah Jumat) dan
 * minggu-minggu lalu dalam masa magangnya yang belum diisi (terlambat). Paling lama dulu.
 */
export function mingguTugas(penugasan: readonly PenugasanYmd[], sudahDiisi: ReadonlySet<string>, hari: string, maks = 4): string[] {
  const seninIni = seninDari(hari);
  const semua: string[] = [];
  for (const a of penugasan) for (let k = 0; k < a.minggu; k++) semua.push(tambahMinggu(a.mulai, k));
  return [...new Set(semua)]
    .filter((s) => s <= seninIni && !sudahDiisi.has(s) && keadaanJendela(s, hari) !== "belum")
    .sort()
    .slice(-maks);
}

export { penugasanPada, mingguKe, jendelaTugas, keadaanJendela, seninDari };
