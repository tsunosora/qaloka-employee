import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { pesertaSchema } from "@/lib/validators/magang";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = pesertaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const ada = await prisma.magangPeserta.findUnique({ where: { id } });
  if (!ada) return notFound("Peserta tidak ditemukan.");
  const d = parsed.data;
  await prisma.magangPeserta.update({
    where: { id },
    data: {
      sekolah: d.sekolah,
      jurusan: d.jurusan,
      mulai: atMidnight(d.mulai),
      selesai: d.selesai ? atMidnight(d.selesai) : null,
      aktif: d.aktif,
      catatan: d.catatan,
    },
  });
  return json({ ok: true });
});

/**
 * Keluarkan dari program magang: data karyawannya tetap ada di Direktori, tapi penugasan & nilai
 * magangnya ikut terhapus. Untuk anak yang sudah selesai magang, pakai "nonaktif" (PATCH aktif=false)
 * supaya rapornya tetap bisa dicetak.
 */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  if (!(await prisma.magangPeserta.findUnique({ where: { id } }))) return notFound("Peserta tidak ditemukan.");
  await prisma.magangPeserta.delete({ where: { id } });
  return json({ ok: true });
});
