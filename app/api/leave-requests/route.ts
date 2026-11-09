import type { LeaveStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireManager, json, route } from "@/lib/http";
import { countDays } from "@/lib/services/leave/range";
import { toYmd } from "@/lib/services/leave/service";
import { metaLampiran } from "@/lib/services/leave/lampiran";

const STATUSES = new Set(["pending", "approved", "rejected", "cancelled"]);

/** Daftar pengajuan izin untuk dashboard owner/manajemen. */
export const GET = route(async (req: Request) => {
  await requireManager();
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const perPage = 20;

  const status = sp.get("status");
  const employeeId = sp.get("employee_id");
  const where: Prisma.LeaveRequestWhereInput = {
    ...(status && STATUSES.has(status) ? { status: status as LeaveStatus } : {}),
    ...(employeeId ? { employeeId: Number(employeeId) } : {}),
  };

  const [items, total, pending] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { startDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true, department: { select: { name: true } } } },
        decidedBy: { select: { name: true } },
        lampiran: { select: { id: true, nama: true, tipe: true, ukuran: true }, orderBy: { id: "asc" } },
      },
    }),
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.count({ where: { status: "pending" } }),
  ]);

  return json({
    items: items.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee.fullName,
      employeeCode: r.employee.employeeCode,
      department: r.employee.department?.name ?? null,
      startDate: toYmd(r.startDate),
      endDate: toYmd(r.endDate),
      days: countDays(toYmd(r.startDate), toYmd(r.endDate)),
      type: r.type,
      reason: r.reason,
      status: r.status,
      source: r.source,
      decisionNote: r.decisionNote,
      decidedAt: r.decidedAt,
      decidedBy: r.decidedBy?.name ?? null,
      createdAt: r.createdAt,
      lampiran: r.lampiran.map(metaLampiran),
    })),
    total,
    page,
    perPage,
    pending,
  });
});
