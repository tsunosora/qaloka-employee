import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { pesanGalat, rapikanNama, validasiProyek } from "@/lib/services/upah-tarif/aturan";
import { bentukProyek, proyekBaruSchema } from "@/lib/services/upah-tarif/skema";

/** Daftar proyek/event. `?aktif=1` → yang aktif saja (untuk pilihan di rekap). */
export const GET = route(async (req: Request) => {
  await requireManager();
  const hanyaAktif = new URL(req.url).searchParams.get("aktif") === "1";
  const daftar = await prisma.proyekKerja.findMany({
    where: hanyaAktif ? { aktif: true } : undefined,
    orderBy: [{ aktif: "desc" }, { mulai: "desc" }, { nama: "asc" }],
    include: { _count: { select: { rekap: true } } },
  });
  return json(daftar.map(bentukProyek));
});

export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = proyekBaruSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const mulai = d.mulai ? atMidnight(d.mulai) : null;
  const selesai = d.selesai ? atMidnight(d.selesai) : null;

  const galat = validasiProyek({ nama: d.nama, mulai, selesai, upahHarian: d.upahHarian, lemburPerJam: d.lemburPerJam });
  if (galat.length) return json({ message: pesanGalat(galat) }, { status: 422 });

  const p = await prisma.proyekKerja.create({
    data: {
      kode: rapikanNama(d.kode) || null,
      nama: rapikanNama(d.nama),
      lokasi: rapikanNama(d.lokasi) || null,
      mulai,
      selesai,
      upahHarian: d.upahHarian ?? null,
      lemburPerJam: d.lemburPerJam ?? null,
      aktif: d.aktif,
      // sumber "lokal" (bawaan skema); proyek dari Qaloka Event menyusul di Tahap 2.
    },
    include: { _count: { select: { rekap: true } } },
  });
  return json(bentukProyek(p), { status: 201 });
});
