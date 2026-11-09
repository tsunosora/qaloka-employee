import { prisma } from "@/lib/prisma";
import { json, route } from "@/lib/http";
import { requireBimbingan } from "@/lib/services/magang/pembimbing-db";
import { daftarKiriman } from "@/lib/services/magang/misi-db";

type Ctx = { params: Promise<{ token: string }> };

/**
 * PORTAL pembimbing — bukti side quest yang menunggu diputus. Side quest bukan pos, jadi SEMUA
 * pembimbing pos aktif boleh memutus (peserta aktif saja). Mode owner = baca saja.
 */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  await requireBimbingan(token, req);
  return json({ kiriman: await daftarKiriman(prisma, { status: "menunggu", hanyaAktif: true }) });
});
