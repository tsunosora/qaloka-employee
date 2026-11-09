import { prisma } from "@/lib/prisma";
import { requireManager, notFound, route } from "@/lib/http";
import { daftarFoto } from "@/lib/services/magang/jurnal";
import { bacaFoto, responsFoto } from "@/lib/services/magang/foto";

type Ctx = { params: Promise<{ id: string; n: string }> };

export const GET = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const { id, n } = await ctx.params;
  const j = await prisma.magangJurnal.findUnique({ where: { id: Number(id) || 0 }, select: { foto: true } });
  const rel = j ? daftarFoto(j.foto)[Number(n)] : undefined;
  const f = rel ? await bacaFoto(rel) : null;
  return f ? responsFoto(f) : notFound("Foto tidak ditemukan.");
});
