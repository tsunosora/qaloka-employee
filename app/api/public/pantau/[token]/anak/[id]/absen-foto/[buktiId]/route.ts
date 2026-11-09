import { prisma } from "@/lib/prisma";
import { route } from "@/lib/http";
import { bacaFoto } from "@/lib/services/absen-hp/simpan";
import { anakAtau404, requireSesiPantau, responsBerkas, tidakAda } from "@/lib/services/magang/pantau-db";

type Ctx = { params: Promise<{ token: string; id: string; buktiId: string }> };

/** GURU — foto bukti absen HP milik anak sekolah ini (bukti orang lain → 404). */
export const GET = route<Ctx>(async (_req, ctx) => {
  const { token, id, buktiId } = await ctx.params;
  const t = await requireSesiPantau(token);
  const p = await anakAtau404(t, id);
  const b = await prisma.absenHpBukti.findFirst({ where: { id: Number(buktiId) || 0, employeeId: p.employeeId }, select: { fotoPath: true } });
  const f = b ? await bacaFoto(b.fotoPath) : null;
  return f ? responsBerkas(f.bita, f.tipe) : tidakAda();
});
