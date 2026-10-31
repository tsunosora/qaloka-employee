import { prisma } from "@/lib/prisma";
import { json, requireManager, route } from "@/lib/http";
import { ringkasanHr } from "@/lib/services/integrations/hr-summary";
import { keadaanLisensi } from "@/lib/lisensi/layanan";

/**
 * GET /api/hp/ringkasan — beranda Tim di aplikasi HP Owner: ringkasan HR yang sama dengan kartu
 * di Qaloka POS, ditambah antrean yang menunggu keputusan owner dan fitur lisensi aktif.
 * Rincian & keputusan memakai API dasbor biasa (/api/attendance/report, /api/leave-requests,
 * /api/redemptions) dengan token HP yang sama.
 */
export const GET = route(async () => {
  const session = await requireManager();
  const [ringkasan, pendingRedemptions, k] = await Promise.all([
    ringkasanHr(),
    prisma.pointRedemption.count({ where: { status: "pending" } }),
    keadaanLisensi().catch(() => null),
  ]);
  return json({
    ...ringkasan,
    pendingRedemptions,
    pengguna: { nama: session.user?.name ?? null, peran: session.user?.role ?? null },
    usaha: { nama: k?.namaKlien ?? null, paket: k?.paket ?? null, status: k?.status ?? null },
    fitur: k?.ditegakkan ? k.fitur : null,
  });
});
