import { prisma } from "@/lib/prisma";
import { notFound, route } from "@/lib/http";
import { requirePortalSession } from "@/lib/services/portal/auth";
import { daftarFoto } from "@/lib/services/magang/jurnal";
import { bacaFoto, responsFoto } from "@/lib/services/magang/foto";

type Ctx = { params: Promise<{ token: string; id: string; n: string }> };

/** PORTAL (butuh PIN) — foto ke-n jurnal MILIK anak ini saja. */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token, id, n } = await ctx.params;
  const employee = await requirePortalSession(token, req);
  const j = await prisma.magangJurnal.findFirst({
    where: { id: Number(id) || 0, peserta: { employeeId: employee.id } },
    select: { foto: true },
  });
  const rel = j ? daftarFoto(j.foto)[Number(n)] : undefined;
  const f = rel ? await bacaFoto(rel) : null;
  return f ? responsFoto(f) : notFound("Foto tidak ditemukan.");
});
