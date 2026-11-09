import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { urutanKategoriMisiSchema } from "@/lib/validators/magang";
import { daftarKategoriAdmin } from "@/lib/services/magang/misi-db";

/** Simpan urutan kategori: { ids } = SEMUA id kategori dari atas ke bawah → urutan 1, 2, 3, … */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = urutanKategoriMisiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const ids = parsed.data.ids;
  const ada = await prisma.magangMisiKategori.findMany({ select: { id: true } });
  const sama = new Set(ids).size === ids.length && ids.length === ada.length && ada.every((k) => ids.includes(k.id));
  if (!sama) return NextResponse.json({ message: "Daftar kategori sudah berubah. Muat ulang halaman lalu coba lagi." }, { status: 409 });
  await prisma.$transaction(ids.map((id, i) => prisma.magangMisiKategori.update({ where: { id }, data: { urutan: i + 1 } })));
  return json({ kategori: await daftarKategoriAdmin(prisma) });
});
