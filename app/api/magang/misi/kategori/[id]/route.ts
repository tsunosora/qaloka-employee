import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { ubahKategoriMisiSchema } from "@/lib/validators/magang";
import { bolehHapusKategori } from "@/lib/services/magang/misi";
import { hitungPemakaianKategori, serialisasiKategori } from "@/lib/services/magang/misi-db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ubah nama/ringkas/prioritas/urutan, atau nonaktifkan (aktif:false). kunci TIDAK ikut berubah, jadi
 * misi & kiriman tetap terhubung. Nonaktif = misinya tidak diberikan & tidak dihitung di progres.
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahKategoriMisiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const lama = await prisma.magangMisiKategori.findUnique({ where: { id } });
  if (!lama) return notFound("Kategori tidak ditemukan.");
  const k = await prisma.magangMisiKategori.update({ where: { id }, data: parsed.data });
  return json(serialisasiKategori(k, await hitungPemakaianKategori(prisma, k.kunci)));
});

/**
 * Hapus kategori — hanya bila tidak dirujuk misi mana pun (termasuk misi yang sudah dihapus, karena
 * kirimannya tetap tampil di rapor). Bila masih dipakai → 409 { dipakai }: nonaktifkan saja, atau
 * pindahkan misinya dulu lewat POST …/[id]/pindah.
 */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const k = await prisma.magangMisiKategori.findUnique({ where: { id } });
  if (!k) return notFound("Kategori tidak ditemukan.");
  const { dipakai } = await hitungPemakaianKategori(prisma, k.kunci);
  const tolak = () =>
    NextResponse.json(
      {
        message: `Kategori "${k.nama}" masih dipakai ${dipakai || "beberapa"} misi. Nonaktifkan saja, atau pindahkan misinya ke kategori lain dulu.`,
        dipakai,
      },
      { status: 409 }
    );
  if (!bolehHapusKategori(dipakai)) return tolak();
  try {
    await prisma.magangMisiKategori.delete({ where: { id } });
  } catch (e) {
    // Misi baru masuk di antara hitung & hapus → FOREIGN KEY (ON DELETE RESTRICT) menolak.
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2003" || e.code === "P2014")) return tolak();
    throw e;
  }
  return json({ ok: true });
});
