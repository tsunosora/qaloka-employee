import { requireSession, json, route } from "@/lib/http";
import { ringkasanLisensi } from "@/lib/lisensi/ringkasan";

/** Keadaan lisensi Qaloka instalasi ini (tanpa kunci mentah, tanpa token). */
export const GET = route(async () => {
  await requireSession();
  return json(await ringkasanLisensi());
});
