import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, badRequest, route } from "@/lib/http";
import { requirePortalSession, requirePortalOwner } from "@/lib/services/portal/auth";
import { atMidnight } from "@/lib/services/leave/service";
import { jurnalSchema } from "@/lib/validators/magang";
import { medanForm } from "@/lib/services/reimbursement/service";
import { pesertaPortal, posPada, serialisasiJurnal, tanggalBolehIsi } from "@/lib/services/magang/jurnal-db";
import { daftarFoto, MAKS_FOTO, MIN_KEGIATAN } from "@/lib/services/magang/jurnal";
import { fotoDariForm, hapusFoto } from "@/lib/services/magang/foto";

type Ctx = { params: Promise<{ token: string }> };

/**
 * PORTAL (butuh PIN) — jurnal harian anak: tanggal yang boleh diisi, isian tanggal-tanggal itu,
 * dan riwayat. Selama tugas mengingat mingguan belum dikirim, riwayat TIDAK dikirim sama sekali.
 */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalSession(token, req);
  const p = await pesertaPortal(employee.id);
  if (!p) return json({ peserta: false });

  const bolehIsi = tanggalBolehIsi(p.hari, p.masa, p.libur);
  const isian = await prisma.magangJurnal.findMany({
    where: {
      pesertaId: p.id,
      ...(p.tugasTerbuka ? { tanggal: { in: bolehIsi.map(atMidnight) } } : {}),
    },
    orderBy: { tanggal: "desc" },
    take: 30,
    include: { pos: { select: { nama: true } } },
  });
  return json({
    peserta: true,
    hariIni: p.hari,
    bolehIsi,
    riwayatDitahan: p.tugasTerbuka,
    maksFoto: MAKS_FOTO,
    minKegiatan: MIN_KEGIATAN,
    isian: isian.map((j) => serialisasiJurnal(j, { hari: p.hari, masa: p.masa, libur: p.libur })),
  });
});

/** PORTAL (anaknya sendiri) — simpan/sunting jurnal satu tanggal. Multipart: tanggal, kegiatan, kendala, hapusFoto, foto[]. */
export const POST = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalOwner(token, req);
  const p = await pesertaPortal(employee.id);
  if (!p) return NextResponse.json({ message: "Kamu tidak terdaftar sebagai peserta magang." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest({ formErrors: ["Kiriman tidak terbaca. Coba lagi."] });
  const parsed = jurnalSchema.safeParse(medanForm(form, ["tanggal", "kegiatan", "kendala", "hapusFoto"]));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;

  if (!tanggalBolehIsi(p.hari, p.masa, p.libur).includes(d.tanggal)) {
    return badRequest({ tanggal: ["Jurnal hanya bisa diisi untuk hari ini dan 2 hari sebelumnya."] });
  }
  const lama = await prisma.magangJurnal.findUnique({ where: { pesertaId_tanggal: { pesertaId: p.id, tanggal: atMidnight(d.tanggal) } } });
  if (lama?.dicekAt) return NextResponse.json({ message: "Jurnal ini sudah dicek pembimbing, tidak bisa diubah lagi." }, { status: 409 });

  const fotoLama = daftarFoto(lama?.foto);
  const dibuang = fotoLama.filter((_, i) => d.hapusFoto.includes(i));
  const tetap = fotoLama.filter((_, i) => !d.hapusFoto.includes(i));
  const baru = await fotoDariForm(form, MAKS_FOTO - tetap.length);
  if (!baru.ok) return badRequest({ foto: [baru.error] });

  const data = { kegiatan: d.kegiatan, kendala: d.kendala, foto: [...tetap, ...baru.path], posId: posPada(p, d.tanggal) };
  let simpan;
  try {
    simpan = await prisma.magangJurnal.upsert({
      where: { pesertaId_tanggal: { pesertaId: p.id, tanggal: atMidnight(d.tanggal) } },
      create: { pesertaId: p.id, tanggal: atMidnight(d.tanggal), ...data },
      update: data,
      include: { pos: { select: { nama: true } } },
    });
  } catch (e) {
    for (const f of baru.path) await hapusFoto(f);
    throw e;
  }
  for (const f of dibuang) await hapusFoto(f);
  return json(serialisasiJurnal(simpan, { hari: p.hari, masa: p.masa, libur: p.libur }), { status: lama ? 200 : 201 });
});
