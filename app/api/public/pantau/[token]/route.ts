import { route } from "@/lib/http";
import { kepalaPantau, muatTautan, responsPantau, sudahMasuk } from "@/lib/services/magang/pantau-db";

type Ctx = { params: Promise<{ token: string }> };

/**
 * PUBLIK — keadaan tautan pantauan guru. Token tak dikenal/dicabut/kedaluwarsa → 404 dengan pesan umum yang
 * sama. Sebelum PIN hanya nama sekolah yang dikirim; kepala lengkap (nama usaha, tanggal) sesudah masuk.
 */
export const GET = route<Ctx>(async (_req, ctx) => {
  const t = await muatTautan((await ctx.params).token);
  if (!(await sudahMasuk(t))) return responsPantau({ masuk: false, sekolah: t.sekolahLabel });
  return responsPantau({ masuk: true, ...(await kepalaPantau(t)) });
});
