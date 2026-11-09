import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Next.js 16: konvensi "middleware" -> "proxy". Kita buat instance Auth.js
// dari config RINGAN (tanpa PrismaAdapter) agar bundle proxy tidak memuat
// Prisma/native engine. Session dibaca dari JWT (tanpa akses DB).
const { auth } = NextAuth(authConfig);

// Proxy hanya menegakkan AUTENTIKASI (sudah login?). Otorisasi per-role
// ditegakkan di server-layout tiap seksi (app/(dashboard)/**/layout.tsx) +
// di dalam tiap route API (requireManager/requireAdmin).
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Mesin Fingerspot mode Web mem-POST ke "/" dgn header request_code (protokol realtime).
  // Diarahkan ke /api/fingerspot/realtime lewat rewrite INTERNAL di next.config.ts
  // (bukan rewrite di middleware — itu memakai host publik & menyebabkan loop lewat
  // Cloudflare → error 1000). Di sini cukup biarkan lolos (jangan redirect ke login).
  if (req.method === "POST" && req.headers.get("request_code")) {
    return;
  }

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/masuk-qendali") ||
    pathname.startsWith("/api/hp/tiket-masuk") ||
    pathname.startsWith("/rate") ||
    pathname.startsWith("/absence") ||
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    // Pendaftaran magang mandiri: dibuka anak yang belum punya akun (lewat tautan dari pengawas).
    pathname.startsWith("/daftar-magang/") ||
    // Pantauan guru sekolah: dibuka guru TANPA akun (tautan + PIN per sekolah, hanya baca).
    pathname.startsWith("/pantau/") ||
    pathname.startsWith("/api/public/pantau/") ||
    // Absen lewat HP: dibuka karyawan TANPA akun (masuk dengan PIN), dan layar QR dibuka
    // tablet/TV toko. Dicocokkan per segmen — "/absen" bukan awalan "/absence".
    pathname.startsWith("/absen/") ||
    pathname.startsWith("/absen-layar/") ||
    pathname.startsWith("/link-expired") ||
    // robots.txt WAJIB bisa dibaca crawler tanpa login — kalau dialihkan ke /login,
    // mesin pencari tak pernah melihat larangan indeksnya.
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/api/public") ||
    // Endpoint server-ke-server; auth-nya kunci API, bukan sesi login.
    pathname.startsWith("/api/integrations") ||
    pathname.startsWith("/api/fingerspot") ||
    pathname.startsWith("/iclock") ||
    pathname.startsWith("/api/auth");

  // Aplikasi HP Owner: token Bearer hp1.… diperiksa di route (requireSession), bukan di sini —
  // proxy tidak memuat Prisma. Hanya untuk /api, supaya token tidak membuka halaman.
  const tokenHp =
    pathname.startsWith("/api/") && /^bearer\s+hp1\./i.test(req.headers.get("authorization") ?? "");

  if (!isPublic && !tokenHp && !req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
