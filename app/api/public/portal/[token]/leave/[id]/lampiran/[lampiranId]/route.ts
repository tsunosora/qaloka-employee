import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, notFound, route } from "@/lib/http";
import { requirePortalOwner, requirePortalSession } from "@/lib/services/portal/auth";
import { bacaLampiran, hapusLampiran, responsLampiran } from "@/lib/services/leave/lampiran";

type Ctx = { params: Promise<{ token: string; id: string; lampiranId: string }> };

/** Lampiran milik pengajuan karyawan pemilik token ini (bukan milik orang lain). */
async function cariLampiran(employeeId: number, id: string, lampiranId: string) {
  return prisma.leaveLampiran.findFirst({
    where: {
      id: Number(lampiranId) || 0,
      leaveRequestId: Number(id) || 0,
      leaveRequest: { employeeId },
    },
    include: { leaveRequest: { select: { status: true } } },
  });
}

/** PORTAL (butuh PIN, atau owner ?owner=1) — tampilkan/unduh satu lampiran. */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token, id, lampiranId } = await ctx.params;
  const employee = await requirePortalSession(token, req);
  const l = await cariLampiran(employee.id, id, lampiranId);
  if (!l) return notFound("Lampiran tidak ditemukan");
  const berkas = await bacaLampiran(l.path);
  if (!berkas) return notFound("Berkas lampiran tidak ditemukan");
  return responsLampiran(berkas, l.nama);
});

/** PORTAL — hapus lampiran dari pengajuan sendiri selama masih `pending`. */
export const DELETE = route<Ctx>(async (req, ctx) => {
  const { token, id, lampiranId } = await ctx.params;
  const employee = await requirePortalOwner(token, req);
  const l = await cariLampiran(employee.id, id, lampiranId);
  if (!l) return notFound("Lampiran tidak ditemukan");
  if (l.leaveRequest.status !== "pending") {
    return NextResponse.json(
      { message: "Lampiran hanya bisa diubah selama pengajuan masih menunggu." },
      { status: 409 }
    );
  }
  await prisma.leaveLampiran.delete({ where: { id: l.id } });
  await hapusLampiran([l.path]);
  return json({ ok: true });
});
