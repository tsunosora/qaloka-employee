import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { muatGrup } from "@/lib/services/magang/konten-db";
import { grupKontenSchema } from "@/lib/validators/magang-konten";

export const GET = route(async () => {
  await requireManager();
  return json({ grup: await muatGrup(prisma) });
});

/** Tambah grup konten + anggotanya. urutan = giliran hari grup (EMPATHY). */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = grupKontenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { anggota, ...d } = parsed.data;
  const unik = [...new Set(anggota)];
  if ((await prisma.magangPeserta.count({ where: { id: { in: unik } } })) !== unik.length) return badRequest({ anggota: ["Ada anak yang tidak ditemukan."] });
  const maks = await prisma.magangKontenGrup.aggregate({ _max: { urutan: true } });
  await prisma.magangKontenGrup.create({
    data: { ...d, urutan: d.urutan ?? (maks._max.urutan ?? 0) + 1, anggota: { create: unik.map((pesertaId) => ({ pesertaId })) } },
  });
  return json({ grup: await muatGrup(prisma) }, { status: 201 });
});
