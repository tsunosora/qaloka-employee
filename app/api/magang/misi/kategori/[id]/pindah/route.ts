import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { pindahKategoriMisiSchema } from "@/lib/validators/magang";
import { periksaPindahKategori } from "@/lib/services/magang/misi";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Pindahkan SEMUA misi kategori ini (termasuk yang sudah dihapus) ke kategori lain yang aktif, dalam
 * satu transaksi. Kiriman anak ikut karena terikat ke misinya. Sesudahnya kategori ini boleh dihapus.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = pindahKategoriMisiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const asal = await prisma.magangMisiKategori.findUnique({ where: { id } });
  if (!asal) return notFound("Kategori tidak ditemukan.");

  const hasil = await prisma.$transaction(async (tx) => {
    const tujuan = await tx.magangMisiKategori.findUnique({ where: { kunci: parsed.data.ke } });
    const salah = periksaPindahKategori(asal, tujuan);
    if (salah) return { salah };
    const r = await tx.magangMisi.updateMany({ where: { kategori: asal.kunci }, data: { kategori: tujuan!.kunci } });
    return { dipindah: r.count, ke: tujuan!.nama };
  });
  if ("salah" in hasil) return NextResponse.json({ message: hasil.salah }, { status: 400 });
  return json({ ok: true, ...hasil });
});
