import { prisma } from "@/lib/prisma";
import { requireManager, json, badRequest, route } from "@/lib/http";
import { toYmd } from "@/lib/services/leave/service";
import { susunSchema } from "@/lib/validators/magang";
import { susunUlang, keYmd, hariIni } from "@/lib/services/magang/layanan";
import { seninDari } from "@/lib/services/magang/rotasi";

/**
 * Jadwal rotasi lengkap: semua peserta (aktif dulu) + semua penugasannya + daftar pos. Kisi per
 * minggu dibentuk di klien. Satu program magang ±3 bulan × ≤10 anak = puluhan baris — kecil.
 */
export const GET = route(async () => {
  await requireManager();
  const [peserta, pos] = await Promise.all([
    prisma.magangPeserta.findMany({
      where: { employee: { deletedAt: null } },
      orderBy: [{ aktif: "desc" }, { id: "asc" }],
      include: {
        employee: { select: { fullName: true, nickname: true } },
        penugasan: { orderBy: { mulai: "asc" } },
      },
    }),
    prisma.magangPos.findMany({
      where: { deletedAt: null },
      orderBy: [{ urutan: "asc" }, { id: "asc" }],
      select: { id: true, nama: true, durasiMinggu: true, kapasitas: true, lokasi: true, aktif: true },
    }),
  ]);
  return json({
    seninIni: seninDari(hariIni()),
    pos,
    peserta: peserta.map((p) => ({
      id: p.id,
      nama: p.employee.nickname || p.employee.fullName,
      mulai: toYmd(p.mulai),
      selesai: p.selesai ? toYmd(p.selesai) : null,
      aktif: p.aktif,
      sekolah: p.sekolah,
      penugasan: p.penugasan.map(keYmd),
    })),
  });
});

/** Susun (ulang) otomatis mulai Senin minggu `dari`. Penugasan sebelum minggu itu tidak disentuh. */
export const POST = route(async (req: Request) => {
  await requireManager();
  const parsed = susunSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const pos = await prisma.magangPos.count({ where: { aktif: true, deletedAt: null } });
  if (pos === 0) return badRequest({ dari: ["Belum ada pos kerja aktif. Tambahkan pos dulu."] });
  const { dari, mode, pesertaIds } = parsed.data;
  return json(await susunUlang(prisma, dari, { mode, pesertaIds }));
});
