import { prisma } from "@/lib/prisma";
import { requireManager, json, notFound, route } from "@/lib/http";
import { toYmd } from "@/lib/services/leave/service";
import { hariIni, keYmd, serialisasiTugas } from "@/lib/services/magang/layanan";
import { seninDari } from "@/lib/services/magang/rotasi";
import { susunRapor } from "@/lib/services/magang/rapor";

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
      tugas: { orderBy: { senin: "asc" }, include: { pos: { select: { nama: true } }, dinilaiOleh: { select: { name: true } } } },
    },
  });
  if (!p) return notFound("Peserta tidak ditemukan.");
  const pos = await prisma.magangPos.findMany({
    select: { id: true, nama: true, deskripsi: true, pembimbing: { select: { fullName: true } } },
  });
  const tugas = p.tugas.map((t) => ({ ...serialisasiTugas(t), pos: t.pos?.nama ?? "(pos dihapus)", dinilaiOleh: t.dinilaiOleh?.name ?? null }));
  const rapor = susunRapor({
    penugasan: p.penugasan.map(keYmd),
    tugas: tugas.map((t) => ({ ...t, praktik: t.praktik })),
    namaPos: new Map(pos.map((x) => [x.id, x.nama])),
    sampai: seninDari(hariIni()),
  });
  const infoPos = new Map(pos.map((x) => [x.id, { deskripsi: x.deskripsi, pembimbing: x.pembimbing?.fullName ?? null }]));
  return json({
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
