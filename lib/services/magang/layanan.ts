import type { Prisma, PrismaClient } from "@prisma/client";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { susunRotasi, seninDari, tambahMinggu, penugasanPada, mingguKe, type PenugasanAda } from "./rotasi";
import { keadaanJendela, jendelaTugas, nilaiMinggu, pilihSoal, normalHariTugas, HARI_TUGAS_BAWAAN, KUNCI_HARI_TUGAS, type JawabanKuis, type SoalBank } from "./nilai";

type Db = PrismaClient | Prisma.TransactionClient;

export function hariIni(): string {
  return toYmd(new Date());
}

/** Setelan hari tugas mengingat (Setting `magang_hari_tugas`, 1=Senin … 6=Sabtu; bawaan Jumat). */
export async function hariTugasMagang(db: Db): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: KUNCI_HARI_TUGAS }, select: { value: true } });
  return normalHariTugas(row?.value);
}

export type PenugasanYmd = { id: number; pesertaId: number; posId: number; mulai: string; minggu: number; berbagi: boolean };

export function keYmd(p: { id: number; pesertaId: number; posId: number; mulai: Date; minggu: number; berbagi: boolean }): PenugasanYmd {
  return { id: p.id, pesertaId: p.pesertaId, posId: p.posId, mulai: toYmd(p.mulai), minggu: p.minggu, berbagi: p.berbagi };
}

/**
 * Susun ulang rotasi mulai Senin minggu `dari`.
 * - mode "semua": penugasan yang MULAI sebelum `dari` dipertahankan (riwayat + yang sedang berjalan);
 *   yang mulai ≥ dari dihapus lalu disusun lagi untuk semua peserta aktif.
 * - mode "baru": hanya `pesertaIds` (atau, bila kosong, peserta aktif yang belum punya jadwal sejak
 *   `dari`) yang disusun. Jadwal anak lain — termasuk yang sesudah `dari` — TIDAK disentuh dan ikut
 *   dihitung sebagai isi pos. Untuk rombongan baru yang masuk di tengah program.
 * Tugas mingguan tidak terhubung ke baris penugasan, jadi tidak ada nilai yang hilang.
 */
export async function susunUlang(
  db: PrismaClient,
  dariInput: string,
  opsi: { mode?: "semua" | "baru"; pesertaIds?: readonly number[] } = {}
): Promise<{ dibuat: number; dari: string; disusun: number }> {
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
  const semuaPen = (await db.magangPenugasan.findMany({ where: { pesertaId: { in: ids } } })).map(keYmd);

  const target = opsi.mode === "baru" ? pilihTargetBaru(ids, semuaPen, dari, opsi.pesertaIds) : ids;
  if (target.length === 0) return { dibuat: 0, dari, disusun: 0 };
  const targetSet = new Set(target);
  // Dipertahankan: semua jadwal anak non-target + jadwal target yang mulai sebelum `dari`.
  const ada = semuaPen.filter((a) => !targetSet.has(a.pesertaId) || a.mulai < dari);

  const baru = susunRotasi({
    pos,
    peserta: peserta.map((p) => ({ id: p.id, mulai: toYmd(p.mulai), selesai: p.selesai ? toYmd(p.selesai) : null })),
    ada: ada as PenugasanAda[],
    dari,
    hanya: opsi.mode === "baru" ? target : undefined,
  });

  await db.$transaction([
    db.magangPenugasan.deleteMany({ where: { pesertaId: { in: target }, mulai: { gte: atMidnight(dari) } } }),
    db.magangPenugasan.createMany({
      data: baru.map((b) => ({ pesertaId: b.pesertaId, posId: b.posId, mulai: atMidnight(b.mulai), minggu: b.minggu, berbagi: b.berbagi })),
    }),
  ]);
  return { dibuat: baru.length, dari, disusun: target.length };
}

/**
 * Peserta yang disusun pada mode "baru": `diminta` (yang aktif saja) bila diisi; bila tidak, peserta
 * aktif yang TIDAK punya penugasan apa pun yang masih berjalan pada/sesudah minggu `dari`. MURNI.
 */
export function pilihTargetBaru(
  aktif: readonly number[],
  penugasan: readonly { pesertaId: number; mulai: string; minggu: number }[],
  dari: string,
  diminta?: readonly number[]
): number[] {
  if (diminta && diminta.length) return aktif.filter((id) => diminta.includes(id));
  const punya = new Set(penugasan.filter((a) => tambahMinggu(a.mulai, a.minggu) > dari).map((a) => a.pesertaId));
  return aktif.filter((id) => !punya.has(id));
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
 * Minggu-minggu yang tugasnya bisa/harus diisi anak hari ini: minggu ini (bila sudah hari tugas) dan
 * minggu-minggu lalu dalam masa magangnya yang belum diisi (terlambat). Paling lama dulu.
 */
export function mingguTugas(penugasan: readonly PenugasanYmd[], sudahDiisi: ReadonlySet<string>, hari: string, hariTugas: number = HARI_TUGAS_BAWAAN, maks = 4): string[] {
  const seninIni = seninDari(hari);
  const semua: string[] = [];
  for (const a of penugasan) for (let k = 0; k < a.minggu; k++) semua.push(tambahMinggu(a.mulai, k));
  return [...new Set(semua)]
    .filter((s) => s <= seninIni && !sudahDiisi.has(s) && keadaanJendela(s, hari, hariTugas) !== "belum")
    .sort()
    .slice(-maks);
}

export { penugasanPada, mingguKe, jendelaTugas, keadaanJendela, seninDari };
