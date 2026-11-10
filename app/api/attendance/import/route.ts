import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { getSetting } from "@/lib/settings";
import { nextEmployeeCode } from "@/lib/services/employee-code";
import { bolehMenambah } from "@/lib/lisensi/penjaga";
import { loadShiftConfig } from "@/lib/services/attendance/shift";
import { jadwalEfektif } from "@/lib/services/jadwal-shift/efektif";
import { muatPetaJamMagang } from "@/lib/services/magang/jam-kerja-db";
import { analyzeScanlog, describeScanlogFailure } from "@/lib/services/attendance/import-html";
import {
  buildImportPreview,
  deriveScans,
  type ImportEmployee,
  type ImportPreviewRow,
} from "@/lib/services/attendance/import-map";

export const runtime = "nodejs";

const IMPORT_MACHINE = "import-html";

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dayRange(d: string) {
  const start = new Date(`${d}T00:00:00`);
  return { start, end: new Date(start.getTime() + 86400000) };
}

async function loadEmployees(): Promise<ImportEmployee[]> {
  const emps = await prisma.employee.findMany({
    where: { deletedAt: null, isActive: true },
    include: { workSchedule: true },
  });
  return emps.map((e) => ({
    id: e.id,
    machinePin: e.machinePin,
    fullName: e.fullName,
    workSchedule: e.workSchedule
      ? {
          startTime: e.workSchedule.startTime,
          endTime: e.workSchedule.endTime,
          lateToleranceMinutes: e.workSchedule.lateToleranceMinutes,
          isHoliday: e.workSchedule.isHoliday,
          flexibleHours: e.workSchedule.flexibleHours,
        }
      : null,
  }));
}

/** Baris preview + info conflict lintas-mesin untuk dikirim ke klien. */
type EnrichedRow = ImportPreviewRow & { conflict: boolean; existingSources: string[] };

