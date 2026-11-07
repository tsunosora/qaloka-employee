import { prisma } from "@/lib/prisma";
import { requireManager, json, notFound, route } from "@/lib/http";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { hariKerja, kerajinan } from "@/lib/services/magang/jurnal";
import { serialisasiJurnal } from "@/lib/services/magang/jurnal-db";
import { hariIni, keYmd, serialisasiTugas } from "@/lib/services/magang/layanan";
import { seninDari } from "@/lib/services/magang/rotasi";
import { susunRapor } from "@/lib/services/magang/rapor";
import { namaUsaha } from "@/lib/services/upah/data";
import { namaPengurus } from "@/lib/services/magang/pembimbing";

type Ctx = { params: Promise<{ id: string }> };

/** Rapor satu anak magang: identitas, ringkasan per pos, nilai per aspek, dan semua tugasnya. */
export const GET = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const p = await prisma.magangPeserta.findUnique({
    where: { id },
    include: {
      employee: { select: { fullName: true, nickname: true } },
      penugasan: true,
      tugas: { orderBy: { senin: "asc" }, include: { pos: { select: { nama: true } }, dinilaiOleh: { select: { name: true } }, dinilaiOlehKaryawan: { select: { fullName: true, nickname: true } } } },
    },
  });
  if (!p) return notFound("Peserta tidak ditemukan.");
  const pos = await prisma.magangPos.findMany({
    select: { id: true, nama: true, deskripsi: true, pembimbing: { select: { fullName: true } } },
  });
  const tugas = p.tugas.map((t) => ({ ...serialisasiTugas(t), pos: t.pos?.nama ?? "(pos dihapus)", dinilaiOleh: namaPengurus(t.dinilaiOleh, t.dinilaiOlehKaryawan) }));
  const rapor = susunRapor({
    penugasan: p.penugasan.map(keYmd),
    tugas: tugas.map((t) => ({ ...t, praktik: t.praktik })),
    namaPos: new Map(pos.map((x) => [x.id, x.nama])),
    sampai: seninDari(hariIni()),
  });
  const infoPos = new Map(pos.map((x) => [x.id, { deskripsi: x.deskripsi, pembimbing: x.pembimbing?.fullName ?? null }]));

  // Kerajinan jurnal: hari kerja (Senin–Sabtu, tanpa libur nasional) dari mulai s.d. hari ini/selesai.
  const mulai = toYmd(p.mulai);
  const hari = hariIni();
  const sampai = p.selesai && toYmd(p.selesai) < hari ? toYmd(p.selesai) : hari;
  const [libur, jurnalBaris] = await Promise.all([
    sampai >= mulai ? prisma.holiday.findMany({ where: { date: { gte: atMidnight(mulai), lte: atMidnight(sampai) } }, select: { date: true } }) : [],
    prisma.magangJurnal.findMany({
      where: { pesertaId: p.id },
      orderBy: { tanggal: "desc" },
      include: { pos: { select: { nama: true } }, dicekOleh: { select: { name: true } }, dicekOlehKaryawan: { select: { fullName: true, nickname: true } } },
    }),
  ]);
  const hariKerjaList = sampai >= mulai ? hariKerja(mulai, sampai, new Set(libur.map((l) => toYmd(l.date)))) : [];
  const jurnal = kerajinan(jurnalBaris.map((j) => toYmd(j.tanggal)), hariKerjaList);

  return json({
    // Kop rapor (rapor dipakai untuk sekolah & melamar kerja → tempat magangnya harus tertulis).
    usaha: await namaUsaha(),
    jurnal,
    daftarJurnal: jurnalBaris.map((j) => ({
      ...serialisasiJurnal(j),
      pesertaId: p.id,
      nama: p.employee.nickname || p.employee.fullName,
      dicekOleh: namaPengurus(j.dicekOleh, j.dicekOlehKaryawan),
    })),
    peserta: {
      id: p.id,
      nama: p.employee.fullName,
      panggilan: p.employee.nickname,
      sekolah: p.sekolah,
      jurusan: p.jurusan,
      mulai: toYmd(p.mulai),
      selesai: p.selesai ? toYmd(p.selesai) : null,
      catatan: p.catatan,
    },
    rapor: { ...rapor, baris: rapor.baris.map((b) => ({ ...b, ...(infoPos.get(b.posId) ?? { deskripsi: null, pembimbing: null }) })) },
    tugas,
  });
});
