import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { rencanaBulan, simpanRencana } from "@/lib/services/magang/konten-db";
import { buatBulanSchema } from "@/lib/validators/magang-konten";

/**
 * Buat jadwal satu bulan dari pola untuk SATU platform. simpan=false (bawaan) → PRATINJAU saja (tidak menulis
 * apa pun). simpan=true → tulis (satu transaksi). ganti=false → hanya tanggal yang masih kosong di platform itu;
 * ganti=true → baris platform itu yang belum dikerjakan dihapus & disusun ulang (yang sudah dikerjakan dipertahankan).
 * Giliran kode anak & grup EMPATHY dilanjutkan dari baris platform itu saja. Baris baru: status awal, usulan=true.
 */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = buatBulanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const { bulan, ganti, simpan, platformId } = parsed.data;
  const platform = await prisma.magangKontenPlatform.findUnique({ where: { id: platformId }, select: { aktif: true, nama: true } });
  if (!platform) return notFound("Platform tidak ditemukan.");
  if (!platform.aktif) return NextResponse.json({ message: `Platform ${platform.nama} diarsipkan. Buka arsipnya dulu di Kelola platform.` }, { status: 409 });
  const rencana = await rencanaBulan(prisma, bulan, ganti, platformId);
  if (!simpan) return json(rencana);
  if (!rencana.statusAwalId) return NextResponse.json({ message: rencana.masalah[0] ?? "Status awal belum ada." }, { status: 409 });
  const hasil = await simpanRencana(prisma, rencana, { userId: await idPengguna(session.user?.email) });
  return json({ ...hasil, bulan, platformId });
});
