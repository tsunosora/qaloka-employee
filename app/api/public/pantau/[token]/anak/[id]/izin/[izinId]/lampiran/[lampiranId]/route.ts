import { prisma } from "@/lib/prisma";
import { route } from "@/lib/http";
import { bacaLampiran, disposisiLampiran } from "@/lib/services/leave/lampiran";
import { anakAtau404, requireSesiPantau, responsBerkas, tidakAda } from "@/lib/services/magang/pantau-db";

type Ctx = { params: Promise<{ token: string; id: string; izinId: string; lampiranId: string }> };

/** GURU — lampiran surat izin/sakit, HANYA bila admin menyalakan "Guru boleh melihat lampiran". */
export const GET = route<Ctx>(async (_req, ctx) => {
  const { token, id, izinId, lampiranId } = await ctx.params;
  const t = await requireSesiPantau(token);
  if (!t.tampilLampiranIzin) return tidakAda();
  const p = await anakAtau404(t, id);
  const l = await prisma.leaveLampiran.findFirst({
    where: { id: Number(lampiranId) || 0, leaveRequestId: Number(izinId) || 0, leaveRequest: { employeeId: p.employeeId } },
    select: { path: true, nama: true },
  });
  const f = l ? await bacaLampiran(l.path) : null;
  return f && l ? responsBerkas(f.bita, f.tipe, disposisiLampiran(f.tipe, l.nama)) : tidakAda();
});
