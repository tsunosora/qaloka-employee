import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, badRequest, notFound, route } from "@/lib/http";
import { requirePortalOwner } from "@/lib/services/portal/auth";
import { lampiranDariForm, simpanLampiran, denganLampiran, metaLampiran } from "@/lib/services/leave/lampiran";

type Ctx = { params: Promise<{ token: string; id: string }> };

/**
 * PORTAL — tambah lampiran (multipart, medan `lampiran`) ke pengajuan SENDIRI yang masih
 * `pending`. Owner (?owner=1) hanya melihat. Total lampiran tetap maks 3 per pengajuan.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const { token, id } = await ctx.params;
  const employee = await requirePortalOwner(token, req);

  const request = await prisma.leaveRequest.findFirst({
    where: { id: Number(id) || 0, employeeId: employee.id },
    select: { id: true, status: true, _count: { select: { lampiran: true } } },
  });
  if (!request) return notFound("Pengajuan tidak ditemukan");
  if (request.status !== "pending") {
    return NextResponse.json(
      { message: "Lampiran hanya bisa diubah selama pengajuan masih menunggu." },
      { status: 409 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { message: "Kiriman tidak terbaca — mungkin berkasnya terlalu besar. Coba kirim berkas yang lebih kecil." },
      { status: 413 }
    );
  }
  const cek = await lampiranDariForm(form, request._count.lampiran);
  if (!cek.ok) return badRequest({ lampiran: [cek.error] });
  if (cek.berkas.length === 0) return badRequest({ lampiran: ["Pilih berkas yang mau dilampirkan."] });

  const tersimpan = await simpanLampiran(cek.berkas);
  const dibuat = await denganLampiran(tersimpan, () =>
    prisma.$transaction(
      tersimpan.map((t) => prisma.leaveLampiran.create({ data: { leaveRequestId: request.id, ...t } }))
    )
  );
  return json({ lampiran: dibuat.map(metaLampiran) }, { status: 201 });
});
