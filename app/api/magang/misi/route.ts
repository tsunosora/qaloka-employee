import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { misiSchema } from "@/lib/validators/magang";
import { gabungBukti, periksaKategoriMisi, LEVEL_MISI, JENIS_BUKTI } from "@/lib/services/magang/misi";
import { kategoriDanPeta, serialisasiMisi } from "@/lib/services/magang/misi-db";

/** Bank side quest (semua misi yang belum dihapus) + kategori dari DB + jumlah kiriman per status per misi. */
export const GET = route(async () => {
  await requireManager();
  const [misi, hitung, { kategori, peta }] = await Promise.all([
    prisma.magangMisi.findMany({ where: { deletedAt: null }, orderBy: [{ kategori: "asc" }, { urutan: "asc" }, { id: "asc" }] }),
    prisma.magangMisiKiriman.groupBy({ by: ["misiId", "status"], _count: { _all: true } }),
    kategoriDanPeta(prisma),
  ]);
  const jumlah = (id: number, status: string) => hitung.find((h) => h.misiId === id && h.status === status)?._count._all ?? 0;
  return json({
    kategori: kategori.map((k) => ({ id: k.id, kunci: k.kunci, nama: k.nama, ringkas: k.ringkas, prioritas: k.prioritas, urutan: k.urutan, aktif: k.aktif })),
    level: LEVEL_MISI,
    jenisBukti: JENIS_BUKTI,
    misi: misi.map((m) => ({
      ...serialisasiMisi(m, peta),
      kiriman: { menunggu: jumlah(m.id, "menunggu"), disetujui: jumlah(m.id, "disetujui"), ditolak: jumlah(m.id, "ditolak") },
    })),
  });
});

export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = misiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { kategori, peta } = await kategoriDanPeta(prisma);
  const salah = periksaKategoriMisi(parsed.data.kategori, kategori);
  if (salah) return NextResponse.json({ message: salah }, { status: 400 });
  const m = await prisma.magangMisi.create({ data: { ...parsed.data, bukti: gabungBukti(parsed.data.bukti) } });
  return json(serialisasiMisi(m, peta), { status: 201 });
});
