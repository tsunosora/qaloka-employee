import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { hariIni } from "@/lib/services/magang/layanan";
import { bulanSah, selesaiAtBaru } from "@/lib/services/magang/konten";
import { dataBulan, includeBaris, muatStatus, periksaRujukan, serialisasiBaris, statusAwal } from "@/lib/services/magang/konten-db";
import { kontenBaruSchema } from "@/lib/validators/magang-konten";

/** Jadwal konten satu bulan (?bulan=YYYY-MM, bawaan bulan ini) + konsep, status, grup, anak, brief, pola, libur. */
export const GET = route(async (req: Request) => {
  await requireManager();
  const q = new URL(req.url).searchParams.get("bulan") ?? hariIni().slice(0, 7);
  if (!bulanSah(q)) return badRequest({ bulan: ["Format bulan harus YYYY-MM"] });
  return json(await dataBulan(prisma, q));
});

/** Tambah satu baris (mis. baris kedua di tanggal yang sama). Status bawaan = status awal. */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = kontenBaruSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const statusId = d.statusId ?? statusAwal(await muatStatus(prisma))?.id;
  if (!statusId) return NextResponse.json({ message: "Belum ada status aktif. Tambahkan di Setelan → Status." }, { status: 409 });
  const cek = await periksaRujukan(prisma, { konsepId: d.konsepId, pesertaId: d.pesertaId, grupId: d.grupId, statusId });
  if ("galat" in cek) return badRequest({ formErrors: [cek.galat] });
  const tanggal = atMidnight(d.tanggal);
  const terakhir = await prisma.magangKonten.findFirst({ where: { tanggal }, orderBy: { urutan: "desc" }, select: { urutan: true } });
  const b = await prisma.magangKonten.create({
    data: {
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
