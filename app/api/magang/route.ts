import { prisma } from "@/lib/prisma";
import { requireManager, json, route } from "@/lib/http";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { hariIni, hariTugasMagang, keYmd } from "@/lib/services/magang/layanan";
import { seninDari, tambahMinggu, penugasanPada, mingguKe } from "@/lib/services/magang/rotasi";
import { keadaanJendela } from "@/lib/services/magang/nilai";

/** Ringkasan halaman Magang: tiap anak aktif, posnya minggu ini, status tugas minggu ini & lalu. */
export const GET = route(async () => {
  await requireManager();
  const hari = hariIni();
  const seninIni = seninDari(hari);
  const seninLalu = tambahMinggu(seninIni, -1);

  const [peserta, pos, belumDinilai, jumlahPos, hariTugas] = await Promise.all([
    prisma.magangPeserta.findMany({
      where: { aktif: true, employee: { deletedAt: null, isActive: true } },
      orderBy: { id: "asc" },
      include: {
        employee: { select: { fullName: true, nickname: true, publicToken: true } },
        penugasan: { orderBy: { mulai: "asc" } },
        tugas: { select: { senin: true, nilai: true, dinilaiAt: true } },
        jurnal: { where: { tanggal: atMidnight(hari) }, select: { id: true } },
      },
    }),
    prisma.magangPos.findMany({ select: { id: true, nama: true, pembimbing: { select: { fullName: true } } } }),
    prisma.magangTugas.count({ where: { dinilaiAt: null, peserta: { aktif: true, employee: { deletedAt: null } } } }),
    prisma.magangPos.count({ where: { aktif: true, deletedAt: null } }),
    hariTugasMagang(prisma),
  ]);
  const posMap = new Map(pos.map((p) => [p.id, p]));

  const statusTugas = (t: { nilai: number | null; dinilaiAt: Date | null } | undefined, senin: string, adaPenugasan: boolean) => {
    if (!adaPenugasan) return "tanpa-pos";
    if (t) return t.dinilaiAt ? "dinilai" : "menunggu-nilai";
    const k = keadaanJendela(senin, hari, hariTugas);
    return k === "belum" ? "belum-buka" : k === "buka" ? "belum-diisi" : "terlambat";
  };

  return json({
    hariIni: hari,
    seninIni,
    hariTugas,
    jumlahPos,
    belumDinilai,
    peserta: peserta.map((p) => {
      const pen = p.penugasan.map(keYmd);
      const ini = penugasanPada(pen, seninIni);
      const lalu = penugasanPada(pen, seninLalu);
      const tugasMap = new Map(p.tugas.map((t) => [toYmd(t.senin), t]));
      const nilai = p.tugas.map((t) => t.nilai).filter((n): n is number => n != null);
      const berikut = pen.find((a) => a.mulai > seninIni);
      return {
        id: p.id,
        nama: p.employee.nickname || p.employee.fullName,
        namaLengkap: p.employee.fullName,
        publicToken: p.employee.publicToken,
        mulai: toYmd(p.mulai),
        selesai: p.selesai ? toYmd(p.selesai) : null,
        posIni: ini
          ? {
              nama: posMap.get(ini.posId)?.nama ?? "(pos dihapus)",
              pembimbing: posMap.get(ini.posId)?.pembimbing?.fullName ?? null,
              mingguKe: mingguKe(ini, seninIni),
              dari: ini.minggu,
              berbagi: ini.berbagi,
            }
          : null,
        posBerikut: berikut ? { nama: posMap.get(berikut.posId)?.nama ?? "(pos dihapus)", mulai: berikut.mulai } : null,
        tugasIni: statusTugas(tugasMap.get(seninIni), seninIni, !!ini),
        tugasLalu: statusTugas(tugasMap.get(seninLalu), seninLalu, !!lalu),
        rataNilai: nilai.length ? Math.round(nilai.reduce((s, n) => s + n, 0) / nilai.length) : null,
        adaRotasi: pen.length > 0,
        jurnalHariIni: p.jurnal.length > 0,
      };
    }),
  });
});
