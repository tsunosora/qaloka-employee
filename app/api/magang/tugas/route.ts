import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, route } from "@/lib/http";
import { serialisasiTugas } from "@/lib/services/magang/layanan";

/** Tugas mingguan yang sudah dikirim anak. ?status=belum (belum dinilai, bawaan) | semua; ?pesertaId= */
export const GET = route(async (req: Request) => {
  await requireManager();
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") ?? "belum";
  const pesertaId = Number(sp.get("pesertaId") ?? "") || null;
  const where: Prisma.MagangTugasWhereInput = {
    ...(status === "belum" ? { dinilaiAt: null } : {}),
    ...(pesertaId ? { pesertaId } : {}),
  };
  const items = await prisma.magangTugas.findMany({
    where,
    orderBy: [{ senin: status === "belum" ? "asc" : "desc" }, { id: "asc" }],
    take: 100,
    include: {
      peserta: { include: { employee: { select: { fullName: true, nickname: true } } } },
      pos: { select: { nama: true } },
      dinilaiOleh: { select: { name: true } },
      dinilaiOlehKaryawan: { select: { fullName: true, nickname: true } },
    },
  });
  return json({
    items: items.map((t) => ({
      ...serialisasiTugas(t),
      pesertaId: t.pesertaId,
      posId: t.posId,
      nama: t.peserta.employee.nickname || t.peserta.employee.fullName,
      pos: t.pos?.nama ?? "(pos dihapus)",
      // Dinilai dari dasbor (akun) atau dari halaman pribadi pembimbing (karyawan).
      dinilaiOleh: t.dinilaiOleh?.name ?? (t.dinilaiOlehKaryawan ? t.dinilaiOlehKaryawan.nickname || t.dinilaiOlehKaryawan.fullName : null),
    })),
    belumDinilai: await prisma.magangTugas.count({ where: { dinilaiAt: null } }),
  });
});
