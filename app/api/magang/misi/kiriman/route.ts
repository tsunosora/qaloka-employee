import { prisma } from "@/lib/prisma";
import { requireManager, json, route } from "@/lib/http";
import { daftarKiriman } from "@/lib/services/magang/misi-db";
import { STATUS_KIRIMAN } from "@/lib/services/magang/misi";

/**
 * Kiriman bukti side quest. ?status=menunggu|disetujui|ditolak (bawaan menunggu; "semua" = tanpa saringan),
 * ?pesertaId=, ?sekolah=. Daftar "menunggu" hanya untuk peserta yang masih aktif (sama dengan jurnal).
 */
export const GET = route(async (req: Request) => {
  await requireManager();
  const u = new URL(req.url);
  const s = u.searchParams.get("status") ?? "menunggu";
  const status = (STATUS_KIRIMAN as readonly string[]).includes(s) ? s : undefined;
  const pesertaId = Number(u.searchParams.get("pesertaId")) || undefined;
  const sekolah = u.searchParams.get("sekolah")?.trim() || null;
  return json({
    kiriman: await daftarKiriman(prisma, { status, pesertaId, sekolah, hanyaAktif: status === "menunggu" && !pesertaId }),
  });
});
