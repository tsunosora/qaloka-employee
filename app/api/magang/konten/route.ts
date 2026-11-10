import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { hariIni } from "@/lib/services/magang/layanan";
import { bulanSah, selesaiAtBaru } from "@/lib/services/magang/konten";
import { dataBulan, includeBaris, muatStatus, periksaRujukan, serialisasiBaris, statusAwal } from "@/lib/services/magang/konten-db";
import { kontenBaruSchema } from "@/lib/validators/magang-konten";

/**
 * Jadwal konten satu bulan (?bulan=YYYY-MM, bawaan bulan ini) + konsep, status, grup, anak, platform, brief, pola, libur.
 * ?platform=<id> → baris & brief platform itu; ?platform=semua → semua platform (brief null). Tanpa ?platform →
 * platform aktif pertama (atau "semua" bila belum ada platform aktif).
 */
export const GET = route(async (req: Request) => {
  await requireManager();
  const q = new URL(req.url).searchParams;
  const bulan = q.get("bulan") ?? hariIni().slice(0, 7);
  if (!bulanSah(bulan)) return badRequest({ bulan: ["Format bulan harus YYYY-MM"] });
  const mentah = q.get("platform");
  let platform: number | "semua";
  if (mentah === "semua") platform = "semua";
  else if (mentah) {
    platform = Number(mentah);
    if (!Number.isInteger(platform) || platform <= 0) return badRequest({ platform: ['Platform harus id atau "semua"'] });
    if (!(await prisma.magangKontenPlatform.findUnique({ where: { id: platform }, select: { id: true } }))) return notFound("Platform tidak ditemukan.");
  } else {
    const pertama = await prisma.magangKontenPlatform.findFirst({ where: { aktif: true }, orderBy: [{ urutan: "asc" }, { id: "asc" }], select: { id: true } });
    platform = pertama?.id ?? "semua";
  }
  return json(await dataBulan(prisma, bulan, platform));
});

/** Tambah satu baris di satu platform (mis. baris kedua di tanggal yang sama). Status bawaan = status awal. */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = kontenBaruSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const statusId = d.statusId ?? statusAwal(await muatStatus(prisma))?.id;
  if (!statusId) return NextResponse.json({ message: "Belum ada status aktif. Tambahkan di Setelan → Status." }, { status: 409 });
  const cek = await periksaRujukan(prisma, { platformId: d.platformId, konsepId: d.konsepId, pesertaId: d.pesertaId, grupId: d.grupId, statusId });
  if ("galat" in cek) return badRequest({ formErrors: [cek.galat] });
  const tanggal = atMidnight(d.tanggal);
  const terakhir = await prisma.magangKonten.findFirst({ where: { tanggal, platformId: d.platformId }, orderBy: { urutan: "desc" }, select: { urutan: true } });
  const b = await prisma.magangKonten.create({
    data: {
      platformId: d.platformId,
      tanggal,
      konsepId: d.konsepId,
      pesertaId: d.pesertaId ?? null,
      grupId: d.grupId ?? null,
      statusId,
      judul: d.judul,
      ref: d.ref,
      caption: d.caption,
      linkFootage: d.linkFootage,
      linkEkspor: d.linkEkspor,
      catatan: d.catatan,
      usulan: d.usulan,
      urutan: terakhir ? terakhir.urutan + 1 : 0,
      selesaiAt: selesaiAtBaru(!!cek.status?.final, null),
      diubahOlehId: await idPengguna(session.user?.email),
    },
    include: includeBaris,
  });
  return json(serialisasiBaris(b), { status: 201 });
});
