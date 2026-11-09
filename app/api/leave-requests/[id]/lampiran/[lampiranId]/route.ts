import { prisma } from "@/lib/prisma";
import { requireManager, notFound, route } from "@/lib/http";
import { bacaLampiran, responsLampiran } from "@/lib/services/leave/lampiran";

type Ctx = { params: Promise<{ id: string; lampiranId: string }> };

/** DASHBOARD (manajemen, penjaga sama dengan keputusan izin) — tampilkan/unduh satu lampiran. */
export const GET = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const { id, lampiranId } = await ctx.params;
  const l = await prisma.leaveLampiran.findFirst({
    where: { id: Number(lampiranId) || 0, leaveRequestId: Number(id) || 0 },
  });
  if (!l) return notFound("Lampiran tidak ditemukan");
  const berkas = await bacaLampiran(l.path);
  if (!berkas) return notFound("Berkas lampiran tidak ditemukan");
  return responsLampiran(berkas, l.nama);
});
