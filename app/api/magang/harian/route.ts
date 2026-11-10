import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { hariIni } from "@/lib/services/magang/layanan";
import { dataMinggu } from "@/lib/services/magang/harian-db";
import { mingguSchema } from "@/lib/validators/magang-harian";

/**
 * Jadwal harian berpasangan — satu minggu (Senin–Sabtu yang memuat ?minggu=YYYY-MM-DD; bawaan minggu ini):
 * grid tanggal × pasangan, daftar pasangan, pengecualian minggu itu, libur, anak (untuk pilihan), teks WA.
 */
export const GET = route(async (req: Request) => {
  await requireManager();
  const hari = hariIni();
  const parsed = mingguSchema.safeParse(new URL(req.url).searchParams.get("minggu") ?? hari);
  if (!parsed.success) return badRequest(parsed.error.flatten());
  return json(await dataMinggu(prisma, parsed.data, hari));
});
