import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, json, notFound, requireManager, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { tautanAdmin } from "@/lib/services/magang/pantau-db";
import { ubahPantauSchema } from "@/lib/validators/magang";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ubah tautan yang masih aktif: PIN baru (sesi guru yang lama ikut mati — cookie memuat sidik pinHash),
 * tanggal kedaluwarsa (null = tanpa batas), izin melihat lampiran surat izin/sakit.
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahPantauSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const ada = await prisma.magangPantau.findUnique({ where: { id }, select: { aktif: true, dicabutAt: true } });
  if (!ada) return notFound("Tautan tidak ditemukan.");
  if (!ada.aktif || ada.dicabutAt) return NextResponse.json({ message: "Tautan sudah dicabut. Buat tautan baru." }, { status: 409 });
  await prisma.magangPantau.update({
    where: { id },
    data: {
      ...(d.pin !== undefined ? { pinHash: await bcrypt.hash(d.pin, 10) } : {}),
      ...(d.kedaluwarsa !== undefined ? { kedaluwarsa: d.kedaluwarsa ? atMidnight(d.kedaluwarsa) : null } : {}),
      ...(d.tampilLampiranIzin !== undefined ? { tampilLampiranIzin: d.tampilLampiranIzin } : {}),
    },
  });
  return json({ tautan: await tautanAdmin(id) });
});
