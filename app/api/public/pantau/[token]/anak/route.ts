import { route } from "@/lib/http";
import { rentangDariQuery } from "@/lib/services/magang/pantau";
import { daftarAnakGuru, kepalaPantau, requireSesiPantau, responsPantau } from "@/lib/services/magang/pantau-db";

type Ctx = { params: Promise<{ token: string }> };

/** GURU (sesi PIN) — anak sekolah ini + kehadiran/jurnal/side quest dalam rentang (?dari&sampai). */
export const GET = route<Ctx>(async (req, ctx) => {
  const t = await requireSesiPantau((await ctx.params).token);
  const kepala = await kepalaPantau(t);
  const q = new URL(req.url).searchParams;
  const r = rentangDariQuery(q.get("dari"), q.get("sampai"), { dari: kepala.awalMagang, sampai: kepala.hariIni });
  return responsPantau({ rentang: r, anak: await daftarAnakGuru(t, r) });
});
