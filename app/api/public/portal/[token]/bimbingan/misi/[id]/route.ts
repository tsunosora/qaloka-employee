import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, badRequest, notFound, route } from "@/lib/http";
import { putusMisiSchema } from "@/lib/validators/magang";
import { requireBimbingan } from "@/lib/services/magang/pembimbing-db";
import { putusKiriman } from "@/lib/services/magang/misi-db";

type Ctx = { params: Promise<{ token: string; id: string }> };

/** PORTAL pembimbing (mode owner = 403) — setujui/tolak bukti side quest peserta aktif. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const { token, id: idTeks } = await ctx.params;
  const { employee } = await requireBimbingan(token, req, { tulis: true });
  const id = Number(idTeks) || 0;
  const parsed = putusMisiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const k = await prisma.magangMisiKiriman.findFirst({ where: { id, peserta: { aktif: true } }, select: { id: true } });
  if (!k) return notFound("Kiriman tidak ditemukan.");
  const r = await putusKiriman(prisma, id, parsed.data.aksi, parsed.data.catatan, { karyawanId: employee.id });
  if (r === "tidak-ada") return notFound("Kiriman tidak ditemukan.");
  if (r === "sudah-diputus") return NextResponse.json({ message: "Kiriman ini sudah diputus." }, { status: 409 });
  return json({ ok: true });
});
