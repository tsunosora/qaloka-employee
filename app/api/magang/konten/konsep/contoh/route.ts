import { prisma } from "@/lib/prisma";
import { requireManager, json, route } from "@/lib/http";
import { KONSEP_CONTOH } from "@/lib/services/magang/konten";
import { muatKonsep } from "@/lib/services/magang/konten-db";

/** Pasang 4 konsep contoh (Sitkom, Flexing, Talk, Empathy) — kunci yang sudah ada dilewati. */
export const POST = route(async () => {
  await requireManager();
  for (const k of KONSEP_CONTOH) {
    await prisma.magangKontenKonsep.upsert({ where: { kunci: k.kunci }, update: {}, create: { ...k, referensi: [] } });
  }
  return json({ konsep: await muatKonsep(prisma) });
});
