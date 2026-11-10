import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, notFound, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { idPengguna } from "@/lib/services/reimbursement/service";
import { pesertaAda } from "@/lib/services/magang/harian-db";
import { pengecualianSchema } from "@/lib/validators/magang-harian";

/**
 * Pasang pengecualian satu tanggal; MENGGANTIKAN pengecualian lama untuk sasaran yang sama hari itu:
 * - tingkat pasangan (pasanganId): pengecualian tingkat pasangan itu pada tanggal tsb;
 * - tingkat anak (pesertaId): pengecualian anak itu — dan untuk ganti pasangan juga milik rekan pengganti.
 * Satu transaksi tanpa DDL. Giliran hari berikutnya tidak berubah (selalu dihitung dari patokan).
 */
export const POST = route(async (req: Request) => {
  const session = await requireManager();
  const parsed = pengecualianSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  if (d.pasanganId != null && !(await prisma.magangPasangan.findUnique({ where: { id: d.pasanganId }, select: { id: true } })))
    return notFound("Pasangan tidak ditemukan.");
  if (!(await pesertaAda(prisma, [d.pesertaId, d.pasanganPesertaId]))) return notFound("Peserta tidak ditemukan.");
  const tanggal = atMidnight(d.tanggal);
  const anak = [d.pesertaId, d.pasanganPesertaId].filter((x): x is number => x != null);
  const oleh = await idPengguna(session.user?.email);
  const baru = await prisma.$transaction(async (tx) => {
    if (d.pasanganId != null) await tx.magangHarianPengecualian.deleteMany({ where: { tanggal, pasanganId: d.pasanganId, pesertaId: null } });
    else await tx.magangHarianPengecualian.deleteMany({ where: { tanggal, OR: [{ pesertaId: { in: anak } }, { jenis: "pasangan", pasanganPesertaId: { in: anak } }] } });
    return tx.magangHarianPengecualian.create({
      data: {
        tanggal,
        pasanganId: d.pasanganId,
        pesertaId: d.pesertaId,
        jenis: d.jenis,
        tugas: d.jenis === "libur" ? null : d.tugas,
        pasanganPesertaId: d.pasanganPesertaId,
        catatan: d.catatan,
        dibuatOlehId: oleh,
      },
    });
  });
  return json({ id: baru.id }, { status: 201 });
});
