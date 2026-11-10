import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { tanpaUndefined } from "@/lib/services/magang/konten";
import { cekBentrok, muatPasangan, pesertaAda } from "@/lib/services/magang/harian-db";
import { ubahPasanganSchema } from "@/lib/validators/magang-harian";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ubah sebagian: kolom yang tidak dikirim TIDAK diubah (route menulis tanpaUndefined). Aturan dua anak berbeda &
 * satu-pasangan-aktif dicek pada gabungan data lama + kiriman.
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahPasanganSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = tanpaUndefined(parsed.data);
  const lama = await prisma.magangPasangan.findUnique({ where: { id } });
  if (!lama) return notFound("Pasangan tidak ditemukan.");
  const gabung = {
    id,
    pesertaAId: d.pesertaAId ?? lama.pesertaAId,
    pesertaBId: d.pesertaBId !== undefined ? d.pesertaBId : lama.pesertaBId,
    aktif: d.aktif ?? lama.aktif,
  };
  if (gabung.pesertaAId === gabung.pesertaBId) return badRequest({ fieldErrors: { pesertaBId: ["Dua anak dalam pasangan harus berbeda"] } });
  if (!(await pesertaAda(prisma, [d.pesertaAId, d.pesertaBId]))) return badRequest({ fieldErrors: { pesertaAId: ["Peserta tidak ditemukan."] } });
  const bentrok = await cekBentrok(prisma, gabung);
  if (bentrok) return badRequest({ fieldErrors: { pesertaAId: [bentrok] } });
  const { patokanTanggal, ...lain } = d;
  await prisma.magangPasangan.update({ where: { id }, data: { ...lain, ...(patokanTanggal !== undefined ? { patokanTanggal: atMidnight(patokanTanggal) } : {}) } });
  return json({ pasangan: await muatPasangan(prisma) });
});

/** Hapus pasangan (pengecualian tingkat pasangan ikut terhapus). Lebih aman: nonaktifkan lewat PATCH {aktif:false}. */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const r = await prisma.magangPasangan.deleteMany({ where: { id } });
  if (r.count === 0) return notFound("Pasangan tidak ditemukan.");
  return json({ pasangan: await muatPasangan(prisma) });
});
