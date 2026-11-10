import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { urutanPlatformBaru } from "@/lib/services/magang/konten";
import { muatPlatform } from "@/lib/services/magang/konten-db";
import { urutanPlatformSchema } from "@/lib/validators/magang-konten";

/** Susun ulang tab platform: {urutan: [id semua platform dalam urutan baru]} → urutan 1..n (satu transaksi). */
export const PUT = route(async (req: Request) => {
  await requireManager();
  const parsed = urutanPlatformSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const semua = await prisma.magangKontenPlatform.findMany({ select: { id: true } });
  const baru = urutanPlatformBaru(parsed.data.urutan, semua.map((p) => p.id));
  if (!baru) return badRequest({ formErrors: ["Daftar platform berubah — muat ulang lalu coba lagi."] });
  await prisma.$transaction(baru.map((b) => prisma.magangKontenPlatform.update({ where: { id: b.id }, data: { urutan: b.urutan } })));
  return json({ platform: await muatPlatform(prisma) });
});
