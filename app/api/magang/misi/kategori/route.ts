import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { kategoriMisiSchema } from "@/lib/validators/magang";
import { kunciKategoriUnik } from "@/lib/services/magang/misi";
import { daftarKategoriAdmin, serialisasiKategori } from "@/lib/services/magang/misi-db";

/** Daftar kategori side quest (termasuk nonaktif) + jumlah misi & jumlah rujukan (termasuk misi terhapus). */
export const GET = route(async () => {
  await requireManager();
  return json({ kategori: await daftarKategoriAdmin(prisma) });
});

/** Tambah kategori. kunci dibuat dari nama (slug + akhiran bila sudah dipakai) dan tidak berubah saat ganti nama. */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = kategoriMisiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  // Dua admin menambah nama yang sama bersamaan → kunci bentrok (P2002): hitung ulang lalu coba lagi.
  for (let coba = 0; coba < 3; coba++) {
    const ada = await prisma.magangMisiKategori.findMany({ select: { kunci: true, urutan: true } });
    const kunci = kunciKategoriUnik(parsed.data.nama, ada.map((k) => k.kunci));
    const urutan = ada.reduce((m, k) => Math.max(m, k.urutan), 0) + 1;
    try {
      const k = await prisma.magangMisiKategori.create({ data: { ...parsed.data, kunci, urutan } });
      return json(serialisasiKategori(k, { jumlahMisi: 0, dipakai: 0 }), { status: 201 });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return NextResponse.json({ message: "Gagal membuat kategori, coba lagi." }, { status: 409 });
});
