import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { cekBentrok, muatPasangan, pesertaAda } from "@/lib/services/magang/harian-db";
import { pasanganSchema } from "@/lib/validators/magang-harian";

/** Semua pasangan (aktif & nonaktif). */
export const GET = route(async () => {
  await requireManager();
  return json({ pasangan: await muatPasangan(prisma) });
});

/** Buat pasangan. Satu anak paling banyak di SATU pasangan aktif (422 bila bentrok). */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = pasanganSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  if (!(await pesertaAda(prisma, [d.pesertaAId, d.pesertaBId]))) return badRequest({ fieldErrors: { pesertaAId: ["Peserta tidak ditemukan."] } });
  const bentrok = await cekBentrok(prisma, { pesertaAId: d.pesertaAId, pesertaBId: d.pesertaBId, aktif: d.aktif });
  if (bentrok) return badRequest({ fieldErrors: { pesertaAId: [bentrok] } });
  const urutan = d.urutan ?? ((await prisma.magangPasangan.aggregate({ _max: { urutan: true } }))._max.urutan ?? 0) + 1;
  const p = await prisma.magangPasangan.create({
    data: { nama: d.nama, pesertaAId: d.pesertaAId, pesertaBId: d.pesertaBId, patokanTanggal: atMidnight(d.patokanTanggal), patokanTugas: d.patokanTugas, aktif: d.aktif, urutan },
  });
  return json({ id: p.id, pasangan: await muatPasangan(prisma) }, { status: 201 });
});
