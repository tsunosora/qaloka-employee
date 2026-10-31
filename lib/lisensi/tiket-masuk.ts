/**
 * Tiket masuk `qm1` dari qaloka.com — pemilik masuk tanpa mengetik sandi kedua kalinya.
 * Dua pintu memakai pemeriksa yang SAMA:
 *   - `/masuk-qendali` (peramban, tombol "Buka aplikasimu" di portal) → sesi NextAuth.
 *   - `POST /api/hp/tiket-masuk` (aplikasi HP Qaloka Owner)          → token HP (lib/hp/sesi.ts).
 *
 * Aturannya di repo qendali, docs/lisensi.md → "Tiket masuk". GAGAL-TERTUTUP: salah di sini berarti
 * orang asing membaca data karyawan usaha lain, jadi ragu sedikit pun → tolak. Isi tiket tidak
 * pernah dicatat; yang dicatat cuma alasan penolakannya.
 */
import { verify } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { kunciPublikLisensi } from "./kunci-publik";
import { alamatInstalasi, keadaanLisensi } from "./layanan";

export const AMPLOP_TIKET_MASUK = "qm1";
const VERSI = 1;
/** Tiket yang umurnya (terbit → kedaluwarsa) lebih dari ini ditolak, walau tanda tangannya sah. */
const UMUR_MAKS_MS = 5 * 60_000;
/** Jam penerbit boleh lebih cepat dari jam kita sebanyak ini. */
const JAM_MAJU_MS = 60_000;

export type IsiTiketMasuk = {
  versi: number;
  kid: string;
  tujuan: string;
  klien: string;
  email: string;
  nama: string | null;
  peran: string;
  jti: string;
  terbitPada: string;
  kedaluwarsaPada: string;
};

export type HasilTiketMasuk = { sah: true; isi: IsiTiketMasuk } | { sah: false; alasan: string };

/** "https://Absensi.Toko.com/x" → "absensi.toko.com". null kalau kosong. */
export function hostDari(alamat: string | null | undefined): string | null {
  const s = String(alamat ?? "").trim().toLowerCase();
  if (!s) return null;
  try {
    return new URL(s.includes("://") ? s : `https://${s}`).host || null;
  } catch {
    return null;
  }
}

/** MURNI — aturan 1–5 docs/lisensi.md. Semua masukan diberikan supaya bisa diuji tanpa DB. */
export function periksaTiketMasukMurni(
  tiket: string | null | undefined,
  o: {
    kunciPublik: Record<string, string>;
    /** kid kunci lisensi yang terpasang DAN terverifikasi di instalasi ini. */
    kidTerpasang: string | null;
    /** Alamat instalasi ini (QENDALI_ALAMAT). */
    alamatSaya: string | null;
    sekarang?: Date;
  },
): HasilTiketMasuk {
  const bagian = String(tiket ?? "").trim().split(".");
  if (bagian.length !== 3) return { sah: false, alasan: "bentuk_salah" };
  const [amplop, p1, p2] = bagian;
  if (amplop !== AMPLOP_TIKET_MASUK) return { sah: false, alasan: "amplop_salah" };

  let isi: Record<string, unknown>;
  try {
    isi = JSON.parse(Buffer.from(p1, "base64url").toString("utf8"));
  } catch {
    return { sah: false, alasan: "isi_rusak" };
  }
  if (!isi || typeof isi !== "object" || isi.versi !== VERSI) return { sah: false, alasan: "versi_salah" };

  // Aturan 2 & 3: kid harus kid kunci lisensi TERPASANG, bukan sekadar dikenal.
  if (!o.kidTerpasang) return { sah: false, alasan: "lisensi_belum_terpasang" };
  if (isi.kid !== o.kidTerpasang) return { sah: false, alasan: "kid_bukan_kunci_terpasang" };
  const pem = o.kunciPublik[String(isi.kid)];
  if (!pem) return { sah: false, alasan: "kid_tidak_dikenal" };
  let cocok = false;
  try {
    cocok = verify(null, Buffer.from(`${amplop}.${p1}`), pem, Buffer.from(p2, "base64url"));
  } catch {
    return { sah: false, alasan: "tanda_tangan_rusak" };
  }
  if (!cocok) return { sah: false, alasan: "tanda_tangan_tidak_cocok" };

  // Aturan 4: tujuan persis alamat instalasi ini.
  const saya = hostDari(o.alamatSaya);
  if (!saya) return { sah: false, alasan: "alamat_instalasi_kosong" };
  if (String(isi.tujuan ?? "").toLowerCase() !== saya) return { sah: false, alasan: "bukan_untuk_instalasi_ini" };

  // Aturan 5: umur.
  const sekarang = (o.sekarang ?? new Date()).getTime();
  const terbit = new Date(String(isi.terbitPada)).getTime();
  const habis = new Date(String(isi.kedaluwarsaPada)).getTime();
  if (!Number.isFinite(terbit) || !Number.isFinite(habis)) return { sah: false, alasan: "waktu_rusak" };
  if (habis <= sekarang) return { sah: false, alasan: "kedaluwarsa" };
  if (habis - terbit > UMUR_MAKS_MS) return { sah: false, alasan: "umur_terlalu_panjang" };
  if (terbit - sekarang > JAM_MAJU_MS) return { sah: false, alasan: "terbit_di_masa_depan" };

  if (typeof isi.email !== "string" || !isi.email.includes("@")) return { sah: false, alasan: "email_kosong" };
  if (typeof isi.jti !== "string" || isi.jti.length < 16 || isi.jti.length > 64) return { sah: false, alasan: "jti_salah" };

  return { sah: true, isi: isi as unknown as IsiTiketMasuk };
}

