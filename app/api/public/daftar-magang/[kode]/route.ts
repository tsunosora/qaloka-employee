import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, badRequest, route } from "@/lib/http";
import { notifyManagers } from "@/lib/notify";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { checkPin, normalizePin } from "@/lib/services/portal/pin";
import { pendaftaranSchema } from "@/lib/validators/magang";
import { hariIni } from "@/lib/services/magang/layanan";
import { bolehKirimPendaftaran, ipKlien, keadaanTautan } from "@/lib/services/magang/pendaftaran";

type Ctx = { params: Promise<{ kode: string }> };

async function tautanAktif(kode: string) {
  const t = await prisma.magangDaftar.findUnique({ where: { kode } });
  if (!t) return { galat: NextResponse.json({ message: "Tautan pendaftaran tidak dikenal." }, { status: 404 }) };
  const k = keadaanTautan(t, hariIni());
  if (k !== "aktif") {
    return {
      galat: NextResponse.json(
        { message: k === "kedaluwarsa" ? "Tautan pendaftaran ini sudah lewat masa berlakunya. Minta tautan baru ke pengawas." : "Tautan pendaftaran ini sudah ditutup." },
        { status: 410 }
      ),
    };
  }
  return { t };
}

/** PUBLIK — keterangan tautan pendaftaran (nama program + tanggal magang bawaan). */
export const GET = route<Ctx>(async (_req, ctx) => {
  const { kode } = await ctx.params;
  const r = await tautanAktif(kode);
  if (r.galat) return r.galat;
  const { t } = r;
  return json({
    label: t.label,
    berlakuSampai: toYmd(t.berlakuSampai),
    mulaiMagang: t.mulaiMagang ? toYmd(t.mulaiMagang) : null,
    selesaiMagang: t.selesaiMagang ? toYmd(t.selesaiMagang) : null,
  });
});

/** PUBLIK — kirim pendaftaran. Masuk sebagai "menunggu"; belum ada akun sampai pengawas menyetujui. */
export const POST = route<Ctx>(async (req, ctx) => {
  const { kode } = await ctx.params;
  if (!bolehKirimPendaftaran(ipKlien(req))) {
    return NextResponse.json({ message: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi sejam lagi." }, { status: 429 });
  }
  const r = await tautanAktif(kode);
  if (r.galat) return r.galat;

  const parsed = pendaftaranSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.flatten());
  const d = parsed.data;
  const pin = normalizePin(d.pin);
  const cek = checkPin(pin);
  if (!cek.valid) return badRequest({ pin: [cek.error] });

  const dobel = await prisma.magangPendaftar.findFirst({ where: { daftarId: r.t.id, hp: d.hp, status: "menunggu" }, select: { id: true } });
  if (dobel) return NextResponse.json({ message: "Nomor HP ini sudah mendaftar dan sedang menunggu persetujuan." }, { status: 409 });

  const token = randomUUID();
  await prisma.magangPendaftar.create({
    data: {
      daftarId: r.t.id,
      token,
      namaLengkap: d.namaLengkap,
      panggilan: d.panggilan,
      hp: d.hp,
      sekolah: d.sekolah,
      jurusan: d.jurusan,
      mulai: atMidnight(d.mulai),
      selesai: d.selesai ? atMidnight(d.selesai) : null,
      pinHash: await bcrypt.hash(pin, 10),
    },
  });
  await notifyManagers("magang_daftar", {
    title: `Pendaftar magang: ${d.namaLengkap}`,
    message: `${d.sekolah} · lewat "${r.t.label}" — menunggu persetujuan di Magang → Peserta`,
  });
  return json({ ok: true, token, nama: d.panggilan || d.namaLengkap }, { status: 201 });
});
