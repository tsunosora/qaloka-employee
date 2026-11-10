import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { muatAnak } from "@/lib/services/magang/konten-db";
import { kodeAnakSchema } from "@/lib/validators/magang-konten";

/**
 * Atur kode anak (kolom CODE). Daftar yang dikirim diterapkan sekaligus dalam satu transaksi: kode anak
 * di daftar dikosongkan dulu lalu dipasang, jadi bertukar kode (1 dan 2) tidak bentrok indeks unik.
 * Kode yang dipegang anak LAIN (tidak ada di daftar) → 409.
 */
export const PUT = route(async (req: Request) => {
  await requireManager();
  const parsed = kodeAnakSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const ids = parsed.data.kode.map((k) => k.pesertaId);
  const kode = parsed.data.kode.map((k) => k.kode).filter((k): k is number => k != null);
  const bentrok = await prisma.magangPeserta.findFirst({ where: { kodeKonten: { in: kode }, id: { notIn: ids } }, select: { kodeKonten: true } });
  if (bentrok) return NextResponse.json({ message: `Kode ${bentrok.kodeKonten} sudah dipakai anak lain.` }, { status: 409 });
  try {
    await prisma.$transaction([
      prisma.magangPeserta.updateMany({ where: { id: { in: ids } }, data: { kodeKonten: null } }),
      ...parsed.data.kode
        .filter((k) => k.kode != null)
        .map((k) => prisma.magangPeserta.update({ where: { id: k.pesertaId }, data: { kodeKonten: k.kode } })),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2025"))
      return NextResponse.json({ message: "Kode bentrok atau anak tidak ditemukan. Muat ulang lalu coba lagi." }, { status: 409 });
    throw e;
  }
  return json({ anak: await muatAnak(prisma) });
});
