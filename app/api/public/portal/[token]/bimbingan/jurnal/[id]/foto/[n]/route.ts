import { prisma } from "@/lib/prisma";
import { notFound, route } from "@/lib/http";
import { daftarFoto } from "@/lib/services/magang/jurnal";
import { bacaFoto, responsFoto } from "@/lib/services/magang/foto";
import { requireBimbingan } from "@/lib/services/magang/pembimbing-db";
import { bolehUrus } from "@/lib/services/magang/pembimbing";

type Ctx = { params: Promise<{ token: string; id: string; n: string }> };

/** PORTAL (PIN; mode owner boleh melihat) — foto jurnal anak, hanya bila jurnalnya di pos yang dia bimbing. */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token, id, n } = await ctx.params;
  const { posIds } = await requireBimbingan(token, req);
  const j = await prisma.magangJurnal.findUnique({ where: { id: Number(id) || 0 }, select: { foto: true, posId: true } });
  const rel = j && bolehUrus(j.posId, posIds) ? daftarFoto(j.foto)[Number(n)] : undefined;
  const f = rel ? await bacaFoto(rel) : null;
  return f ? responsFoto(f) : notFound("Foto tidak ditemukan.");
});
