import { prisma } from "@/lib/prisma";
import { json, route } from "@/lib/http";
import { atMidnight } from "@/lib/services/leave/service";
import { requirePortalSession } from "@/lib/services/portal/auth";
import { hariIni } from "@/lib/services/magang/layanan";
import { tambahHariKonten } from "@/lib/services/magang/konten";
import { muatKonsep, muatPlatformAnak, muatStatus, pesertaKonten, serialisasiBarisAnak, whereMilikAnak } from "@/lib/services/magang/konten-db";

type Ctx = { params: Promise<{ token: string }> };

/** Rentang yang dikirim ke HP: 4 minggu ke belakang s.d. 6 minggu ke depan. */
const MUNDUR = 28;
const MAJU = 42;

/**
 * PORTAL (butuh PIN; mode owner boleh melihat) — jadwal konten anak: baris kodenya sendiri + baris grup
 * yang dia ikuti (semua platform), tiap baris berlabel platform; brief (catatan, font, preset, drive, caption,
 * hashtag) PER PLATFORM untuk platform yang muncul di baris; status yang boleh dia pilih.
 */
export const GET = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalSession(token, req);
  const p = await pesertaKonten(prisma, employee.id);
  if (!p) return json({ peserta: false });
  const hari = hariIni();
  const [baris, konsep, status] = await Promise.all([
    prisma.magangKonten.findMany({
      where: { AND: [whereMilikAnak(p.id, p.grupIds), { tanggal: { gte: atMidnight(tambahHariKonten(hari, -MUNDUR)), lte: atMidnight(tambahHariKonten(hari, MAJU)) } }] },
      orderBy: [{ tanggal: "asc" }, { urutan: "asc" }, { id: "asc" }],
    }),
    muatKonsep(prisma),
    muatStatus(prisma),
  ]);
  const platform = await muatPlatformAnak(prisma, baris.map((b) => b.platformId));
  const petaKonsep = new Map(konsep.map((k) => [k.id, k]));
  const petaStatus = new Map(status.map((s) => [s.id, s]));
  const petaGrup = new Map(p.grup.map((g) => [g.id, g.nama]));
  return json({
    peserta: true,
    hariIni: hari,
    kode: p.kode,
    grup: p.grup.map((g) => g.nama),
    // Brief per platform (kunci = id platform). referensi khusus platform sudah dilebur ke baris.konsep.referensi.
    brief: Object.fromEntries([...platform.values()].map((x) => [x.id, { ...x.brief, referensi: undefined }])),
    // Pilihan status untuk anak: hanya yang aktif & anakBoleh (final dipasang pembina).
    pilihanStatus: status.filter((s) => s.aktif && s.anakBoleh && !s.final).map((s) => ({ id: s.id, nama: s.nama, warna: s.warna })),
    baris: baris.map((b) => serialisasiBarisAnak(b, petaKonsep, petaStatus, petaGrup, platform)),
  });
});
