import { prisma } from "@/lib/prisma";
import { notFound, route } from "@/lib/http";
import { requireBimbingan } from "@/lib/services/magang/pembimbing-db";
import { daftarFoto } from "@/lib/services/magang/jurnal";
import { bacaFoto, responsFoto } from "@/lib/services/magang/foto";

type Ctx = { params: Promise<{ token: string; id: string; n: string }> };

/** PORTAL pembimbing — foto bukti side quest peserta aktif. */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token, id, n } = await ctx.params;
  await requireBimbingan(token, req);
  const k = await prisma.magangMisiKiriman.findFirst({ where: { id: Number(id) || 0, peserta: { aktif: true } }, select: { foto: true } });
  const rel = k ? daftarFoto(k.foto)[Number(n)] : undefined;
  const f = rel ? await bacaFoto(rel) : null;
  return f ? responsFoto(f) : notFound("Foto tidak ditemukan.");
});
