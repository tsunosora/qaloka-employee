import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { misiSchema } from "@/lib/validators/magang";
import { gabungBukti, periksaKategoriMisi } from "@/lib/services/magang/misi";
import { kategoriDanPeta, serialisasiMisi } from "@/lib/services/magang/misi-db";

type Ctx = { params: Promise<{ id: string }> };

async function ada(id: number) {
  return prisma.magangMisi.findFirst({ where: { id, deletedAt: null }, select: { id: true, kategori: true } });
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = misiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const lama = await ada(id);
  if (!lama) return notFound("Misi tidak ditemukan.");
  const { kategori, peta } = await kategoriDanPeta(prisma);
  // Misi yang sudah berada di kategori nonaktif boleh tetap disunting tanpa dipaksa pindah.
  const salah = periksaKategoriMisi(parsed.data.kategori, kategori, lama.kategori);
  if (salah) return NextResponse.json({ message: salah }, { status: 400 });
  const m = await prisma.magangMisi.update({ where: { id }, data: { ...parsed.data, bukti: gabungBukti(parsed.data.bukti) } });
  return json(serialisasiMisi(m, peta));
});

/** Hapus LUNAK: kiriman anak & riwayat persetujuan tetap ada (rapor lama tidak berubah diam-diam). */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  if (!(await ada(id))) return notFound("Misi tidak ditemukan.");
  await prisma.magangMisi.update({ where: { id }, data: { deletedAt: new Date(), aktif: false } });
  return json({ ok: true });
});
