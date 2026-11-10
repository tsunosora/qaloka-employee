import { prisma } from "@/lib/prisma";
import { badRequest, json, notFound, requireManager, route } from "@/lib/http";
import { daftarSekolah, kunciSekolah } from "@/lib/services/magang/sekolah";
import { pesertaSekolahIni, type JamSekolahBaris } from "@/lib/services/magang/jam-kerja";
import { muatBarisJam } from "@/lib/services/magang/jam-kerja-db";
import { hitungUlangPeserta, petaDari } from "@/lib/services/magang/jam-kerja-simpan";
import { jamSekolahSchema } from "@/lib/validators/magang-jam";

const pratinjauDari = (req: Request) => new URL(req.url).searchParams.get("pratinjau") === "1";

/**
 * Simpan jam kerja satu sekolah (buat/ganti). `?pratinjau=1` = hanya hitung dampaknya ke absensi tersimpan (tidak
 * menulis apa pun). Sesudah simpan: absensi tersimpan anak sekolah ini dihitung ulang (mulai magang, maks. 62 hari).
 */
export const PUT = route(async (req: Request) => {
  await requireManager();
  const parsed = jamSekolahSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const kunci = kunciSekolah(d.sekolahKunci);

  const { peserta, sekolah } = await muatBarisJam(prisma);
  const ada = sekolah.find((s) => kunciSekolah(s.sekolahKunci) === kunci) ?? null;
  const label = daftarSekolah(peserta.map((p) => p.sekolah)).find((s) => s.kunci === kunci)?.label ?? ada?.sekolahLabel ?? null;
  if (!label) return notFound("Sekolah tidak ditemukan di data peserta.");

  const toleransiMenit = d.toleransiMenit === undefined ? ada?.toleransiMenit ?? null : d.toleransiMenit;
  const baru: JamSekolahBaris = { sekolahKunci: kunci, sekolahLabel: label, jamMasuk: d.jamMasuk, jamPulang: d.jamPulang, toleransiMenit };
  const anak = pesertaSekolahIni(peserta, kunci);

  if (pratinjauDari(req)) {
    const peta = await petaDari(peserta, [...sekolah.filter((s) => s !== ada), baru]);
    return json({ hitungUlang: await hitungUlangPeserta(prisma, anak, { peta }) });
  }

  // Tanpa transaksi: satu upsert lalu UPDATE absensi per baris (tidak ada DDL).
  const data = { sekolahLabel: label, jamMasuk: d.jamMasuk, jamPulang: d.jamPulang, ...(d.toleransiMenit !== undefined ? { toleransiMenit: d.toleransiMenit } : {}) };
  await prisma.magangJamSekolah.upsert({
    where: { sekolahKunci: kunci },
    create: { sekolahKunci: kunci, ...data, toleransiMenit },
    update: data,
  });
  return json({ ok: true, hitungUlang: await hitungUlangPeserta(prisma, anak) });
});

/** Hapus jam sekolah → anak sekolah ini kembali ke jam toko (kecuali yang punya jam khusus). `?pratinjau=1` didukung. */
export const DELETE = route(async (req: Request) => {
  await requireManager();
  const kunci = kunciSekolah(new URL(req.url).searchParams.get("kunci"));
  if (!kunci) return badRequest({ kunci: ["Sekolah wajib diisi"] });
  const { peserta, sekolah } = await muatBarisJam(prisma);
  const ada = sekolah.find((s) => kunciSekolah(s.sekolahKunci) === kunci);
  if (!ada) return notFound("Sekolah ini belum punya jam kerja.");
  const anak = pesertaSekolahIni(peserta, kunci);

  if (pratinjauDari(req)) {
    const peta = await petaDari(peserta, sekolah.filter((s) => s !== ada));
    return json({ hitungUlang: await hitungUlangPeserta(prisma, anak, { peta }) });
  }
  await prisma.magangJamSekolah.delete({ where: { sekolahKunci: ada.sekolahKunci } });
  return json({ ok: true, hitungUlang: await hitungUlangPeserta(prisma, anak) });
});
