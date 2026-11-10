import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { muatBrief } from "@/lib/services/magang/konten-db";
import { briefPlatformSchema } from "@/lib/validators/magang-konten";

type Ctx = { params: Promise<{ id: string }> };

/** Catatan & brief SATU platform (drive, catatan, font, preset, caption, hashtag, referensi khusus per konsep). */
export const GET = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const brief = await muatBrief(prisma, Number((await ctx.params).id) || 0);
  if (!brief) return notFound("Platform tidak ditemukan.");
  return json(brief);
});

/**
 * Simpan dokumen brief UTUH (PanelBrief selalu mengirim semua kolom). referensi: hanya id konsep yang ada; daftar
 * kosong dibuang (= pakai referensi bawaan konsep).
 */
export const PUT = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = briefPlatformSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const konsep = new Set((await prisma.magangKontenKonsep.findMany({ select: { id: true } })).map((k) => String(k.id)));
  const referensi = Object.fromEntries(Object.entries(parsed.data.referensi).filter(([k, v]) => konsep.has(k) && v.length > 0));
  const brief = { ...parsed.data, referensi };
  const r = await prisma.magangKontenPlatform.updateMany({ where: { id }, data: { brief } });
  if (r.count === 0) return notFound("Platform tidak ditemukan.");
  return json(brief);
});
