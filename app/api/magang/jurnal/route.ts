import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, route } from "@/lib/http";
import { serialisasiJurnal } from "@/lib/services/magang/jurnal-db";

/** Jurnal harian anak magang. ?status=belum (belum dicek, bawaan) | semua; ?pesertaId= */
export const GET = route(async (req: Request) => {
  await requireManager();
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") ?? "belum";
  const pesertaId = Number(sp.get("pesertaId") ?? "") || null;
  const where: Prisma.MagangJurnalWhereInput = {
    ...(status === "belum" ? { dicekAt: null } : {}),
    ...(pesertaId ? { pesertaId } : {}),
    peserta: { employee: { deletedAt: null } },
  };
  const items = await prisma.magangJurnal.findMany({
    where,
    orderBy: [{ tanggal: "desc" }, { id: "desc" }],
    take: 100,
    include: {
      pos: { select: { nama: true } },
      peserta: { include: { employee: { select: { fullName: true, nickname: true } } } },
      dicekOleh: { select: { name: true } },
    },
  });
  return json({
    items: items.map((j) => ({
      ...serialisasiJurnal(j),
      pesertaId: j.pesertaId,
      posId: j.posId,
      nama: j.peserta.employee.nickname || j.peserta.employee.fullName,
      dicekOleh: j.dicekOleh?.name ?? null,
    })),
    belumDicek: await prisma.magangJurnal.count({ where: { dicekAt: null } }),
  });
});
