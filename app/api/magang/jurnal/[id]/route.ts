import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { cekJurnalSchema } from "@/lib/validators/magang";
import { idPengguna } from "@/lib/services/reimbursement/service";

type Ctx = { params: Promise<{ id: string }> };

/** Pembimbing menandai jurnal sudah dicek (+ komentar opsional yang tampil di HP anak). */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const session = await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = cekJurnalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  if (!(await prisma.magangJurnal.findUnique({ where: { id }, select: { id: true } }))) return notFound("Jurnal tidak ditemukan.");
  await prisma.magangJurnal.update({
    where: { id },
    data: { komentar: parsed.data.komentar, dicekAt: new Date(), dicekOlehId: await idPengguna(session.user?.email), dicekOlehKaryawanId: null },
  });
  return json({ ok: true });
});
