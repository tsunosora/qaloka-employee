import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { hapusMaster, muatGrup } from "@/lib/services/magang/konten-db";
import { tanpaUndefined } from "@/lib/services/magang/konten";
import { ubahGrupKontenSchema } from "@/lib/validators/magang-konten";

type Ctx = { params: Promise<{ id: string }> };

/** Ubah grup; anggota (bila dikirim) MENGGANTI seluruh daftar anggota. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahGrupKontenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { anggota, ...sisa } = parsed.data;
  const d = tanpaUndefined(sisa);
  if (!(await prisma.magangKontenGrup.findUnique({ where: { id }, select: { id: true } }))) return notFound("Grup tidak ditemukan.");
  if (anggota) {
    const unik = [...new Set(anggota)];
    if ((await prisma.magangPeserta.count({ where: { id: { in: unik } } })) !== unik.length) return badRequest({ anggota: ["Ada anak yang tidak ditemukan."] });
    await prisma.$transaction([
      prisma.magangKontenGrup.update({ where: { id }, data: d }),
      prisma.magangKontenGrupAnggota.deleteMany({ where: { grupId: id, pesertaId: { notIn: unik } } }),
      prisma.magangKontenGrupAnggota.createMany({ data: unik.map((pesertaId) => ({ grupId: id, pesertaId })), skipDuplicates: true }),
    ]);
  } else {
    await prisma.magangKontenGrup.update({ where: { id }, data: d });
  }
  return json({ grup: await muatGrup(prisma) });
});

/** Hapus grup — hanya bila belum dipakai baris jadwal (409 → nonaktifkan saja). */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const tolak = await hapusMaster(prisma, "grup", id);
  if (tolak) return tolak;
  return json({ grup: await muatGrup(prisma) });
});
