import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { rentangBulan } from "@/lib/services/magang/konten-db";
import { bulanSchema } from "@/lib/validators/magang-konten";

const schema = z.object({ bulan: bulanSchema, platformId: z.number().int().positive().optional() });

/** "Setujui semua usulan" satu bulan (satu platform bila platformId dikirim, selain itu semua platform). */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { bulan, platformId } = parsed.data;
  const r = await prisma.magangKonten.updateMany({
    where: { tanggal: rentangBulan(bulan), usulan: true, ...(platformId ? { platformId } : {}) },
    data: { usulan: false, diubahOlehId: await idPengguna(session.user?.email), diubahOlehKaryawanId: null },
  });
  return json({ disetujui: r.count });
});
