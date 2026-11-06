import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { posSchema } from "@/lib/validators/magang";
import { soalDariBaris } from "@/lib/services/magang/layanan";

/** Daftar pos kerja magang + bank soalnya (dengan kunci — ini layar pengelola) + calon pembimbing. */
export const GET = route(async () => {
  await requireManager();
  const [pos, karyawan] = await Promise.all([
    prisma.magangPos.findMany({
      where: { deletedAt: null },
      orderBy: [{ urutan: "asc" }, { id: "asc" }],
      include: {
        pembimbing: { select: { id: true, fullName: true } },
        soal: { orderBy: { id: "asc" } },
      },
    }),
    // Pembimbing = karyawan tetap (bukan anak magang).
    prisma.employee.findMany({
      where: { deletedAt: null, isActive: true, magangPeserta: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);
  return json({
    pos: pos.map((p) => ({
      id: p.id,
      nama: p.nama,
      deskripsi: p.deskripsi,
      durasiMinggu: p.durasiMinggu,
      kapasitas: p.kapasitas,
      urutan: p.urutan,
      aktif: p.aktif,
      pembimbing: p.pembimbing,
      soal: p.soal.map((s) => ({ ...soalDariBaris(s), aktif: s.aktif })),
    })),
    karyawan,
  });
});

export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = posSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const pos = await prisma.magangPos.create({ data: { ...parsed.data, pembimbingId: parsed.data.pembimbingId ?? null } });
  return json(pos, { status: 201 });
});
