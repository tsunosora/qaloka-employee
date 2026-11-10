import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { rencanaBulan, simpanRencana } from "@/lib/services/magang/konten-db";
import { buatBulanSchema } from "@/lib/validators/magang-konten";

/**
 * Buat jadwal satu bulan dari pola. simpan=false (bawaan) → PRATINJAU saja (tidak menulis apa pun).
 * simpan=true → tulis (satu transaksi). ganti=false → hanya tanggal yang masih kosong; ganti=true →
 * baris yang belum dikerjakan dihapus & disusun ulang (yang sudah dikerjakan dipertahankan).
 * Baris baru: status awal, usulan=true (lencana "Usulan" sampai disetujui pembina).
 */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = buatBulanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { bulan, ganti, simpan } = parsed.data;
  const rencana = await rencanaBulan(prisma, bulan, ganti);
  if (!simpan) return json(rencana);
  if (!rencana.statusAwalId) return NextResponse.json({ message: rencana.masalah[0] ?? "Status awal belum ada." }, { status: 409 });
  const hasil = await simpanRencana(prisma, rencana, { userId: await idPengguna(session.user?.email) });
  return json({ ...hasil, bulan });
});
