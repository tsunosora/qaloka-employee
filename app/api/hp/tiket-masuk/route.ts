import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, route } from "@/lib/http";
import { canManage } from "@/lib/rbac";
import { canAttempt, clearAttempts, recordFailure, sweep } from "@/lib/rate-limit";
import { pakaiTiketMasuk, pesanTiketDitolak } from "@/lib/lisensi/tiket-masuk";
import { keadaanLisensi } from "@/lib/lisensi/layanan";
import { terbitkanTokenHp } from "@/lib/hp/sesi";

function ipPemanggil(req: Request): string {
  const h = req.headers;
  return (h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "?").trim();
}

/**
 * POST /api/hp/tiket-masuk { tiket } — aplikasi HP Qaloka Owner menukar tiket masuk `qm1`
 * (dari qaloka.com `/api/hp/tiket`) menjadi token sesi HP. Lihat lib/hp/sesi.ts.
 *
 * Jawaban: { token, kedaluwarsaPada, pengguna, usaha, fitur }. `fitur` = fitur lisensi aktif
 * (null = instalasi tanpa penegakan lisensi, semua terbuka) supaya HP tidak menampilkan layar
 * yang API-nya pasti menolak.
 */
export const POST = route(async (req: Request) => {
  sweep();
  const kunciBatas = `hp-tiket:${ipPemanggil(req)}`;
  if (!canAttempt(kunciBatas)) {
    return NextResponse.json(
      { message: "Terlalu banyak percobaan. Coba lagi 15 menit lagi.", alasan: "terkunci" },
      { status: 429 },
    );
  }

  const badan = (await req.json().catch(() => null)) as { tiket?: unknown } | null;
  const tiket = typeof badan?.tiket === "string" ? badan.tiket : "";
  const hasil = await pakaiTiketMasuk(tiket, "hp");
  if (!hasil.ok) {
    recordFailure(kunciBatas);
    return NextResponse.json({ message: pesanTiketDitolak(hasil.alasan), alasan: hasil.alasan }, { status: 401 });
  }
  if (!canManage(hasil.pengguna.role)) {
    return NextResponse.json(
      {
        message: "Akun ini bukan Owner/Admin/HR di Qaloka Employee, jadi tidak bisa dibuka dari aplikasi Owner.",
        alasan: "peran_tidak_cukup",
      },
      { status: 403 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: hasil.pengguna.id } });
  const sesi = user ? terbitkanTokenHp(user) : null;
  if (!sesi) {
    console.error("[hp/tiket-masuk] HP_SESI_RAHASIA / AUTH_SECRET belum diisi — token HP tidak bisa diterbitkan");
    return NextResponse.json(
      { message: "Server Qaloka Employee belum siap untuk aplikasi HP. Hubungi Qaloka.", alasan: "belum_siap" },
      { status: 503 },
    );
  }
  clearAttempts(kunciBatas);

  const k = await keadaanLisensi().catch(() => null);
  return json({
    ...sesi,
    pengguna: { nama: hasil.pengguna.name, email: hasil.pengguna.email, peran: hasil.pengguna.role },
    usaha: { klien: hasil.isi.klien, nama: k?.namaKlien ?? null, paket: k?.paket ?? null },
    fitur: k?.ditegakkan ? k.fitur : null,
  });
});
