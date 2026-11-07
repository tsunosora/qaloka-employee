import { prisma } from "@/lib/prisma";
import { json, badRequest, route } from "@/lib/http";
import { cekJurnalMassalSchema } from "@/lib/validators/magang";
import { requireBimbingan } from "@/lib/services/magang/pembimbing-db";
import { jurnalBolehDicek } from "@/lib/services/magang/pembimbing";

type Ctx = { params: Promise<{ token: string }> };

/**
 * PORTAL (pembimbingnya sendiri; mode owner = 403) — tandai banyak jurnal sekaligus. Hanya jurnal di pos
 * yang dia bimbing & belum dicek; sisanya dilewati. Balikan: jumlah yang benar-benar ditandai.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const { employee, posIds } = await requireBimbingan(token, req, { tulis: true });
  const parsed = cekJurnalMassalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const calon = await prisma.magangJurnal.findMany({
    where: { id: { in: parsed.data.ids } },
    select: { id: true, posId: true, dicekAt: true },
  });
  const ids = jurnalBolehDicek(calon, posIds);
  if (ids.length === 0) return json({ jumlah: 0 });
  // Syarat diulang di WHERE supaya jurnal yang baru saja dicek dari dasbor tidak tertimpa.
  const r = await prisma.magangJurnal.updateMany({
    where: { id: { in: ids }, posId: { in: posIds }, dicekAt: null },
    data: { komentar: parsed.data.komentar, dicekAt: new Date(), dicekOlehId: null, dicekOlehKaryawanId: employee.id },
  });
  return json({ jumlah: r.count });
});
