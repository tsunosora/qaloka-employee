import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, route } from "@/lib/http";
import { keadaanPortal } from "@/lib/services/portal/keadaan";
import { pesanDitolak, tolakMenunggu } from "@/lib/services/magang/pendaftaran";

type Ctx = { params: Promise<{ token: string }> };

/**
 * PUBLIK — keadaan halaman portal: identitas ringkas karyawan, apakah PIN sudah dibuat,
 * dan apakah pengunjung sudah melewati layar PIN. Data sensitif TIDAK ada di sini.
 * Aturannya di lib/services/portal/keadaan.ts (dipakai juga halaman absen HP).
 *
 * Token yang belum jadi karyawan tapi milik pendaftar magang → pesan "menunggu persetujuan" /
 * "ditolak" (bukan "tautan tidak valid" yang membingungkan anak yang baru mendaftar).
 */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  try {
    return json((await keadaanPortal(req, token)).publik);
  } catch (e) {
    if (e instanceof Response && e.status === 404) {
      const p = await prisma.magangPendaftar.findUnique({ where: { token }, select: { status: true, alasanTolak: true } });
      if (p?.status === "menunggu") return tolakMenunggu();
      if (p?.status === "ditolak") {
        return NextResponse.json(
          { message: pesanDitolak(p.alasanTolak) },
          { status: 404 }
        );
      }
    }
    throw e;
  }
});
