import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { kunciKonsepUnik } from "@/lib/services/magang/konten";
import { muatKonsep } from "@/lib/services/magang/konten-db";
import { konsepSchema } from "@/lib/validators/magang-konten";

export const GET = route(async () => {
  await requireManager();
  return json({ konsep: await muatKonsep(prisma) });
});

/** Tambah konsep. kunci dibuat dari sub/nama dan TIDAK berubah saat ganti nama (dipakai pola hari). */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = konsepSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  for (let coba = 0; coba < 3; coba++) {
    const ada = await prisma.magangKontenKonsep.findMany({ select: { kunci: true, urutan: true } });
    const kunci = kunciKonsepUnik(parsed.data, ada.map((k) => k.kunci));
    const urutan = parsed.data.urutan ?? ada.reduce((m, k) => Math.max(m, k.urutan), 0) + 1;
    try {
      await prisma.magangKontenKonsep.create({ data: { ...parsed.data, kunci, urutan } });
      return json({ konsep: await muatKonsep(prisma) }, { status: 201 });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return NextResponse.json({ message: "Gagal membuat konsep, coba lagi." }, { status: 409 });
});
