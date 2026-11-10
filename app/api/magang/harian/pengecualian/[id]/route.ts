import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { tanpaUndefined } from "@/lib/services/magang/konten";
import { pesertaAda } from "@/lib/services/magang/harian-db";
import { ubahPengecualianSchema } from "@/lib/validators/magang-harian";

type Ctx = { params: Promise<{ id: string }> };

/** Ubah sebagian (tugas / rekan / catatan); kolom yang tidak dikirim tidak diubah. Sasaran/tanggal/jenis tetap. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahPengecualianSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = tanpaUndefined(parsed.data);
  const lama = await prisma.magangHarianPengecualian.findUnique({ where: { id } });
  if (!lama) return notFound("Pengecualian tidak ditemukan.");
  if (d.tugas === null && lama.jenis === "tugas") return badRequest({ fieldErrors: { tugas: ["Pilih tugasnya"] } });
  if (d.tugas != null && lama.jenis === "libur") return badRequest({ fieldErrors: { tugas: ["Hari libur tidak punya tugas"] } });
  if (d.pasanganPesertaId !== undefined) {
    if (lama.jenis !== "pasangan") return badRequest({ fieldErrors: { pasanganPesertaId: ["Rekan hanya untuk ganti pasangan"] } });
    if (d.pasanganPesertaId === lama.pesertaId) return badRequest({ fieldErrors: { pasanganPesertaId: ["Rekan harus anak lain"] } });
    if (!(await pesertaAda(prisma, [d.pasanganPesertaId]))) return notFound("Peserta tidak ditemukan.");
  }
  await prisma.magangHarianPengecualian.update({ where: { id }, data: d });
  return json({ id });
});

/** Hapus pengecualian → hari itu kembali mengikuti pola. */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const r = await prisma.magangHarianPengecualian.deleteMany({ where: { id } });
  if (r.count === 0) return notFound("Pengecualian tidak ditemukan.");
  return json({ ok: true });
});
