import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { setSetting } from "@/lib/settings";
import { hariTugasMagang } from "@/lib/services/magang/layanan";
import { KUNCI_HARI_TUGAS, namaHariTugas } from "@/lib/services/magang/nilai";

const skema = z.object({ hariTugas: z.number().int().min(1).max(6) });

/** Setelan program magang: hari dibukanya tugas mengingat (1 = Senin … 6 = Sabtu; bawaan Jumat). */
export const GET = route(async () => {
  await requireManager();
  const hariTugas = await hariTugasMagang(prisma);
  return json({ hariTugas, namaHari: namaHariTugas(hariTugas) });
});

export const PUT = route(async (req: Request) => {
  await requireManager();
  const parsed = skema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest({ hariTugas: ["Pilih hari Senin sampai Sabtu."] });
  await setSetting(KUNCI_HARI_TUGAS, String(parsed.data.hariTugas));
  const hariTugas = await hariTugasMagang(prisma);
  return json({ hariTugas, namaHari: namaHariTugas(hariTugas) });
});
