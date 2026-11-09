import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/http";
import { portalSecret } from "@/lib/services/portal/auth";
import { PANTAU_COOKIE, PANTAU_TTL_MS, buatSesiPantau } from "@/lib/services/magang/pantau";
import { ipKlien, muatTautan, penahanPantau, responsPantau } from "@/lib/services/magang/pantau-db";
import { masukPantauSchema } from "@/lib/validators/magang";

type Ctx = { params: Promise<{ token: string }> };

/**
 * PUBLIK — guru memasukkan PIN. Penahan: 5 salah per token+IP, 20 salah per token → 15 menit (memori proses).
 * Berhasil → cookie HttpOnly ber-HMAC (id, sidik token, sidik PIN, kedaluwarsa 8 jam) + catat dibuka.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const t = await muatTautan(token);
  const ip = ipKlien(req);
  if (!penahanPantau.boleh(token, ip)) {
    return responsPantau({ message: "Terlalu banyak percobaan PIN. Coba lagi 15 menit lagi." }, { status: 429 });
  }
  const parsed = masukPantauSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return responsPantau({ message: "Masukkan PIN." }, { status: 422 });
  const ok = await bcrypt.compare(parsed.data.pin.replace(/\D/g, ""), t.pinHash);
  if (!ok) {
    penahanPantau.gagal(token, ip);
    return responsPantau({ message: "PIN salah." }, { status: 401 });
  }
  penahanPantau.berhasil(token, ip);
  await prisma.magangPantau.update({ where: { id: t.id }, data: { terakhirDibukaAt: new Date(), dibukaKali: { increment: 1 } } });
  const store = await cookies();
  store.set(PANTAU_COOKIE, buatSesiPantau(t, portalSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(PANTAU_TTL_MS / 1000),
  });
  return responsPantau({ ok: true });
});
