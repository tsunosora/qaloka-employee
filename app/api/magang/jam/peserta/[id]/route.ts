import { prisma } from "@/lib/prisma";
import { badRequest, json, notFound, requireManager, route } from "@/lib/http";
import { tanpaUndefined } from "@/lib/services/magang/konten";
import { jamEfektifPeserta, jamSah, petaJamSekolah, urutanJamSah } from "@/lib/services/magang/jam-kerja";
import { muatBarisJam } from "@/lib/services/magang/jam-kerja-db";
import { kunciSekolah } from "@/lib/services/magang/sekolah";
import { hitungUlangPeserta, petaDari } from "@/lib/services/magang/jam-kerja-simpan";
import { ubahJamPesertaSchema } from "@/lib/validators/magang-jam";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Jam khusus satu anak (sebagian: hanya kunci yang dikirim ditulis; null = ikut sekolah). `?pratinjau=1` = hitung
 * dampaknya saja. Sesudah simpan: absensi tersimpan anak ini dihitung ulang (mulai magang, maks. 62 hari).
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireManager();
  const id = Number((await ctx.params).id) || 0;
  const parsed = ubahJamPesertaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const ubah = tanpaUndefined(parsed.data);

  const { peserta, sekolah } = await muatBarisJam(prisma);
  const p = peserta.find((x) => x.id === id);
  if (!p) return notFound("Peserta tidak ditemukan.");
  const gabung = { ...p, ...ubah };

  // Jam gabungan (anak → sekolah) harus lengkap & berurutan; bila dua-duanya kosong = ikut jam toko (boleh).
  const js = petaJamSekolah(sekolah).get(kunciSekolah(p.sekolah)) ?? null;
  const masuk = gabung.jamMasuk ?? js?.jamMasuk ?? null;
  const pulang = gabung.jamPulang ?? js?.jamPulang ?? null;
  if ((gabung.jamMasuk || gabung.jamPulang) && (!jamSah(masuk) || !jamSah(pulang))) {
    return badRequest({ jamPulang: ["Sekolahnya belum punya jam kerja — isi jam masuk DAN jam pulang anak ini."] });
  }
  if (jamSah(masuk) && jamSah(pulang) && !urutanJamSah(masuk, pulang)) {
    return badRequest({ jamPulang: ["Jam masuk harus sebelum jam pulang."] });
  }

  const anak = [p];
  if (new URL(req.url).searchParams.get("pratinjau") === "1") {
    const peta = await petaDari(peserta.map((x) => (x.id === id ? gabung : x)), sekolah);
    return json({ efektif: jamEfektifPeserta(gabung, petaJamSekolah(sekolah)), hitungUlang: await hitungUlangPeserta(prisma, anak, { peta }) });
  }

  await prisma.magangPeserta.update({ where: { id }, data: ubah });
  return json({ ok: true, efektif: jamEfektifPeserta(gabung, petaJamSekolah(sekolah)), hitungUlang: await hitungUlangPeserta(prisma, anak) });
});
