import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { json, badRequest, route } from "@/lib/http";
import { notifyManagers } from "@/lib/notify";
import { requirePortalSession, requirePortalOwner } from "@/lib/services/portal/auth";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { kirimTugasSchema } from "@/lib/validators/magang";
import {
  hariIni,
  keYmd,
  mingguTugas,
  serialisasiTugas,
  soalMinggu,
  penugasanPada,
  mingguKe,
  keadaanJendela,
  jendelaTugas,
  seninDari,
} from "@/lib/services/magang/layanan";
import { tanpaKunci, periksaKuis, ASPEK_PRAKTIK, SKALA, MIN_INGATAN } from "@/lib/services/magang/nilai";

type Ctx = { params: Promise<{ token: string }> };

async function muatPeserta(employeeId: number) {
  return prisma.magangPeserta.findFirst({
    where: { employeeId, aktif: true },
    include: { penugasan: { orderBy: { mulai: "asc" } } },
  });
}

/**
 * PORTAL (butuh PIN) — halaman magang anak: pos minggu ini + target belajarnya, pos berikutnya,
 * tugas mengingat yang bisa diisi (soal TANPA kunci), dan riwayat nilai dari pembimbing.
 */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalSession(token, req);
  const p = await muatPeserta(employee.id);
  if (!p) return json({ peserta: false });

  const hari = hariIni();
  const seninIni = seninDari(hari);
  const pen = p.penugasan.map(keYmd);
  const [pos, riwayat] = await Promise.all([
    prisma.magangPos.findMany({ select: { id: true, nama: true, deskripsi: true, pembimbing: { select: { fullName: true } } } }),
    prisma.magangTugas.findMany({ where: { pesertaId: p.id }, orderBy: { senin: "desc" }, include: { pos: { select: { nama: true } } } }),
  ]);
  const posMap = new Map(pos.map((x) => [x.id, x]));
  const infoPos = (id: number) => ({
    nama: posMap.get(id)?.nama ?? "(pos dihapus)",
    deskripsi: posMap.get(id)?.deskripsi ?? null,
    pembimbing: posMap.get(id)?.pembimbing?.fullName ?? null,
  });

  const ini = penugasanPada(pen, seninIni);
  const berikut = pen.find((a) => a.mulai > seninIni);
  const sudah = new Set(riwayat.map((t) => toYmd(t.senin)));
  const terbuka = mingguTugas(pen, sudah, hari);
  const tugasTerbuka = await Promise.all(
    terbuka.map(async (senin) => {
      const a = penugasanPada(pen, senin)!;
      const soal = await soalMinggu(prisma, p.id, a.posId, senin);
      return {
        senin,
        ...jendelaTugas(senin),
        keadaan: keadaanJendela(senin, hari),
        pos: infoPos(a.posId).nama,
        mingguKe: mingguKe(a, senin),
        dari: a.minggu,
        soal: soal.map(tanpaKunci),
      };
    })
  );

  return json({
    peserta: true,
    hariIni: hari,
    mulai: toYmd(p.mulai),
    selesai: p.selesai ? toYmd(p.selesai) : null,
    posIni: ini ? { ...infoPos(ini.posId), mingguKe: mingguKe(ini, seninIni), dari: ini.minggu, berbagi: ini.berbagi } : null,
    posBerikut: berikut ? { nama: infoPos(berikut.posId).nama, mulai: berikut.mulai } : null,
    jadwal: pen.map((a) => ({ mulai: a.mulai, minggu: a.minggu, pos: infoPos(a.posId).nama })),
    bukaBerikut: ini && !terbuka.includes(seninIni) && !sudah.has(seninIni) ? jendelaTugas(seninIni).buka : null,
    tugasTerbuka,
    riwayat: riwayat.map((t) => ({ ...serialisasiTugas(t), pos: t.pos?.nama ?? "(pos dihapus)" })),
    aspek: ASPEK_PRAKTIK,
    skala: SKALA,
    minIngatan: MIN_INGATAN,
  });
});

/** PORTAL (anaknya sendiri) — kirim tugas mengingat satu minggu. Sekali kirim; tidak bisa diubah. */
export const POST = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalOwner(token, req);
  const p = await muatPeserta(employee.id);
  if (!p) return NextResponse.json({ message: "Kamu tidak terdaftar sebagai peserta magang." }, { status: 404 });

  const parsed = kirimTugasSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { senin, ingatan, jawaban } = parsed.data;

  const hari = hariIni();
  if (senin !== seninDari(senin)) return badRequest({ senin: ["Minggu tidak sah."] });
  if (senin > seninDari(hari)) return badRequest({ senin: ["Minggu ini belum bisa diisi."] });
  const keadaan = keadaanJendela(senin, hari);
  if (keadaan === "belum") return badRequest({ senin: [`Tugas minggu ini dibuka mulai hari Jumat.`] });

  const a = penugasanPada(p.penugasan.map(keYmd), senin);
  if (!a) return badRequest({ senin: ["Kamu tidak punya pos kerja di minggu itu."] });

  const soal = await soalMinggu(prisma, p.id, a.posId, senin);
  const { rincian, skor } = periksaKuis(soal, jawaban);

  try {
    await prisma.magangTugas.create({
      data: {
        pesertaId: p.id,
        senin: atMidnight(senin),
        posId: a.posId,
        ingatan,
        jawabanKuis: rincian as unknown as Prisma.InputJsonValue,
        skorKuis: skor,
        terlambat: keadaan === "terlambat",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ message: "Tugas minggu itu sudah kamu kirim." }, { status: 409 });
    }
    throw e;
  }

  const pos = await prisma.magangPos.findUnique({ where: { id: a.posId }, select: { nama: true } });
  await notifyManagers("magang_tugas", {
    title: `Tugas magang: ${employee.nickname || employee.fullName}`,
    message: `${pos?.nama ?? "Pos"} · minggu ${senin}${skor != null ? ` · kuis ${skor}` : ""} — menunggu dinilai`,
    pesertaId: p.id,
    employeeId: employee.id,
    senin,
  });

  return json({ ok: true, skorKuis: skor, kuis: rincian }, { status: 201 });
});
