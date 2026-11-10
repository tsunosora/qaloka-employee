import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { rentangBulan } from "@/lib/services/magang/konten-db";
import { bulanSchema } from "@/lib/validators/magang-konten";

const schema = z.object({ bulan: bulanSchema });

/** "Setujui semua usulan" satu bulan: usulan=false untuk semua baris usulan di bulan itu. */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const r = await prisma.magangKonten.updateMany({
    where: { tanggal: rentangBulan(parsed.data.bulan), usulan: true },
    data: { usulan: false, diubahOlehId: await idPengguna(session.user?.email), diubahOlehKaryawanId: null },
  });
  return json({ disetujui: r.count });
});
