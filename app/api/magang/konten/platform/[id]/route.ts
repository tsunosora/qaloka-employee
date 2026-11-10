import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { namaPlatformBentrok, tanpaUndefined } from "@/lib/services/magang/konten";
import { hapusPlatform, muatPlatform } from "@/lib/services/magang/konten-db";
import { ubahPlatformSchema } from "@/lib/validators/magang-konten";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ubah sebagian (nama/warna/ikon/urutan): kolom yang tidak dikirim TIDAK diubah (skema tanpa .default()).
 * aktif/arsip hanya lewat /arsip & /buka-arsip; brief lewat /brief.
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahPlatformSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const data = tanpaUndefined(parsed.data);
  if (data.nama !== undefined) {
    const ada = await prisma.magangKontenPlatform.findMany({ select: { id: true, nama: true } });
    if (namaPlatformBentrok(data.nama, ada, id)) return badRequest({ fieldErrors: { nama: ["Nama platform ini sudah ada."] } });
  }
  const r = await prisma.magangKontenPlatform.updateMany({ where: { id }, data });
  if (r.count === 0) return notFound("Platform tidak ditemukan.");
  return json({ platform: await muatPlatform(prisma) });
});

/** Hapus platform — hanya bila belum punya baris jadwal (409 {dipakai} → arsipkan saja). */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const tolak = await hapusPlatform(prisma, id);
  if (tolak) return tolak;
  return json({ platform: await muatPlatform(prisma) });
});
