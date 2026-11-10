import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { hapusMaster, muatStatus } from "@/lib/services/magang/konten-db";
import { tanpaUndefined } from "@/lib/services/magang/konten";
import { ubahStatusKontenSchema } from "@/lib/validators/magang-konten";

type Ctx = { params: Promise<{ id: string }> };

/** Ubah status. final=true memaksa anakBoleh=false. selesaiAt baris lama tidak diubah. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahStatusKontenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const lama = await prisma.magangKontenStatus.findUnique({ where: { id }, select: { final: true } });
  if (!lama) return notFound("Status tidak ditemukan.");
  const final = parsed.data.final ?? lama.final;
  await prisma.magangKontenStatus.update({ where: { id }, data: { ...tanpaUndefined(parsed.data), ...(final ? { anakBoleh: false } : {}) } });
  return json({ status: await muatStatus(prisma) });
});

/** Hapus status — hanya bila belum dipakai baris jadwal (409 → nonaktifkan saja). */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const tolak = await hapusMaster(prisma, "status", id);
  if (tolak) return tolak;
  return json({ status: await muatStatus(prisma) });
});
