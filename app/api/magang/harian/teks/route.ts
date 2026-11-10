import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { hariIni } from "@/lib/services/magang/layanan";
import { dataMinggu } from "@/lib/services/magang/harian-db";
import { mingguSchema } from "@/lib/validators/magang-harian";

/** Teks satu minggu untuk disalin ke grup WhatsApp ("Senin 16 Nov — Konten: … · Produksi: …"). */
export const GET = route(async (req: Request) => {
  await requireManager();
  const hari = hariIni();
  const parsed = mingguSchema.safeParse(new URL(req.url).searchParams.get("minggu") ?? hari);
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = await dataMinggu(prisma, parsed.data, hari);
  return json({ senin: d.senin, teks: d.teks });
});
