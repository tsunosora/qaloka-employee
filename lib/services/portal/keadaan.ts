import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireEmployeeByToken, portalSecret, viewerIsManager, managerModeRequested, type PortalEmployee } from "./auth";
import { PORTAL_COOKIE, verifyPortalToken } from "./session";
import { posproPinAvailable } from "@/lib/services/pospro/client";
import { fiturTampil } from "@/lib/lisensi/penjaga";

/** Kode fitur tab portal yang bisa tidak termasuk paket (tab lain = isi paket Kinerja). */
export const FITUR_TAB_PORTAL = ["hr.overtime", "hr.reimbursement", "hr.visits", "hr.timesheet", "hr.assessment"] as const;

/**
 * Keadaan layar PIN untuk satu tautan karyawan: identitas ringkas, PIN sudah dibuat atau
 * belum, dan apakah pengunjung sudah lewat PIN. Dipakai portal (/me) DAN absen HP (/absen) —
 * satu cookie sesi, satu PIN. Data sensitif TIDAK ada di sini.
 */
export async function keadaanPortal(req: Request, token: string): Promise<{
  employee: PortalEmployee;
  publik: {
    employee: { fullName: string; nickname: string | null; position: string | null; department: string | null; photoPath: string | null };
    pinSet: boolean;
    posproPin: boolean;
    asManager: boolean;
    authenticated: boolean;
    /** Tab portal yang fiturnya termasuk paket (kosmetik; rute API yang menolak sungguhan). */
    fitur: Record<string, boolean>;
    /** Karyawan ini peserta magang aktif → tab Magang tampil. */
    magang: boolean;
  };
}> {
  const employee = await requireEmployeeByToken(token);

  const store = await cookies();
  const session = verifyPortalToken(store.get(PORTAL_COOKIE)?.value, token, portalSecret());
  // PIN PosPro (PIN desainer/piket) boleh dipakai masuk, supaya karyawan tak perlu
  // mengingat dua PIN. false bila belum dipetakan / tak punya PIN / PosPro mati.
  const posproPin = await posproPinAvailable(employee.posproUserId);
  // Owner/HR/Admin boleh langsung melihat — TAPI harus meminta tegas lewat ?owner=1.
  // Tanpa penanda itu, tautan yang sama berperilaku sama persis bagi siapa pun,
  // sehingga owner bisa memeriksa apa yang benar-benar dilihat karyawannya.
  const asManager = managerModeRequested(req) && (await viewerIsManager());

  return {
    employee,
    publik: {
      employee: {
        fullName: employee.fullName,
        nickname: employee.nickname,
        position: employee.position?.name ?? null,
        department: employee.department?.name ?? null,
        photoPath: employee.photoPath,
      },
      pinSet: employee.portalPin !== null,
      posproPin,
      asManager,
      authenticated: session?.employeeId === employee.id || asManager,
      fitur: await fiturTampil(FITUR_TAB_PORTAL),
      magang: (await prisma.magangPeserta.count({ where: { employeeId: employee.id, aktif: true } })) > 0,
    },
  };
}
