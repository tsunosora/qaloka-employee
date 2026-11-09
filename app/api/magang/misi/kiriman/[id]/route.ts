import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { putusMisiSchema } from "@/lib/validators/magang";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { putusKiriman } from "@/lib/services/magang/misi-db";

type Ctx = { params: Promise<{ id: string }> };

/** Setujui / tolak (+ catatan yang tampil di HP anak) satu kiriman yang menunggu. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const session = await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = putusMisiSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const r = await putusKiriman(prisma, id, parsed.data.aksi, parsed.data.catatan, { userId: await idPengguna(session.user?.email) });
  if (r === "tidak-ada") return notFound("Kiriman tidak ditemukan.");
  if (r === "sudah-diputus") return NextResponse.json({ message: "Kiriman ini sudah diputus." }, { status: 409 });
  return json({ ok: true });
});
