import { prisma } from "@/lib/prisma";
import { json, route } from "@/lib/http";
import { requirePortalSession } from "@/lib/services/portal/auth";
import { hariIni } from "@/lib/services/magang/layanan";
import { hariKerjaBerikut, jadwalSatuAnak } from "@/lib/services/magang/harian-db";
import { serialHarianAnak } from "@/lib/services/magang/harian";

type Ctx = { params: Promise<{ token: string }> };

/**
 * PORTAL (butuh PIN; mode owner boleh melihat, baca saja) — tugas harian anak SENDIRI: hari ini + hari kerja
 * berikutnya ("Besok"). Hanya tugas, nama panggilan rekan, sendiri/libur — tanpa catatan pembina & tanpa anak lain.
 */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalSession(token, req);
  const p = await prisma.magangPeserta.findFirst({ where: { employeeId: employee.id, aktif: true }, select: { id: true } });
  if (!p) return json({ peserta: false });
  const hari = hariIni();
  const berikut = await hariKerjaBerikut(prisma, hari);
  const jadwal = await jadwalSatuAnak(prisma, p.id, hari, berikut);
  const [ini, nanti] = [jadwal.find((h) => h.tanggal === hari), jadwal.find((h) => h.tanggal === berikut)];
  return json({
    peserta: true,
    hariIni: ini ? serialHarianAnak(ini) : null,
    berikut: nanti ? { ...serialHarianAnak(nanti), besok: nanti.tanggal === jadwal[1]?.tanggal } : null,
  });
});
