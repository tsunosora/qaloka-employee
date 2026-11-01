import { prisma } from "@/lib/prisma";
import { mapScanlogs, type RawScan } from "@/lib/services/fingerspot/mapper";

/**
 * PUBLIK (whitelist proxy) — proses raw log Fingerspot yang belum diproses
 * menjadi record Attendance. Best-effort: mengambil scan dari kolom pin/scanAt
 * atau dari array `scans`/`data` di rawBody bila ada.
 */
export async function POST(req: Request) {
  // sec-gate: endpoint internal, tak ada pemanggil publik yang sah — wajib CRON_SECRET (fail-closed).
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, message: "CRON_SECRET belum diset." }, { status: 503 });
  const provided = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (provided !== secret) return Response.json({ ok: false, message: "unauthorized" }, { status: 401 });

  const logs = await prisma.fingerspotRawLog.findMany({
    where: { processed: false },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  if (logs.length === 0) return Response.json({ processed: 0, created: 0 });

  // Kumpulkan scan mentah dari tiap log.
  const raws: RawScan[] = [];
  for (const log of logs) {
    if (log.pin && log.scanAt) {
      raws.push({ pin: log.pin, scanAt: log.scanAt });
      continue;
    }
    const body = log.rawBody as Record<string, unknown> | null;
    const arr = (body?.scans ?? body?.data) as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(arr)) {
      for (const s of arr) {
        const pin = (s.pin ?? s.PIN ?? s.userid) as string | undefined;
        const at = (s.scan ?? s.scan_date ?? s.time ?? s.datetime) as string | undefined;
        if (pin && at) raws.push({ pin: String(pin), scanAt: at });
      }
    }
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, machinePin: { not: null } },
    select: { id: true, machinePin: true },
  });
  const codeToId = Object.fromEntries(
    employees.map((e) => [e.machinePin as string, e.id])
  );

  const { mapped } = mapScanlogs(raws, { codeToId });

  let created = 0;
  for (const m of mapped) {
    // Dedup terhadap DB: (employeeId, scanDate) unik.
    const exists = await prisma.attendance.findFirst({
      where: { employeeId: m.employeeId, scanDate: m.scanDate },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.attendance.create({
      data: {
        employeeId: m.employeeId,
        scanDate: m.scanDate,
        scanType: m.scanType,
        status: "on_time",
        machineName: "fingerspot",
      },
    });
    created++;
  }

  await prisma.fingerspotRawLog.updateMany({
    where: { id: { in: logs.map((l) => l.id) } },
    data: { processed: true },
  });

  return Response.json({ processed: logs.length, created });
}
