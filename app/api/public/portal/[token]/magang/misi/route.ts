import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, badRequest, route } from "@/lib/http";
import { requirePortalSession, requirePortalOwner } from "@/lib/services/portal/auth";
import { kirimMisiSchema } from "@/lib/validators/magang";
import { medanForm } from "@/lib/services/reimbursement/service";
import { daftarFoto } from "@/lib/services/magang/jurnal";
import { fotoDariForm, hapusFoto } from "@/lib/services/magang/foto";
import { bolehKirimMisi, periksaBukti, progresMisi, uraiBukti, KATEGORI_MISI, MAKS_FOTO_MISI, MIN_TEKS_MISI } from "@/lib/services/magang/misi";
import { misiAktif, serialisasiMisi, serialisasiKiriman, includePengurus } from "@/lib/services/magang/misi-db";

type Ctx = { params: Promise<{ token: string }> };

async function pesertaDari(employeeId: number) {
  return prisma.magangPeserta.findFirst({ where: { employeeId, aktif: true }, select: { id: true } });
}

/** PORTAL (butuh PIN) — side quest anak: semua misi aktif + kiriman miliknya + progres per kategori. */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalSession(token, req);
  const p = await pesertaDari(employee.id);
  if (!p) return json({ peserta: false });
  const [misi, kiriman] = await Promise.all([
    misiAktif(prisma),
    prisma.magangMisiKiriman.findMany({ where: { pesertaId: p.id }, include: includePengurus }),
  ]);
  const milik = new Map(kiriman.map((k) => [k.misiId, k]));
  return json({
    peserta: true,
    kategori: KATEGORI_MISI,
    maksFoto: MAKS_FOTO_MISI,
    minTeks: MIN_TEKS_MISI,
    progres: progresMisi(misi, kiriman),
    misi: misi.map((m) => {
      const k = milik.get(m.id);
      return { ...serialisasiMisi(m), kiriman: k ? serialisasiKiriman(k) : null };
    }),
  });
});

/** PORTAL (anaknya sendiri; mode owner 403) — kirim/perbaiki bukti satu misi. Multipart: misiId, teks, tautan, hapusFoto, foto[]. */
export const POST = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalOwner(token, req);
  const p = await pesertaDari(employee.id);
  if (!p) return NextResponse.json({ message: "Kamu tidak terdaftar sebagai peserta magang." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest({ formErrors: ["Kiriman tidak terbaca. Coba lagi."] });
  const parsed = kirimMisiSchema.safeParse(medanForm(form, ["misiId", "teks", "tautan", "hapusFoto"]));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;

  const misi = await prisma.magangMisi.findFirst({ where: { id: d.misiId, aktif: true, deletedAt: null } });
  if (!misi) return NextResponse.json({ message: "Misi ini sudah tidak tersedia." }, { status: 404 });
  const lama = await prisma.magangMisiKiriman.findUnique({ where: { misiId_pesertaId: { misiId: misi.id, pesertaId: p.id } } });
  if (!bolehKirimMisi(lama?.status)) return NextResponse.json({ message: "Misi ini sudah disetujui, tidak bisa diubah lagi." }, { status: 409 });

  const fotoLama = daftarFoto(lama?.foto);
  const dibuang = fotoLama.filter((_, i) => d.hapusFoto.includes(i));
  const tetap = fotoLama.filter((_, i) => !d.hapusFoto.includes(i));
  const jumlahBaru = form.getAll("foto").filter((f) => f instanceof File && f.size > 0).length;
  const salah = periksaBukti(uraiBukti(misi.bukti), { teks: d.teks, tautan: d.tautan, jumlahFoto: tetap.length + jumlahBaru });
  if (salah) return badRequest({ formErrors: [salah] });
  const baru = await fotoDariForm(form, MAKS_FOTO_MISI - tetap.length);
  if (!baru.ok) return badRequest({ foto: [baru.error] });

  const isi = { teks: d.teks, tautan: d.tautan, foto: [...tetap, ...baru.path], status: "menunggu", dikirimAt: new Date() };
  let simpan;
  try {
    simpan = await prisma.magangMisiKiriman.upsert({
      where: { misiId_pesertaId: { misiId: misi.id, pesertaId: p.id } },
      create: { misiId: misi.id, pesertaId: p.id, ...isi },
      // Kiriman ulang sesudah ditolak: keputusan lama dikosongkan; catatan penolakan tetap tersimpan
      // sampai diputus lagi (anak masih bisa membacanya).
      update: {
        ...isi,
        kirimKe: lama?.status === "ditolak" ? { increment: 1 } : undefined,
        diputusAt: null,
        diputusOlehId: null,
        diputusOlehKaryawanId: null,
      },
      include: includePengurus,
    });
  } catch (e) {
    for (const f of baru.path) await hapusFoto(f);
    throw e;
  }
  for (const f of dibuang) await hapusFoto(f);
  return json(serialisasiKiriman(simpan), { status: lama ? 200 : 201 });
});
