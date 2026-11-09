import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, badRequest, route } from "@/lib/http";
import { notifyManagers } from "@/lib/notify";
import { requirePortalSession, requirePortalOwner } from "@/lib/services/portal/auth";
import { leaveRequestSchema } from "@/lib/validators/portal";
import { validateLeaveRange, countDays } from "@/lib/services/leave/range";
import {
  atMidnight,
  toYmd,
  findOverlapping,
  leaveNotificationData,
} from "@/lib/services/leave/service";
import {
  lampiranDariForm,
  simpanLampiran,
  denganLampiran,
  metaLampiran,
  type LampiranTersimpan,
} from "@/lib/services/leave/lampiran";

type Ctx = { params: Promise<{ token: string }> };

function serialize(r: {
  id: number;
  startDate: Date;
  endDate: Date;
  type: string;
  reason: string;
  status: string;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  lampiran?: { id: number; nama: string; tipe: string; ukuran: number }[];
}) {
  return {
    id: r.id,
    startDate: toYmd(r.startDate),
    endDate: toYmd(r.endDate),
    days: countDays(toYmd(r.startDate), toYmd(r.endDate)),
    type: r.type,
    reason: r.reason,
    status: r.status,
    decisionNote: r.decisionNote,
    decidedAt: r.decidedAt,
    createdAt: r.createdAt,
    lampiran: (r.lampiran ?? []).map(metaLampiran),
  };
}

const PILIH_LAMPIRAN = {
  lampiran: { select: { id: true, nama: true, tipe: true, ukuran: true }, orderBy: { id: "asc" as const } },
};

/** PORTAL (butuh PIN) — riwayat pengajuan izin milik karyawan ini. */
export const GET = route<Ctx>(async (_req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalSession(token, _req);
  const items = await prisma.leaveRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    take: 30,
    include: PILIH_LAMPIRAN,
  });
  return json({ items: items.map(serialize) });
});

/**
 * PORTAL (butuh PIN) — ajukan izin/sakit/cuti. Masuk sebagai `pending`, menunggu owner.
 * Body JSON, atau multipart (medan yang sama + berkas `lampiran` 0–3: foto surat dokter / PDF).
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalOwner(token, req);

  let body: unknown = null;
  let form: FormData | null = null;
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { message: "Kiriman tidak terbaca — mungkin berkasnya terlalu besar. Coba kirim berkas yang lebih kecil." },
        { status: 413 }
      );
    }
    body = {
      type: form.get("type"),
      startDate: form.get("startDate"),
      endDate: form.get("endDate") || null,
      reason: form.get("reason"),
    };
  } else {
    body = await req.json().catch(() => null);
  }

  const parsed = leaveRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const { type, reason } = parsed.data;
  const startStr = parsed.data.startDate;
  const endStr = parsed.data.endDate || startStr;

  const check = validateLeaveRange(startStr, endStr, toYmd(new Date()));
  if (!check.ok) return badRequest({ startDate: [check.error] });

  const clash = await findOverlapping(prisma, employee.id, startStr, endStr);
  if (clash) {
    return NextResponse.json(
      {
        message: `Sudah ada pengajuan ${clash.type} (${clash.status}) pada ${toYmd(
          clash.startDate
        )}–${toYmd(clash.endDate)}.`,
      },
      { status: 409 }
    );
  }

  // Semua berkas diperiksa dulu; baru ditulis bila semuanya lolos.
  let tersimpan: LampiranTersimpan[] = [];
  if (form) {
    const cek = await lampiranDariForm(form);
    if (!cek.ok) return badRequest({ lampiran: [cek.error] });
    tersimpan = await simpanLampiran(cek.berkas);
  }

  // Gagal simpan ke basis data → berkas yang sudah tertulis dihapus lagi.
  const created = await denganLampiran(tersimpan, () =>
    prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        startDate: atMidnight(startStr),
        endDate: atMidnight(endStr),
        type,
        reason,
        source: "portal",
        ...(tersimpan.length > 0 ? { lampiran: { create: tersimpan } } : {}),
      },
      include: PILIH_LAMPIRAN,
    })
  );

  await notifyManagers(
    "leave_request",
    leaveNotificationData({
      leaveRequestId: created.id,
      employeeId: employee.id,
      employeeName: employee.fullName,
      type,
      startStr,
      endStr,
    })
  );

  return json(serialize(created), { status: 201 });
});
