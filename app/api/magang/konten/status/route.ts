import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { kunciKategoriUnik } from "@/lib/services/magang/misi";
import { muatStatus } from "@/lib/services/magang/konten-db";
import { statusKontenSchema } from "@/lib/validators/magang-konten";

export const GET = route(async () => {
  await requireManager();
  return json({ status: await muatStatus(prisma) });
});

/** Tambah status. Status final tidak bisa sekaligus anakBoleh (final hanya dipasang pembina). */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = statusKontenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = { ...parsed.data, anakBoleh: parsed.data.final ? false : parsed.data.anakBoleh };
  for (let coba = 0; coba < 3; coba++) {
    const ada = await prisma.magangKontenStatus.findMany({ select: { kunci: true, urutan: true } });
    const kunci = kunciKategoriUnik(d.nama, ada.map((k) => k.kunci));
    const urutan = d.urutan ?? ada.reduce((m, k) => Math.max(m, k.urutan), 0) + 1;
    try {
      await prisma.magangKontenStatus.create({ data: { ...d, kunci, urutan } });
      return json({ status: await muatStatus(prisma) }, { status: 201 });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return NextResponse.json({ message: "Gagal membuat status, coba lagi." }, { status: 409 });
});
