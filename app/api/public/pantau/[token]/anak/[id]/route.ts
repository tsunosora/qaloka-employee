import { route } from "@/lib/http";
import { toYmd } from "@/lib/services/leave/service";
import { hariIni } from "@/lib/services/magang/layanan";
import { rentangDariQuery } from "@/lib/services/magang/pantau";
import { anakAtau404, detailAnakGuru, requireSesiPantau, responsPantau } from "@/lib/services/magang/pantau-db";

type Ctx = { params: Promise<{ token: string; id: string }> };

/** GURU (sesi PIN) — detail satu anak. Anak sekolah lain → 404. */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token, id } = await ctx.params;
  const t = await requireSesiPantau(token);
  const p = await anakAtau404(t, id);
  const q = new URL(req.url).searchParams;
  const r = rentangDariQuery(q.get("dari"), q.get("sampai"), { dari: toYmd(p.mulai), sampai: hariIni() });
  return responsPantau(await detailAnakGuru(t, p, r));
});
