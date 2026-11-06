import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { posSchema } from "@/lib/validators/magang";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = posSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const ada = await prisma.magangPos.findFirst({ where: { id, deletedAt: null } });
  if (!ada) return notFound("Pos tidak ditemukan.");
  const pos = await prisma.magangPos.update({ where: { id }, data: { ...parsed.data, pembimbingId: parsed.data.pembimbingId ?? null } });
  return json(pos);
});

/**
 * Hapus LUNAK: riwayat penugasan & nilai anak yang pernah memegang pos ini tetap utuh (rapor
 * masih menyebut namanya). Penugasan MENDATANG di pos ini dibuang — susun ulang rotasi sesudahnya.
 */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const ada = await prisma.magangPos.findFirst({ where: { id, deletedAt: null } });
  if (!ada) return notFound("Pos tidak ditemukan.");
  const senin = new Date();
  senin.setHours(0, 0, 0, 0);
  await prisma.$transaction([
    prisma.magangPos.update({ where: { id }, data: { deletedAt: new Date(), aktif: false } }),
    prisma.magangPenugasan.deleteMany({ where: { posId: id, mulai: { gt: senin } } }),
  ]);
  return json({ ok: true });
});
