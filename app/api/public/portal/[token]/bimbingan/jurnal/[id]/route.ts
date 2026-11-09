import { prisma } from "@/lib/prisma";
import { json, badRequest, notFound, route } from "@/lib/http";
import { cekJurnalSchema } from "@/lib/validators/magang";
import { requireBimbingan } from "@/lib/services/magang/pembimbing-db";
import { bolehUrus } from "@/lib/services/magang/pembimbing";

type Ctx = { params: Promise<{ token: string; id: string }> };

/** PORTAL (pembimbingnya sendiri; mode owner = 403) — tandai jurnal anak di posnya sudah dicek + komentar. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const { token, id: idTeks } = await ctx.params;
  const { employee, posIds } = await requireBimbingan(token, req, { tulis: true });
  const id = Number(idTeks) || 0;
  const parsed = cekJurnalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const j = await prisma.magangJurnal.findUnique({ where: { id }, select: { posId: true } });
  if (!j || !bolehUrus(j.posId, posIds)) return notFound("Jurnal tidak ditemukan.");
  await prisma.magangJurnal.update({
    where: { id },
    data: { komentar: parsed.data.komentar, dicekAt: new Date(), dicekOlehId: null, dicekOlehKaryawanId: employee.id },
  });
  return json({ ok: true });
});
