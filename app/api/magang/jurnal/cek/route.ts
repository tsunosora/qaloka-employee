import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { cekJurnalMassalSchema } from "@/lib/validators/magang";
import { idPengguna } from "@/lib/services/reimbursement/service";

/**
 * Tandai banyak jurnal sudah dicek sekaligus ("Tandai semua" per anak di Minggu Ini). Jurnal yang sudah
 * dicek dilewati (komentar & pengeceknya tidak ditimpa). Balikan: jumlah yang benar-benar ditandai.
 */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = cekJurnalMassalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const r = await prisma.magangJurnal.updateMany({
    where: { id: { in: parsed.data.ids }, dicekAt: null },
    data: { komentar: parsed.data.komentar, dicekAt: new Date(), dicekOlehId: await idPengguna(session.user?.email), dicekOlehKaryawanId: null },
  });
  return json({ jumlah: r.count });
});
