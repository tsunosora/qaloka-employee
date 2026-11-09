import { prisma } from "@/lib/prisma";
import { json, route } from "@/lib/http";
import { notifyManagers } from "@/lib/notify";
import { getSetting } from "@/lib/settings";
import { requirePortalOwner } from "@/lib/services/portal/auth";
import { SETELAN_LUAR, barisLogTolak, luarDiizinkan, putuskanAbsen, putuskanAbsenLuar, KODE_BOLEH_LUAR } from "@/lib/services/absen-hp/aturan";
import { FOTO_MAKS_BITA, catatAbsenHp, catatPengajuanLuar, lokasiAktif, simpanFoto } from "@/lib/services/absen-hp/simpan";
import { kontakDari } from "@/lib/services/fingerspot/kontak-mesin";

type Ctx = { params: Promise<{ token: string }> };

const angka = (v: FormDataEntryValue | null) => (v === null || v === "" ? NaN : Number(v));

/**
 * PUBLIK (sesi PIN karyawan) — absen dari HP. Multipart: foto, lat, lng, akurasi, perangkat, qr.
 * Dengan `luar=1` + `alasan`: PENGAJUAN absen di luar lokasi (menunggu persetujuan owner).
 * Satu jalur, bukan jalur baru, supaya ikut pengecualian mode hanya-baca absen HP
 * (lib/lisensi/aturan-jalur.ts) — data kehadiran tidak boleh hilang karena telat bayar.
 *
 * Owner yang membuka halaman karyawan lewat ?owner=1 DITOLAK di sini (requirePortalOwner):
 * owner boleh melihat, tidak boleh absen atas nama karyawannya.
 *
 * Urutan disengaja: keputusan (murah, tanpa menulis) DULU, baru foto disimpan — absen yang
 * ditolak tidak meninggalkan berkas foto di disk.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const { token } = await ctx.params;
  const employee = await requirePortalOwner(token, req);

  const form = await req.formData().catch(() => null);
  if (!form) return json({ ok: false, alasan: "Kiriman tidak terbaca. Coba lagi." }, { status: 400 });

  const lat = angka(form.get("lat"));
  const lng = angka(form.get("lng"));
  const akurasiM = angka(form.get("akurasi"));
  const terakhir = await prisma.absenHpBukti.findFirst({
    where: { employeeId: employee.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const izinkanLuar = luarDiizinkan(await getSetting(SETELAN_LUAR));

  const dasar = {
    aktif: employee.absenHp,
    perangkatTerdaftar: employee.absenHpPerangkat,
    idPerangkat: String(form.get("perangkat") ?? ""),
    lokasi: await lokasiAktif(),
    lat,
    lng,
    akurasiM,
    qr: (form.get("qr") as string | null) || null,
    absenTerakhir: terakhir?.createdAt ?? null,
    nowMs: Date.now(),
  };

  const fotoMasuk = form.get("foto");
  const tolak = (kode: string, x: { jarakM?: number | null; lokasi?: string | null } = {}) =>
    console.warn(barisLogTolak({
      employeeId: employee.id, kode, akurasiM, ...x,
      fotoBita: fotoMasuk instanceof File ? fotoMasuk.size : null,
      fotoTipe: fotoMasuk instanceof File ? fotoMasuk.type || "?" : null,
    }));

  const luar = form.get("luar") === "1";
  let keputusanLuar: ReturnType<typeof putuskanAbsenLuar> | null = null;
  let keputusan: ReturnType<typeof putuskanAbsen> | null = null;
  if (luar) {
    const awalHari = new Date();
    awalHari.setHours(0, 0, 0, 0);
    const pengajuanHariIni = await prisma.absenHpBukti.count({
      where: { employeeId: employee.id, alasan: { not: null }, createdAt: { gte: awalHari } },
    });
    keputusanLuar = putuskanAbsenLuar({ ...dasar, izinkan: izinkanLuar, alasan: String(form.get("alasan") ?? ""), pengajuanHariIni });
    if (!keputusanLuar.ok) {
      tolak(`luar:${keputusanLuar.kode}`);
      return json(keputusanLuar, { status: 422 });
    }
  } else {
    keputusan = putuskanAbsen(dasar);
    if (!keputusan.ok) {
      tolak(keputusan.kode, { jarakM: keputusan.jarakM, lokasi: keputusan.lokasi });
      // HP tahu boleh menawarkan "Ajukan absen di luar lokasi" tanpa harus menebak setelan owner.
      return json({ ...keputusan, bolehLuar: izinkanLuar && KODE_BOLEH_LUAR.includes(keputusan.kode) }, { status: 422 });
    }
  }

  const foto = fotoMasuk;
  if (!(foto instanceof File) || foto.size === 0) {
    tolak("tanpa_foto");
    return json({ ok: false, kode: "tanpa_foto", alasan: "Ambil foto wajah dulu." }, { status: 422 });
  }
  if (foto.size > FOTO_MAKS_BITA) {
    tolak("foto_besar");
    return json({ ok: false, kode: "foto_besar", alasan: "Foto terlalu besar. Coba ambil ulang." }, { status: 422 });
  }

  let fotoPath: string;
  try {
    fotoPath = await simpanFoto(new Uint8Array(await foto.arrayBuffer()));
  } catch {
    tolak("bukan_gambar");
    return json({ ok: false, kode: "bukan_gambar", alasan: "Berkas foto tidak dikenali. Ambil ulang fotonya." }, { status: 422 });
  }
  const ip = kontakDari(req.headers).ip;

  if (keputusanLuar?.ok) {
    const p = await catatPengajuanLuar({ employeeId: employee.id, keputusan: keputusanLuar, lat, lng, akurasiM, fotoPath, ip });
    const jarak = keputusanLuar.jarakM === null ? "belum ada lokasi absen" : `${keputusanLuar.jarakM} m dari ${keputusanLuar.lokasi?.nama}`;
    await notifyManagers("absen_luar", {
      title: "Absen di luar lokasi menunggu persetujuan",
      message: `${employee.fullName} · ${jarak} · "${keputusanLuar.alasan.slice(0, 80)}"`,
      buktiId: p.id,
      employeeId: employee.id,
      href: "/attendance/absen-luar",
    });
    return json({
      ok: true,
      menunggu: true,
      jam: p.waktu,
      lokasi: keputusanLuar.lokasi?.nama ?? null,
      jarakM: keputusanLuar.jarakM,
      hpBaruDikunci: keputusanLuar.kunciPerangkat,
    });
  }

  const k = keputusan as Extract<NonNullable<typeof keputusan>, { ok: true }>;
  const hasil = await catatAbsenHp({ employeeId: employee.id, keputusan: k, lat, lng, akurasiM, fotoPath, ip });

  return json({
    ok: true,
    jenis: hasil.scanType,
    jam: hasil.waktu,
    lokasi: k.lokasi.nama,
    jarakM: k.jarakM,
    qr: k.qr,
    hpBaruDikunci: k.kunciPerangkat,
  });
});
