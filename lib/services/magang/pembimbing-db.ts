import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePortalAccess, requirePortalOwner, type PortalEmployee } from "@/lib/services/portal/auth";
import { posMilik } from "./pembimbing";

/** Pos aktif (tidak dihapus) yang dibimbing karyawan ini. */
export async function posPembimbing(employeeId: number): Promise<{ id: number; nama: string }[]> {
  const pos = await prisma.magangPos.findMany({
    where: { pembimbingId: employeeId, aktif: true, deletedAt: null },
    orderBy: [{ urutan: "asc" }, { id: "asc" }],
    select: { id: true, nama: true, pembimbingId: true, aktif: true, deletedAt: true },
  });
  const milik = new Set(posMilik(pos, employeeId));
  return pos.filter((p) => milik.has(p.id)).map((p) => ({ id: p.id, nama: p.nama }));
}

export type AksesBimbingan = { employee: PortalEmployee; asManager: boolean; pos: { id: number; nama: string }[]; posIds: number[] };

/**
 * Akses halaman pribadi pembimbing. `tulis` = aksi yang mengubah data (menilai/mengecek) → mode owner
 * (`?owner=1`) ditolak 403, sama dengan tab Magang. Bukan pembimbing pos aktif mana pun → 404.
 */
export async function requireBimbingan(token: string, req: Request, opsi: { tulis?: boolean } = {}): Promise<AksesBimbingan> {
  const akses = opsi.tulis
    ? { employee: await requirePortalOwner(token, req), asManager: false }
    : await requirePortalAccess(token, req);
  const pos = await posPembimbing(akses.employee.id);
  if (pos.length === 0) {
    throw NextResponse.json({ message: "Kamu bukan pembimbing pos magang mana pun." }, { status: 404 });
  }
  return { ...akses, pos, posIds: pos.map((p) => p.id) };
}
