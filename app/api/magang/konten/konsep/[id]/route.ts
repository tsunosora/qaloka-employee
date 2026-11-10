import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { hapusMaster, muatKonsep } from "@/lib/services/magang/konten-db";
import { ubahKonsepSchema } from "@/lib/validators/magang-konten";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahKonsepSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const r = await prisma.magangKontenKonsep.updateMany({ where: { id }, data: parsed.data });
  if (r.count === 0) return notFound("Konsep tidak ditemukan.");
  return json({ konsep: await muatKonsep(prisma) });
});

/** Hapus konsep — hanya bila belum dipakai baris jadwal (409 → nonaktifkan saja). */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const tolak = await hapusMaster(prisma, "konsep", id);
  if (tolak) return tolak;
  return json({ konsep: await muatKonsep(prisma) });
});
