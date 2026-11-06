import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { nextEmployeeCode } from "@/lib/services/employee-code";

/**
 * Pendaftaran magang. Dua jalur (keputusan owner 7 Nov 2026):
 *  - dibuatkan pengawas → `buatPesertaBaru` (Employee + MagangPeserta sekaligus, anak membuat PIN
 *    saat pertama membuka tautannya);
 *  - mandiri lewat tautan pendaftaran → MagangPendaftar "menunggu" → pengawas menyetujui →
 *    `setujuiPendaftar` (Employee memakai token & PIN yang dibuat anak saat mendaftar).
 */

export type KeadaanTautan = "aktif" | "kedaluwarsa" | "dimatikan";

export function keadaanTautan(t: { aktif: boolean; berlakuSampai: Date }, hariIni: string): KeadaanTautan {
  if (!t.aktif) return "dimatikan";
  return toYmd(t.berlakuSampai) < hariIni ? "kedaluwarsa" : "aktif";
}

/** Penahan kiriman pendaftaran per IP: longgar (satu kelas bisa mendaftar dari WiFi yang sama). */
const BATAS = 30;
const JENDELA = 60 * 60 * 1000;
const ember = new Map<string, { n: number; reset: number }>();
export function bolehKirimPendaftaran(ip: string, sekarang = Date.now()): boolean {
  for (const [k, v] of ember) if (v.reset < sekarang) ember.delete(k);
  const e = ember.get(ip);
  if (!e) {
    ember.set(ip, { n: 1, reset: sekarang + JENDELA });
    return true;
  }
  e.n += 1;
  return e.n <= BATAS;
}

export function ipKlien(req: Request): string {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "lokal";
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function buatPesertaBaru(
  db: Db,
  d: { namaLengkap: string; panggilan: string | null; hp: string | null; sekolah: string | null; jurusan: string | null; mulai: string; selesai?: string | null; catatan?: string | null },
  pin?: { token: string; pinHash: string }
) {
  const employee = await db.employee.create({
    data: {
      employeeCode: await nextEmployeeCode(db as PrismaClient, d.panggilan || d.namaLengkap),
      publicToken: pin?.token ?? randomUUID(),
      fullName: d.namaLengkap,
      nickname: d.panggilan,
      phone: d.hp,
      joinDate: atMidnight(d.mulai),
      ...(pin ? { portalPin: pin.pinHash, portalPinSetAt: new Date() } : {}),
    },
  });
  const peserta = await db.magangPeserta.create({
    data: {
      employeeId: employee.id,
      sekolah: d.sekolah,
      jurusan: d.jurusan,
      mulai: atMidnight(d.mulai),
      selesai: d.selesai ? atMidnight(d.selesai) : null,
      catatan: d.catatan ?? null,
    },
  });
  return { employee, peserta };
}

export function tolakMenunggu(): Response {
  return NextResponse.json(
    { message: "Pendaftaran magangmu masih menunggu persetujuan pengawas. Buka lagi tautan ini setelah disetujui.", code: "MAGANG_MENUNGGU" },
    { status: 404 }
  );
}
