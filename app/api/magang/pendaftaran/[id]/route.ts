import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { toYmd } from "@/lib/services/leave/service";
import { wajibBolehMenambah } from "@/lib/lisensi/penjaga";
import { keputusanPendaftarSchema } from "@/lib/validators/magang";
import { buatPesertaBaru } from "@/lib/services/magang/pendaftaran";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Setujui → dibuat karyawan + peserta magang dengan token & PIN yang dipilih anak saat mendaftar
 * (tautan yang dia simpan langsung bisa dipakai). Tolak → alasan wajib; tidak ada data karyawan.
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = keputusanPendaftarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const p = await prisma.magangPendaftar.findUnique({ where: { id } });
  if (!p) return notFound("Pendaftar tidak ditemukan.");
  if (p.status !== "menunggu") return NextResponse.json({ message: "Pendaftar ini sudah diputuskan." }, { status: 409 });

  if (parsed.data.aksi === "tolak") {
    await prisma.magangPendaftar.update({ where: { id }, data: { status: "ditolak", alasanTolak: parsed.data.alasan, diputusAt: new Date() } });
    return json({ ok: true });
  }

  await wajibBolehMenambah("limit.employees");
  const hasil = await prisma.$transaction(async (tx) => {
    const r = await buatPesertaBaru(
      tx,
      {
        namaLengkap: p.namaLengkap,
        panggilan: p.panggilan,
        hp: p.hp,
        sekolah: p.sekolah,
        jurusan: p.jurusan,
        mulai: toYmd(p.mulai),
        selesai: p.selesai ? toYmd(p.selesai) : null,
      },
      { token: p.token, pinHash: p.pinHash }
    );
    await tx.magangPendaftar.update({ where: { id }, data: { status: "disetujui", employeeId: r.employee.id, diputusAt: new Date() } });
    return r;
  });
  return json({ ok: true, pesertaId: hasil.peserta.id, publicToken: hasil.employee.publicToken });
});
