import { prisma } from "@/lib/prisma";
import { json, badRequest, notFound, route } from "@/lib/http";
import { nilaiTugasSchema } from "@/lib/validators/magang";
import { dataPenilaian } from "@/lib/services/magang/layanan";
import { requireBimbingan } from "@/lib/services/magang/pembimbing-db";
import { bolehUrus } from "@/lib/services/magang/pembimbing";

type Ctx = { params: Promise<{ token: string; id: string }> };

/** PORTAL (pembimbingnya sendiri; mode owner = 403) — menilai tugas mingguan anak di pos yang dia bimbing. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const { token, id: idTeks } = await ctx.params;
  const { employee, posIds } = await requireBimbingan(token, req, { tulis: true });
  const id = Number(idTeks) || 0;
  const parsed = nilaiTugasSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const t = await prisma.magangTugas.findUnique({ where: { id }, select: { posId: true, skorKuis: true } });
  // Tugas pos lain diperlakukan seperti tidak ada — keberadaannya tidak dibocorkan.
  if (!t || !bolehUrus(t.posId, posIds)) return notFound("Tugas tidak ditemukan.");
  const data = dataPenilaian(t.skorKuis, parsed.data);
  await prisma.magangTugas.update({
    where: { id },
    data: { ...data, dinilaiOlehId: null, dinilaiOlehKaryawanId: employee.id },
  });
  return json({ ok: true, nilai: data.nilai });
});
