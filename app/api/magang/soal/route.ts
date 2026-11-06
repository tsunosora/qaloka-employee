import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { soalSchema } from "@/lib/validators/magang";
import { soalDariBaris } from "@/lib/services/magang/layanan";

export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = soalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const pos = await prisma.magangPos.findFirst({ where: { id: parsed.data.posId, deletedAt: null } });
  if (!pos) return notFound("Pos tidak ditemukan.");
  const soal = await prisma.magangSoal.create({ data: parsed.data });
  return json({ ...soalDariBaris(soal), aktif: soal.aktif }, { status: 201 });
});
