import { prisma } from "@/lib/prisma";
import { json, notFound, requireManager, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Cabut tautan: langsung tidak berlaku (sesi guru yang terbuka ikut ditolak di permintaan berikutnya). */
export const POST = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const r = await prisma.magangPantau.updateMany({
    where: { id, aktif: true },
    data: { aktif: false, dicabutAt: new Date(), kunciAktif: null },
  });
  if (r.count === 0 && !(await prisma.magangPantau.count({ where: { id } }))) return notFound("Tautan tidak ditemukan.");
  return json({ ok: true });
});
