import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { setSetting } from "@/lib/settings";
import { KUNCI_BRIEF } from "@/lib/services/magang/konten";
import { muatBrief } from "@/lib/services/magang/konten-db";
import { briefSchema } from "@/lib/validators/magang-konten";

/** Catatan & brief konten (drive pengumpulan, catatan, font, preset, caption, hashtag). */
export const GET = route(async () => {
  await requireManager();
  return json(await muatBrief(prisma));
});

export const PUT = route(async (req: Request) => {
  await requireManager();
  const parsed = briefSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  await setSetting(KUNCI_BRIEF, JSON.stringify(parsed.data));
  return json(parsed.data);
});