/** PUBLIK — import scanlog HTML mesin. Mode preview (commit!="true") atau commit ber-izin. */
export const POST = route(async (req: Request) => {
  await requireManager();

  const formData = await req.formData();
  const file = formData.get("file");
  const commit = formData.get("commit") === "true";
  const overwriteConflicts = formData.get("overwriteConflicts") === "true";
  const createMissing = formData.get("createMissing") === "true";
  if (!(file instanceof Blob)) return badRequest({ file: ["File tidak ada"] });

  const html = await file.text();
  const analysis = analyzeScanlog(html);
  const parsed = analysis.rows;
  if (parsed.length === 0) return badRequest({ file: [describeScanlogFailure(analysis)] });

  // Hari libur: rumus sama dgn aggregateAttendance.
  const [initialEmployees, holidayRows, autoSundayRaw, shiftConfig] = await Promise.all([
    loadEmployees(),
    prisma.holiday.findMany(),
    getSetting("auto_sunday_holiday"),
    loadShiftConfig(),
  ]);
  const holidayDates = new Set(holidayRows.map((h) => dateKey(h.date)));
  const autoSunday = autoSundayRaw === "true";
  let employees = initialEmployees;

  // Opsional: buat karyawan baru dari PIN yang belum dikenal (Nama + PIN dari file).
  let createdEmployees = 0;
  let tertahanBatas = 0;
  if (createMissing && !commit) {
    const existingPins = new Set(employees.map((e) => e.machinePin).filter(Boolean));
    const namesByPin = new Map<string, string>();
    for (const r of parsed) if (!namesByPin.has(r.pin)) namesByPin.set(r.pin, r.name);
    for (const [pin, name] of namesByPin) {
      if (existingPins.has(pin)) continue;
      if (!(await bolehMenambah("limit.employees"))) { tertahanBatas++; continue; }
      const fullName = name || `Karyawan PIN ${pin}`;
      const code = await nextEmployeeCode(prisma, fullName);
      await prisma.employee.create({
        data: { employeeCode: code, machinePin: pin, publicToken: randomUUID(), fullName },
      });
      createdEmployees++;
    }
    if (createdEmployees > 0) employees = await loadEmployees();
  }

  // Jadwal per tanggal (roster) untuk rentang tanggal di file — menang atas jadwal tetap.
  const tanggalFile = parsed.map((p) => p.dateISO).sort();
  const peta = await jadwalEfektif(
    prisma,
    employees.map((e) => e.id),
    tanggalFile[0],
    tanggalFile[tanggalFile.length - 1]
  );
  // Jam kerja khusus anak magang (peserta aktif dalam masanya); karyawan biasa → null → tak berubah.
  const jamMagang = await muatPetaJamMagang(prisma, shiftConfig.lateToleranceMinutes, employees.map((e) => e.id));
  const preview = buildImportPreview(parsed, employees, {
    holidayDates,
    autoSunday,
    shiftConfig,
    jadwalHari: peta.jumlahRoster > 0 ? (id, d) => peta.get(id, d) : null,
    jamMagang: jamMagang.employeeIds.length > 0 ? (id, d) => jamMagang.get(id, d) : null,
  });

  // Deteksi conflict: absensi eksisting hari itu dari mesin != import-html.
  const matched = preview.rows.filter((r) => r.matched && r.employeeId != null);
  const conflictDays = new Map<string, Set<string>>(); // "empId|date" -> set(machineName)
  if (matched.length > 0) {
    const empIds = [...new Set(matched.map((r) => r.employeeId!))];
    const sorted = [...matched].map((r) => r.dateISO).sort();
    const start = new Date(`${sorted[0]}T00:00:00`);
    const end = new Date(new Date(`${sorted[sorted.length - 1]}T00:00:00`).getTime() + 86400000);
    const existing = await prisma.attendance.findMany({
      where: { employeeId: { in: empIds }, scanDate: { gte: start, lt: end } },
      select: { employeeId: true, scanDate: true, machineName: true },
    });
    for (const a of existing) {
      const key = `${a.employeeId}|${dateKey(a.scanDate)}`;
      const set = conflictDays.get(key) ?? new Set<string>();
      set.add(a.machineName ?? "unknown");
      conflictDays.set(key, set);
    }
  }

  const rows: EnrichedRow[] = preview.rows.map((r) => {
    if (!r.matched || r.employeeId == null) return { ...r, conflict: false, existingSources: [] };
    const sources = conflictDays.get(`${r.employeeId}|${r.dateISO}`) ?? new Set<string>();
    const foreign = [...sources].filter((s) => s !== IMPORT_MACHINE);
    return { ...r, conflict: foreign.length > 0, existingSources: foreign };
  });
  const conflicts = rows.filter((r) => r.conflict).length;

  if (!commit) {
    return json({ rows, summary: { ...preview.summary, conflicts }, committed: false, createdEmployees, tertahanBatas });
  }

  // Commit ber-izin: hari conflict hanya ditimpa bila overwriteConflicts.
  let created = 0;
  let skippedConflicts = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const row of rows) {
        if (!row.matched || row.employeeId == null) continue;
        if (row.conflict && !overwriteConflicts) {
          skippedConflicts++;
          continue;
        }
        const source = parsed.find((p) => p.pin === row.pin && p.dateISO === row.dateISO);
        const derived = deriveScans(source?.scans ?? [], 12, shiftConfig);
        if (derived.length === 0) continue;

        const { start, end } = dayRange(row.dateISO);
        await tx.attendance.deleteMany({
          where: { employeeId: row.employeeId, scanDate: { gte: start, lt: end } },
        });
        await tx.attendance.createMany({
          data: derived.map((d) => ({
            employeeId: row.employeeId!,
            scanDate: new Date(`${row.dateISO}T${d.time}`),
            scanType: d.scanType,
            status: row.status,
            lateMinutes: d.scanType === "in" ? row.lateMinutes : 0,
            overtimeMinutes: d.scanType === "out" ? row.overtimeMinutes : 0,
            machineName: IMPORT_MACHINE,
          })),
        });
        created += derived.length;
      }
    },
    { timeout: 30_000 }
  );

  return json({
    rows,
    summary: { ...preview.summary, conflicts },
    committed: true,
    created,
    skippedConflicts,
  });
});
