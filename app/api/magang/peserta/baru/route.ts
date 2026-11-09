import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { wajibBolehMenambah } from "@/lib/lisensi/penjaga";
import { pesertaBaruSchema } from "@/lib/validators/magang";
import { buatPesertaBaru } from "@/lib/services/magang/pendaftaran";

/** Pengawas membuat akun anak magang langsung (karyawan + peserta), tanpa lewat Direktori. */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = pesertaBaruSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  await wajibBolehMenambah("limit.employees");
  const r = await prisma.$transaction((tx) => buatPesertaBaru(tx, parsed.data));
  return json({ pesertaId: r.peserta.id, publicToken: r.employee.publicToken }, { status: 201 });
});
