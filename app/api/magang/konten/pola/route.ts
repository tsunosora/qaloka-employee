import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { setSetting } from "@/lib/settings";
import { KUNCI_POLA } from "@/lib/services/magang/konten";
import { muatPola } from "@/lib/services/magang/konten-db";
import { polaSchema } from "@/lib/validators/magang-konten";

/** Pola untuk "Buat jadwal": konsep per hari Senin–Sabtu + konsep hari grup + selang hari grup. */
export const PUT = route(async (req: Request) => {
  await requireManager();
  const parsed = polaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  await setSetting(KUNCI_POLA, JSON.stringify(parsed.data));
  return json(await muatPola(prisma));
});
