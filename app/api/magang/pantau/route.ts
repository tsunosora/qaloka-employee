import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { badRequest, json, notFound, requireManager, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { buatTokenPantau } from "@/lib/services/magang/pantau";
import { daftarSekolahAdmin, tautanAdmin } from "@/lib/services/magang/pantau-db";
import { kunciSekolah } from "@/lib/services/magang/sekolah";
import { buatPantauSchema } from "@/lib/validators/magang";

/** Daftar sekolah + tautan pantauan guru yang aktif (tanpa pinHash). */
export const GET = route(async () => {
  await requireManager();
  return json({ sekolah: await daftarSekolahAdmin() });
});

/** Buat tautan pantauan untuk satu sekolah. Satu tautan aktif per sekolah (indeks unik kunciAktif → 409). */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = buatPantauSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const kunci = kunciSekolah(d.sekolahKunci);
  const sekolah = (await daftarSekolahAdmin()).find((s) => s.kunci === kunci);
  if (!sekolah) return notFound("Sekolah tidak ditemukan di data peserta.");
  if (sekolah.tautan) return NextResponse.json({ message: "Sekolah ini sudah punya tautan aktif. Pakai Ganti tautan." }, { status: 409 });
  try {
    const t = await prisma.magangPantau.create({
      data: {
        sekolahKunci: kunci,
        sekolahLabel: sekolah.label,
        kunciAktif: kunci,
        token: buatTokenPantau(),
        pinHash: await bcrypt.hash(d.pin, 10),
        kedaluwarsa: d.kedaluwarsa ? atMidnight(d.kedaluwarsa) : null,
        tampilLampiranIzin: d.tampilLampiranIzin,
        dibuatOlehId: await idPengguna(session.user?.email),
      },
      select: { id: true },
    });
    return json({ tautan: await tautanAdmin(t.id) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ message: "Sekolah ini sudah punya tautan aktif. Muat ulang halaman." }, { status: 409 });
    }
    throw e;
  }
});
