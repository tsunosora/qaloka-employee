import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { dataUbahKonten } from "@/lib/services/magang/konten";
import { includeBaris, periksaRujukan, serialisasiBaris } from "@/lib/services/magang/konten-db";
import { ubahKontenSchema } from "@/lib/validators/magang-konten";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Pembina menyunting sel (sebagian kolom): kolom yang tidak dikirim TIDAK diubah. Anak & grup saling meniadakan:
 * memilih anak mengosongkan grup dan sebaliknya. Status final → selesaiAt diisi; kembali ke status bukan final → dikosongkan.
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const session = await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahKontenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const lama = await prisma.magangKonten.findUnique({ where: { id }, select: { id: true, selesaiAt: true } });
  if (!lama) return notFound("Baris jadwal tidak ditemukan (mungkin sudah dihapus).");
  const { tanggal, ...d } = parsed.data;
  const cek = await periksaRujukan(prisma, d);
  if ("galat" in cek) return badRequest({ formErrors: [cek.galat] });

  // Hanya kolom yang dikirim yang ditulis (kolom lain baris ini tidak tersentuh).
  const data: Record<string, unknown> = { ...dataUbahKonten(d, cek.status, lama.selesaiAt), diubahOlehId: await idPengguna(session.user?.email), diubahOlehKaryawanId: null };
  if (tanggal) data.tanggal = atMidnight(tanggal);
  const b = await prisma.magangKonten.update({ where: { id }, data, include: includeBaris });
  return json(serialisasiBaris(b));
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const r = await prisma.magangKonten.deleteMany({ where: { id } });
  if (r.count === 0) return notFound("Baris jadwal tidak ditemukan (mungkin sudah dihapus).");
  return json({ ok: true });
});
