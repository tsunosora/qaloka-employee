import { prisma } from "@/lib/prisma";
import { json, route } from "@/lib/http";
import { requirePortalAccess } from "@/lib/services/portal/auth";
import { hariIni, keYmd, seninDari, serialisasiTugas } from "@/lib/services/magang/layanan";
import { serialisasiJurnal } from "@/lib/services/magang/jurnal-db";
import { posPembimbing } from "@/lib/services/magang/pembimbing-db";
import { anakDiPos } from "@/lib/services/magang/pembimbing";

type Ctx = { params: Promise<{ token: string }> };

const namaKaryawan = (e: { fullName: string; nickname: string | null }) => e.nickname || e.fullName;

/**
 * PORTAL (butuh PIN; mode owner boleh melihat) — halaman pribadi pembimbing: anak di posnya minggu ini,
 * tugas mingguan yang belum dinilai, dan jurnal harian yang belum dicek. HANYA pos yang dia bimbing.
 * Bentuk item tugas/jurnal sama dengan GET /api/magang/tugas & /api/magang/jurnal (komponen dipakai ulang).
 */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const { employee } = await requirePortalAccess(token, req);
  const pos = await posPembimbing(employee.id);
  if (pos.length === 0) return json({ pembimbing: false });
  const posIds = pos.map((p) => p.id);
  const namaPos = new Map(pos.map((p) => [p.id, p.nama]));
  const pesertaAktif = { aktif: true, employee: { deletedAt: null } };
  const namaSaja = { include: { employee: { select: { fullName: true, nickname: true } } } };

  const seninIni = seninDari(hariIni());
  const [peserta, tugas, jurnal] = await Promise.all([
    prisma.magangPeserta.findMany({
      where: { ...pesertaAktif, penugasan: { some: { posId: { in: posIds } } } },
      include: { employee: { select: { fullName: true, nickname: true } }, penugasan: { orderBy: { mulai: "asc" } } },
    }),
    prisma.magangTugas.findMany({
      where: { posId: { in: posIds }, dinilaiAt: null, peserta: pesertaAktif },
      orderBy: [{ senin: "asc" }, { id: "asc" }],
      take: 100,
      include: { peserta: namaSaja },
    }),
    prisma.magangJurnal.findMany({
      where: { posId: { in: posIds }, dicekAt: null, peserta: pesertaAktif },
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      take: 100,
      include: { pos: { select: { nama: true } }, peserta: namaSaja },
    }),
  ]);

  const anak = anakDiPos(
    peserta.map((p) => ({ pesertaId: p.id, nama: namaKaryawan(p.employee), penugasan: p.penugasan.map(keYmd) })),
    posIds,
    seninIni
  ).map(({ posId, ...a }) => ({ ...a, pos: namaPos.get(posId) ?? "" }));

  return json({
    pembimbing: true,
    pos,
    anak,
    tugas: tugas.map((t) => ({
      ...serialisasiTugas(t),
      pesertaId: t.pesertaId,
      nama: namaKaryawan(t.peserta.employee),
      pos: (t.posId != null && namaPos.get(t.posId)) || "(pos dihapus)",
      dinilaiOleh: null,
    })),
    jurnal: jurnal.map((j) => ({
      ...serialisasiJurnal(j),
      pesertaId: j.pesertaId,
      posId: j.posId,
      nama: namaKaryawan(j.peserta.employee),
      dicekOleh: null,
    })),
  });
});
