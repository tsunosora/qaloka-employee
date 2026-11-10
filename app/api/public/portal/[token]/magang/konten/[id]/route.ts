import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, badRequest, route } from "@/lib/http";
import { requirePortalOwner } from "@/lib/services/portal/auth";
import { cekUbahAnak } from "@/lib/services/magang/konten";
import { muatKonsep, muatStatus, pesertaKonten, serialisasiBarisAnak, whereMilikAnak } from "@/lib/services/magang/konten-db";
import { ubahKontenAnakSchema } from "@/lib/validators/magang-konten";

type Ctx = { params: Promise<{ token: string; id: string }> };

const TIDAK_ADA = () => NextResponse.json({ message: "Jadwal konten ini tidak ditemukan." }, { status: 404 });

/**
 * PORTAL (anaknya sendiri; mode owner 403) — anak mengisi judul, link footage, link ekspor, dan status
 * yang anakBoleh. Hanya baris miliknya (kode sendiri / grupnya) — baris lain 404. Baris final terkunci.
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const { token, id: idMentah } = await ctx.params;
  const employee = await requirePortalOwner(token, req);
  const p = await pesertaKonten(prisma, employee.id);
  if (!p) return TIDAK_ADA();
  const id = Number(idMentah) || 0;
  const parsed = ubahKontenAnakSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());

  const lama = await prisma.magangKonten.findFirst({ where: { AND: [{ id }, whereMilikAnak(p.id, p.grupIds)] }, include: { status: true } });
  if (!lama) return TIDAK_ADA();
  const statusBaru = parsed.data.statusId ? await prisma.magangKontenStatus.findUnique({ where: { id: parsed.data.statusId } }) : null;
  if (parsed.data.statusId && !statusBaru) return badRequest({ statusId: ["Status tidak ditemukan."] });
  const tolak = cekUbahAnak(lama.status, statusBaru);
  if (tolak) return NextResponse.json({ message: tolak }, { status: lama.status.final ? 409 : 403 });

  // Kunci optimis: baris yang baru saja divalidasi pembina tidak boleh tertimpa.
  const r = await prisma.magangKonten.updateMany({
    where: { id, statusId: lama.statusId, status: { final: false } },
    data: { ...parsed.data, diubahOlehKaryawanId: employee.id, diubahOlehId: null },
  });
  if (r.count === 0) return NextResponse.json({ message: "Konten ini baru saja diubah pembina. Muat ulang lalu coba lagi." }, { status: 409 });

  const [b, konsep, status] = await Promise.all([prisma.magangKonten.findUniqueOrThrow({ where: { id } }), muatKonsep(prisma), muatStatus(prisma)]);
  return json(serialisasiBarisAnak(b, new Map(konsep.map((k) => [k.id, k])), new Map(status.map((s) => [s.id, s])), new Map(p.grup.map((g) => [g.id, g.nama]))));
});
