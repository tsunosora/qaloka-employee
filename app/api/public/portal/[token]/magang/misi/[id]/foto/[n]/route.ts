import { prisma } from "@/lib/prisma";
import { notFound, route } from "@/lib/http";
import { requirePortalSession } from "@/lib/services/portal/auth";
import { daftarFoto } from "@/lib/services/magang/jurnal";
import { bacaFoto, responsFoto } from "@/lib/services/magang/foto";

type Ctx = { params: Promise<{ token: string; id: string; n: string }> };

/** PORTAL (butuh PIN) — foto ke-n bukti side quest MILIK anak ini saja (id = kiriman). */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token, id, n } = await ctx.params;
  const employee = await requirePortalSession(token, req);
  const k = await prisma.magangMisiKiriman.findFirst({
    where: { id: Number(id) || 0, peserta: { employeeId: employee.id } },
    select: { foto: true },
  });
  const rel = k ? daftarFoto(k.foto)[Number(n)] : undefined;
  const f = rel ? await bacaFoto(rel) : null;
  return f ? responsFoto(f) : notFound("Foto tidak ditemukan.");
});
