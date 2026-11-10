import { prisma } from "@/lib/prisma";
import { json, requireManager, route } from "@/lib/http";
import { dataJamKerja } from "@/lib/services/magang/jam-kerja-simpan";

/** Jam kerja khusus magang: jam per sekolah + jam efektif tiap peserta (anak → sekolah → jam toko). */
export const GET = route(async () => {
  await requireManager();
  return json(await dataJamKerja(prisma));
});
