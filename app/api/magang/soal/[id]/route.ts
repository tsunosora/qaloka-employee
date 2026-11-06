import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { soalSchema } from "@/lib/validators/magang";
import { soalDariBaris } from "@/lib/services/magang/layanan";

type Ctx = { params: Promise<{ id: string }> };

/** Menyunting soal tidak mengubah tugas yang sudah dikerjakan — tugas menyimpan salinan soalnya. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = soalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  if (!(await prisma.magangSoal.findUnique({ where: { id } }))) return notFound("Soal tidak ditemukan.");
  const soal = await prisma.magangSoal.update({ where: { id }, data: parsed.data });
  return json({ ...soalDariBaris(soal), aktif: soal.aktif });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  if (!(await prisma.magangSoal.findUnique({ where: { id } }))) return notFound("Soal tidak ditemukan.");
  await prisma.magangSoal.delete({ where: { id } });
  return json({ ok: true });
});
