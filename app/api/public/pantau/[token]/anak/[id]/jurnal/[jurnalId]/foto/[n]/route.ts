import { prisma } from "@/lib/prisma";
import { route } from "@/lib/http";
import { bacaFoto } from "@/lib/services/magang/foto";
import { daftarFoto } from "@/lib/services/magang/jurnal";
import { anakAtau404, requireSesiPantau, responsBerkas, tidakAda } from "@/lib/services/magang/pantau-db";

type Ctx = { params: Promise<{ token: string; id: string; jurnalId: string; n: string }> };

/** GURU — foto jurnal anak sekolah ini (jurnal anak lain → 404). */
export const GET = route<Ctx>(async (_req, ctx) => {
  const { token, id, jurnalId, n } = await ctx.params;
  const t = await requireSesiPantau(token);
  const p = await anakAtau404(t, id);
  const j = await prisma.magangJurnal.findFirst({ where: { id: Number(jurnalId) || 0, pesertaId: p.id }, select: { foto: true } });
  const jalur = j ? daftarFoto(j.foto)[Number(n)] : undefined;
  const f = jalur ? await bacaFoto(jalur) : null;
  return f ? responsBerkas(f.bita, f.tipe) : tidakAda();
});
