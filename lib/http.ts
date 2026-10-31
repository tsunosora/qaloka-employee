import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { sesiDariTokenHp, tokenDariHeader } from "@/lib/hp/sesi";
import { canManage, canAdminUsers } from "@/lib/rbac";
import { tolakOlehLisensi } from "@/lib/lisensi/penjaga";

/**
 * Ambil session; lempar Response 401 bila belum login. Selain cookie NextAuth, menerima token
 * aplikasi HP Owner (`Authorization: Bearer hp1.…`, lib/hp/sesi.ts) — token yang ADA tapi tidak
 * sah ditolak, tidak jatuh ke cookie, supaya HP tahu harus meminta tiket baru.
 */
export async function requireSession(): Promise<Session> {
  const tokenHp = tokenDariHeader((await headers()).get("authorization"));
  const session = tokenHp ? await sesiDariTokenHp(tokenHp) : await auth();
  if (!session) throw NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return session;
}

/** Wajib login + role manajemen (ADMIN/OWNER/HR); lempar 403 bila tidak. */
export async function requireManager(): Promise<Session> {
  const session = await requireSession();
  if (!canManage(session.user?.role))
    throw NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  return session;
}

/** Wajib login + role admin akun (ADMIN/OWNER); lempar 403 bila tidak. */
export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!canAdminUsers(session.user?.role))
    throw NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  return session;
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function badRequest(errors: unknown) {
  return NextResponse.json({ errors }, { status: 422 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ message }, { status: 404 });
}

/**
 * Bungkus handler route: tangkap Response yang dilempar (mis. dari requireSession)
 * dan error tak terduga → 500. Menjaga tiap route tetap ringkas.
 *
 * Lisensi Qaloka juga ditegakkan DI SINI (fitur per jalur + hanya-baca), jadi tiap route yang
 * memakai `route()` ikut tanpa harus ingat memanggilnya. Gagal-terbuka: tanpa kunci lisensi,
 * tidak ada yang ditolak. Lihat lib/lisensi/penjaga.ts.
 */
export function route<Ctx>(
  handler: (req: Request, ctx: Ctx) => Promise<Response>
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const tolak = await tolakOlehLisensi(req);
      if (tolak) return tolak;
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof Response) return e;
      console.error(e);
      return NextResponse.json({ message: "Internal error" }, { status: 500 });
    }
  };
}
