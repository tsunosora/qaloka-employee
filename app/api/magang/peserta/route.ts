import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { pesertaSchema } from "@/lib/validators/magang";

/** Daftar peserta magang + karyawan yang bisa dijadikan peserta (belum terdaftar). */
export const GET = route(async () => {
  await requireManager();
  const [peserta, calon] = await Promise.all([
    prisma.magangPeserta.findMany({
      where: { employee: { deletedAt: null } },
      orderBy: [{ aktif: "desc" }, { mulai: "asc" }, { id: "asc" }],
      include: { employee: { select: { id: true, fullName: true, nickname: true, publicToken: true, isActive: true } } },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, isActive: true, magangPeserta: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, employeeCode: true },
    }),
  ]);
  return json({
    peserta: peserta.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      nama: p.employee.fullName,
      panggilan: p.employee.nickname,
      publicToken: p.employee.publicToken,
      sekolah: p.sekolah,
      jurusan: p.jurusan,
      guruPembimbing: p.guruPembimbing,
      kontakGuru: p.kontakGuru,
      mulai: toYmd(p.mulai),
      selesai: p.selesai ? toYmd(p.selesai) : null,
      aktif: p.aktif && p.employee.isActive,
      catatan: p.catatan,
    })),
    calon,
  });
});

export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = pesertaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const emp = await prisma.employee.findFirst({ where: { id: d.employeeId, deletedAt: null }, include: { magangPeserta: true } });
  if (!emp) return notFound("Karyawan tidak ditemukan.");
  if (emp.magangPeserta) return NextResponse.json({ message: `${emp.fullName} sudah terdaftar sebagai peserta magang.` }, { status: 409 });
  const p = await prisma.magangPeserta.create({
    data: {
      employeeId: d.employeeId,
      sekolah: d.sekolah,
      jurusan: d.jurusan,
      guruPembimbing: d.guruPembimbing,
      kontakGuru: d.kontakGuru,
      mulai: atMidnight(d.mulai),
      selesai: d.selesai ? atMidnight(d.selesai) : null,
      aktif: d.aktif,
      catatan: d.catatan,
    },
  });
  return json({ id: p.id }, { status: 201 });
});
