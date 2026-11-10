import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { badRequest, json, notFound, requireManager, route } from "@/lib/http";
import { buatTokenPantau } from "@/lib/services/magang/pantau";
import { tautanAdmin } from "@/lib/services/magang/pantau-db";
import { gantiPantauSchema } from "@/lib/validators/magang";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ganti tautan (mis. tautan tersebar ke orang lain): cabut yang lama + buat yang baru (token baru) dengan
 * setelan yang sama. PIN tetap, kecuali dikirim PIN baru. Satu transaksi, tanpa DDL.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const session = await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = gantiPantauSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const lama = await prisma.magangPantau.findUnique({ where: { id } });
  if (!lama) return notFound("Tautan tidak ditemukan.");
  if (!lama.aktif || lama.dicabutAt) return NextResponse.json({ message: "Tautan ini sudah dicabut. Buat tautan baru dari daftar sekolah." }, { status: 409 });
  const pinHash = parsed.data.pin ? await bcrypt.hash(parsed.data.pin, 10) : lama.pinHash;
  const olehId = await idPengguna(session.user?.email);
  const baru = await prisma.$transaction(async (tx) => {
    const r = await tx.magangPantau.updateMany({ where: { id, aktif: true }, data: { aktif: false, dicabutAt: new Date(), kunciAktif: null } });
    if (r.count === 0) return null;
    return tx.magangPantau.create({
      data: {
        sekolahKunci: lama.sekolahKunci,
        sekolahLabel: lama.sekolahLabel,
        kunciAktif: lama.sekolahKunci,
        token: buatTokenPantau(),
        pinHash,
        kedaluwarsa: lama.kedaluwarsa,
        tampilLampiranIzin: lama.tampilLampiranIzin,
        dibuatOlehId: olehId,
      },
      select: { id: true },
    });
  });
  if (!baru) return NextResponse.json({ message: "Tautan ini baru saja dicabut. Muat ulang halaman." }, { status: 409 });
  return json({ tautan: await tautanAdmin(baru.id) }, { status: 201 });
});