export type PenggunaTiket = { id: number; name: string; email: string; role: string };

/**
 * Periksa tiket + pakai jti-nya + cari penggunanya. Aturan 6 & 7: jti sekali pakai, pengguna harus
 * sudah ada & aktif (dicocokkan lewat email); peran TIDAK PERNAH diambil dari tiket.
 * Pemilik pertama TIDAK dibuat dari tiket — instalasi Employee selalu dipasang dengan akun admin.
 */
export async function pakaiTiketMasuk(
  tiket: string,
  jalur: "peramban" | "hp",
): Promise<{ ok: true; pengguna: PenggunaTiket; isi: IsiTiketMasuk } | { ok: false; alasan: string }> {
  const tolak = (alasan: string) => {
    console.warn(`[tiket-masuk:${jalur}] ditolak: ${alasan}`);
    return { ok: false as const, alasan };
  };

  const k = await keadaanLisensi().catch(() => null);
  const h = periksaTiketMasukMurni(tiket, {
    kunciPublik: kunciPublikLisensi(),
    kidTerpasang: k?.kidTerverifikasi ?? null,
    alamatSaya: alamatInstalasi(),
  });
  if (!h.sah) return tolak(h.alasan);
  if (k?.klien && h.isi.klien !== k.klien) return tolak("usaha_lain");

  // Aturan 6. Tabelnya kecil: baris kedaluwarsa disapu tiap kali ada yang masuk.
  try {
    await prisma.tiketMasukTerpakai.deleteMany({ where: { kedaluwarsaPada: { lt: new Date() } } });
    await prisma.tiketMasukTerpakai.create({
      data: { jti: h.isi.jti, kedaluwarsaPada: new Date(h.isi.kedaluwarsaPada) },
    });
  } catch {
    return tolak("tiket_sudah_dipakai");
  }

  const user = await prisma.user.findUnique({ where: { email: h.isi.email.trim().toLowerCase() } });
  if (!user || !user.isActive) return tolak("pengguna_tidak_ada");

  console.info(`[tiket-masuk:${jalur}] masuk: user #${user.id}`);
  return { ok: true, pengguna: { id: user.id, name: user.name, email: user.email, role: user.role }, isi: h.isi };
}

/** Pesan untuk manusia. Alasan teknisnya tetap di log server, bukan di layar. */
export function pesanTiketDitolak(alasan: string): string {
  if (alasan === "pengguna_tidak_ada")
    return "Email akun qaloka.com ini belum terdaftar sebagai pengguna aktif di Qaloka Employee. Minta admin menambahkannya di Pengguna.";
  if (alasan === "tiket_sudah_dipakai" || alasan === "kedaluwarsa")
    return "Tautan masuk sudah dipakai atau kedaluwarsa. Coba lagi.";
  return "Tidak bisa masuk dengan akun qaloka.com. Masuk dengan email dan sandi Qaloka Employee.";
}
