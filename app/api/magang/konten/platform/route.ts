import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { kunciPlatformUnik, namaPlatformBentrok } from "@/lib/services/magang/konten";
import { muatPlatform } from "@/lib/services/magang/konten-db";
import { platformSchema } from "@/lib/validators/magang-konten";

/** Semua platform (termasuk arsip) + jumlah baris jadwal masing-masing. */
export const GET = route(async () => {
  await requireManager();
  return json({ platform: await muatPlatform(prisma) });
});

/** Tambah platform. Nama unik tanpa peduli huruf besar; kunci = slug nama, TIDAK berubah saat ganti nama. */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = platformSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  for (let coba = 0; coba < 3; coba++) {
    const ada = await prisma.magangKontenPlatform.findMany({ select: { id: true, nama: true, kunci: true, urutan: true } });
    if (namaPlatformBentrok(d.nama, ada)) return badRequest({ fieldErrors: { nama: ["Nama platform ini sudah ada."] } });
    const kunci = kunciPlatformUnik(d.nama, ada.map((p) => p.kunci));
    const urutan = d.urutan ?? ada.reduce((m, p) => Math.max(m, p.urutan), 0) + 1;
    try {
      await prisma.magangKontenPlatform.create({ data: { nama: d.nama, kunci, warna: d.warna, ikon: d.ikon ?? null, urutan } });
      return json({ platform: await muatPlatform(prisma) }, { status: 201 });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return NextResponse.json({ message: "Gagal membuat platform, coba lagi." }, { status: 409 });
});
