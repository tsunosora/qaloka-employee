import { prisma } from "@/lib/prisma";
import { toYmd } from "@/lib/services/leave/service";
import { atMidnight } from "@/lib/services/leave/service";
import { hariIni, hariTugasMagang, keYmd, mingguTugas, penugasanPada, seninDari } from "./layanan";
import { tambahHari } from "./rotasi";
import { bolehSunting, daftarFoto, tanggalBolehIsi } from "./jurnal";

/** Peserta aktif milik karyawan portal ini, dengan penugasan & tanggal tugas yang sudah dikirim. */
export async function pesertaPortal(employeeId: number) {
  const p = await prisma.magangPeserta.findFirst({
    where: { employeeId, aktif: true },
    include: { penugasan: { orderBy: { mulai: "asc" } }, tugas: { select: { senin: true } } },
  });
  if (!p) return null;
  const masa = { mulai: toYmd(p.mulai), selesai: p.selesai ? toYmd(p.selesai) : null };
  const penugasan = p.penugasan.map(keYmd);
  const hari = hariIni();
  // Tugas mengingat yang masih terbuka & belum dikirim → riwayat jurnal ditahan supaya tulisan
  // mingguannya tetap dari ingatan, bukan menyalin jurnal.
  const tugasTerbuka = mingguTugas(penugasan, new Set(p.tugas.map((t) => toYmd(t.senin))), hari, await hariTugasMagang(prisma)).length > 0;
  // Libur nasional di sekitar hari ini → tidak ikut jendela isi jurnal (sama dengan hitungan rapor).
  const libur = new Set(
    (await prisma.holiday.findMany({ where: { date: { gte: atMidnight(tambahHari(hari, -14)), lte: atMidnight(hari) } }, select: { date: true } })).map((h) => toYmd(h.date))
  );
  return { id: p.id, masa, penugasan, hari, tugasTerbuka, libur };
}

export type PesertaPortal = NonNullable<Awaited<ReturnType<typeof pesertaPortal>>>;

export function posPada(p: PesertaPortal, tanggal: string): number | null {
  return penugasanPada(p.penugasan, seninDari(tanggal))?.posId ?? null;
}

export function serialisasiJurnal(
  j: { id: number; tanggal: Date; kegiatan: string; kendala: string | null; foto: unknown; komentar: string | null; dicekAt: Date | null; pos?: { nama: string } | null },
  ctx?: { hari: string; masa: { mulai: string; selesai: string | null }; libur?: ReadonlySet<string> }
) {
  const tanggal = toYmd(j.tanggal);
  return {
    id: j.id,
    tanggal,
    pos: j.pos?.nama ?? null,
    kegiatan: j.kegiatan,
    kendala: j.kendala,
    jumlahFoto: daftarFoto(j.foto).length,
    komentar: j.komentar,
    dicek: !!j.dicekAt,
    dicekAt: j.dicekAt?.toISOString() ?? null,
    bolehSunting: ctx ? bolehSunting({ tanggal, dicek: !!j.dicekAt }, ctx.hari, ctx.masa, ctx.libur) : false,
  };
}

export { tanggalBolehIsi };
