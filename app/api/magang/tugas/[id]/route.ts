import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { nilaiTugasSchema } from "@/lib/validators/magang";
import { hitungNilai } from "@/lib/services/magang/layanan";
import { idPengguna } from "@/lib/services/reimbursement/service";

type Ctx = { params: Promise<{ id: string }> };

/** Pembimbing/owner menilai satu tugas mingguan. Boleh dinilai ulang; nilai dihitung di server. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const session = await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = nilaiTugasSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const t = await prisma.magangTugas.findUnique({ where: { id } });
  if (!t) return notFound("Tugas tidak ditemukan.");
  const d = parsed.data;
  const nilai = hitungNilai({ skorKuis: t.skorKuis, ...d });
  await prisma.magangTugas.update({
    where: { id },
    data: { ...d, nilai, dinilaiAt: new Date(), dinilaiOlehId: await idPengguna(session.user?.email) },
  });
  return json({ ok: true, nilai });
});
