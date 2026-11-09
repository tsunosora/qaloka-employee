import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { tautanDaftarSchema } from "@/lib/validators/magang";
import { hariIni } from "@/lib/services/magang/layanan";
import { keadaanTautan } from "@/lib/services/magang/pendaftaran";

/** Tautan pendaftaran mandiri + pendaftar (menunggu dulu, lalu 30 keputusan terakhir). */
export const GET = route(async () => {
  await requireManager();
  const hari = hariIni();
  const [tautan, menunggu, diputus] = await Promise.all([
    prisma.magangDaftar.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { pendaftar: true } } },
    }),
    prisma.magangPendaftar.findMany({ where: { status: "menunggu" }, orderBy: { createdAt: "asc" }, include: { daftar: { select: { label: true } } } }),
    prisma.magangPendaftar.findMany({ where: { status: { not: "menunggu" } }, orderBy: { diputusAt: "desc" }, take: 30 }),
  ]);
  const baris = (p: (typeof menunggu)[number] | (typeof diputus)[number]) => ({
    id: p.id,
    namaLengkap: p.namaLengkap,
    panggilan: p.panggilan,
    hp: p.hp,
    sekolah: p.sekolah,
    jurusan: p.jurusan,
    guruPembimbing: p.guruPembimbing,
    kontakGuru: p.kontakGuru,
    mulai: toYmd(p.mulai),
    selesai: p.selesai ? toYmd(p.selesai) : null,
    status: p.status,
    alasanTolak: p.alasanTolak,
    dikirimAt: p.createdAt.toISOString(),
    tautan: "daftar" in p ? p.daftar.label : null,
  });
  return json({
    tautan: tautan.map((t) => ({
      id: t.id,
      kode: t.kode,
      label: t.label,
      sekolah: t.sekolah,
      berlakuSampai: toYmd(t.berlakuSampai),
      mulaiMagang: t.mulaiMagang ? toYmd(t.mulaiMagang) : null,
      selesaiMagang: t.selesaiMagang ? toYmd(t.selesaiMagang) : null,
      keadaan: keadaanTautan(t, hari),
      jumlahPendaftar: t._count.pendaftar,
    })),
    menunggu: menunggu.map(baris),
    diputus: diputus.map(baris),
  });
});

/** Buat tautan pendaftaran baru. */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = tautanDaftarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  if (d.berlakuSampai < hariIni()) return badRequest({ berlakuSampai: ["Tanggal berlaku sudah lewat."] });
  const t = await prisma.magangDaftar.create({
    data: {
      kode: randomUUID(),
      label: d.label,
      sekolah: d.sekolah,
      berlakuSampai: atMidnight(d.berlakuSampai),
      mulaiMagang: d.mulaiMagang ? atMidnight(d.mulaiMagang) : null,
      selesaiMagang: d.selesaiMagang ? atMidnight(d.selesaiMagang) : null,
    },
  });
  return json({ id: t.id, kode: t.kode }, { status: 201 });
});
