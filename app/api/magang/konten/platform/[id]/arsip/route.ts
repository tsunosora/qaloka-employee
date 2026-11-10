import { prisma } from "@/lib/prisma";
import { requireManager, json, notFound, route } from "@/lib/http";
import { dataArsipPlatform } from "@/lib/services/magang/konten";
import { muatPlatform } from "@/lib/services/magang/konten-db";

type Ctx = { params: Promise<{ id: string }> };

/** Arsipkan: aktif=false + diarsipkanAt. Baris jadwalnya tetap ada (tetap tampil di HP anak & "Semua platform"). */
export const POST = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const r = await prisma.magangKontenPlatform.updateMany({ where: { id, aktif: true }, data: dataArsipPlatform(true) });
  if (r.count === 0 && !(await prisma.magangKontenPlatform.findUnique({ where: { id }, select: { id: true } }))) return notFound("Platform tidak ditemukan.");
  return json({ platform: await muatPlatform(prisma) });
});
