import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { misiSchema } from "@/lib/validators/magang";
import { gabungBukti, KATEGORI_MISI, LEVEL_MISI, JENIS_BUKTI } from "@/lib/services/magang/misi";
import { serialisasiMisi } from "@/lib/services/magang/misi-db";

/** Bank side quest (semua misi yang belum dihapus) + jumlah kiriman per status per misi. */
export const GET = route(async () => {
  await requireManager();
  const [misi, hitung] = await Promise.all([
    prisma.magangMisi.findMany({ where: { deletedAt: null }, orderBy: [{ kategori: "asc" }, { urutan: "asc" }, { id: "asc" }] }),
    prisma.magangMisiKiriman.groupBy({ by: ["misiId", "status"], _count: { _all: true } }),
  ]);
  const jumlah = (id: number, status: string) => hitung.find((h) => h.misiId === id && h.status === status)?._count._all ?? 0;
  return json({
    kategori: KATEGORI_MISI,
    level: LEVEL_MISI,
    jenisBukti: JENIS_BUKTI,
    misi: misi.map((m) => ({
      ...serialisasiMisi(m),
      kiriman: { menunggu: jumlah(m.id, "menunggu"), disetujui: jumlah(m.id, "disetujui"), ditolak: jumlah(m.id, "ditolak") },
    })),
  });
});

export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = misiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const m = await prisma.magangMisi.create({ data: { ...parsed.data, bukti: gabungBukti(parsed.data.bukti) } });
  return json(serialisasiMisi(m), { status: 201 });
});
