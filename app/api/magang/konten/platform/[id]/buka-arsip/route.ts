import { prisma } from "@/lib/prisma";
import { requireManager, json, notFound, route } from "@/lib/http";
import { dataArsipPlatform } from "@/lib/services/magang/konten";
import { muatPlatform } from "@/lib/services/magang/konten-db";

type Ctx = { params: Promise<{ id: string }> };

/** Buka arsip: aktif=true, diarsipkanAt=null. */
export const POST = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const r = await prisma.magangKontenPlatform.updateMany({ where: { id }, data: dataArsipPlatform(false) });
  if (r.count === 0) return notFound("Platform tidak ditemukan.");
  return json({ platform: await muatPlatform(prisma) });
});
