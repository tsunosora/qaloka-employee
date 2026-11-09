import { prisma } from "@/lib/prisma";
import { requireManager, json, notFound, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Matikan tautan pendaftaran sekarang (pendaftar yang sudah masuk tidak terhapus). */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  if (!(await prisma.magangDaftar.findUnique({ where: { id }, select: { id: true } }))) return notFound("Tautan tidak ditemukan.");
  await prisma.magangDaftar.update({ where: { id }, data: { aktif: false } });
  return json({ ok: true });
});
