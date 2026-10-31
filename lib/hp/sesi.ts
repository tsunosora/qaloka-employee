/**
 * Sesi aplikasi HP Qaloka Owner (repo tsunosora/smartowner).
 *
 * HP tidak memegang cookie NextAuth. Ia menukar tiket masuk `qm1` dari qaloka.com di
 * `POST /api/hp/tiket-masuk` menjadi token ini, lalu mengirimnya sebagai
 * `Authorization: Bearer hp1.…` ke API yang SAMA dengan dasbor — `requireSession()` di lib/http.ts
 * menerimanya sebagai pengganti cookie. Jadi tidak ada API kembar untuk HP, dan lisensi, RBAC,
 * serta validasinya otomatis sama.
 *
 * Token = HMAC, bukan JWT pustaka: tiga bagian, amplop `hp1` supaya tidak tertukar dengan tiket
 * qaloka.com. Pengguna dibaca ulang dari DB tiap permintaan — dinonaktifkan atau diturunkan
 * perannya berlaku seketika — dan token membawa sidik hash sandi, jadi ganti sandi mengusirnya.
 * Habis (401) → HP meminta tiket baru ke qaloka.com tanpa bertanya ke pemiliknya.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { canManage } from "@/lib/rbac";

export const AMPLOP_HP = "hp1";
export const UMUR_SESI_HP_MS = 12 * 60 * 60_000;

type IsiSesi = { uid: number; sidik: string; exp: number };

function rahasia(): Buffer | null {
  const r = (process.env.HP_SESI_RAHASIA || process.env.AUTH_SECRET || "").trim();
  // Tanpa rahasia yang layak, token HP tidak diterbitkan maupun diterima (gagal-tertutup).
  if (r.length < 16 || r === "CHANGE_ME") return null;
  // Kunci turunan: rahasia NextAuth tidak dipakai mentah untuk keperluan lain.
  return createHmac("sha256", r).update("qendali-employee:sesi-hp:v1").digest();
}

const ttd = (kunci: Buffer, badan: string) => createHmac("sha256", kunci).update(badan).digest("base64url");

/** Sidik hash sandi: berubah saat sandi diganti, tidak membocorkan hash-nya. */
export function sidikSandi(hashSandi: string): string {
  return createHash("sha256").update(hashSandi).digest("base64url").slice(0, 16);
}

/** MURNI kecuali `kunci`. */
export function terbitkanTokenMurni(isi: IsiSesi, kunci: Buffer): string {
  const badan = `${AMPLOP_HP}.${Buffer.from(JSON.stringify(isi)).toString("base64url")}`;
  return `${badan}.${ttd(kunci, badan)}`;
}

/** MURNI kecuali `kunci`. null = tidak sah / kedaluwarsa. */
export function bacaTokenMurni(token: string, kunci: Buffer, sekarang = Date.now()): IsiSesi | null {
  const bagian = String(token ?? "").split(".");
  if (bagian.length !== 3 || bagian[0] !== AMPLOP_HP) return null;
  const harap = Buffer.from(ttd(kunci, `${bagian[0]}.${bagian[1]}`));
  const ada = Buffer.from(bagian[2]);
  if (harap.length !== ada.length || !timingSafeEqual(harap, ada)) return null;
  try {
    const isi = JSON.parse(Buffer.from(bagian[1], "base64url").toString("utf8")) as IsiSesi;
    if (!Number.isInteger(isi.uid) || typeof isi.sidik !== "string" || !(isi.exp > sekarang)) return null;
    return isi;
  } catch {
    return null;
  }
}

export function terbitkanTokenHp(user: { id: number; password: string }): { token: string; kedaluwarsaPada: string } | null {
  const kunci = rahasia();
  if (!kunci) return null;
  const exp = Date.now() + UMUR_SESI_HP_MS;
  return {
    token: terbitkanTokenMurni({ uid: user.id, sidik: sidikSandi(user.password), exp }, kunci),
    kedaluwarsaPada: new Date(exp).toISOString(),
  };
}

export function tokenDariHeader(authorization: string | null | undefined): string | null {
  const m = /^bearer\s+(hp1\.\S+)$/i.exec(String(authorization ?? "").trim());
  return m ? m[1] : null;
}

/**
 * Session setara NextAuth dari token HP, atau null. Hanya peran manajemen (OWNER/ADMIN/HR):
 * aplikasi ini untuk pemilik, bukan untuk penilai.
 */
export async function sesiDariTokenHp(token: string): Promise<Session | null> {
  const kunci = rahasia();
  if (!kunci) return null;
  const isi = bacaTokenMurni(token, kunci);
  if (!isi) return null;
  const user = await prisma.user.findUnique({ where: { id: isi.uid } });
  if (!user || !user.isActive || sidikSandi(user.password) !== isi.sidik || !canManage(user.role)) return null;
  return {
    user: { id: String(user.id), name: user.name, email: user.email, role: user.role },
    expires: new Date(isi.exp).toISOString(),
  } as Session;
}
