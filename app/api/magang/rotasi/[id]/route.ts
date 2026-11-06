import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { ubahPenugasanSchema } from "@/lib/validators/magang";
import { tambahMinggu } from "@/lib/services/magang/rotasi";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Ganti pos / lama satu penugasan dengan tangan (mis. anak sakit seminggu). Tidak boleh menimpa
 * penugasan berikutnya milik anak yang sama — perpendek dulu, atau susun ulang dari minggu itu.
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahPenugasanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const a = await prisma.magangPenugasan.findUnique({ where: { id } });
  if (!a) return notFound("Penugasan tidak ditemukan.");
  const pos = await prisma.magangPos.findFirst({ where: { id: parsed.data.posId, deletedAt: null } });
  if (!pos) return notFound("Pos tidak ditemukan.");

  const mulai = toYmd(a.mulai);
  const akhir = tambahMinggu(mulai, parsed.data.minggu);
  const tabrak = await prisma.magangPenugasan.findFirst({
    where: { pesertaId: a.pesertaId, id: { not: id }, mulai: { gt: a.mulai, lt: atMidnight(akhir) } },
  });
  if (tabrak) {
    return NextResponse.json(
      { message: "Lama penugasan menabrak penugasan berikutnya. Perpendek, atau susun ulang rotasi mulai minggu ini." },
      { status: 409 }
    );
  }
  // berbagi = pada salah satu minggunya, pos itu sudah penuh oleh anak lain.
  const lain = await prisma.magangPenugasan.findMany({
    where: { posId: pos.id, id: { not: id }, mulai: { lt: atMidnight(akhir) } },
    select: { mulai: true, minggu: true },
  });
  let berbagi = false;
  for (let k = 0; k < parsed.data.minggu && !berbagi; k++) {
    const s = tambahMinggu(mulai, k);
    const isi = lain.filter((o) => toYmd(o.mulai) <= s && s < tambahMinggu(toYmd(o.mulai), o.minggu)).length;
    berbagi = isi >= Math.max(1, pos.kapasitas);
  }
  await prisma.magangPenugasan.update({
    where: { id },
    data: { posId: pos.id, minggu: parsed.data.minggu, berbagi },
  });
  return json({ ok: true });
});
