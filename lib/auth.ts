import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { canAttempt, recordFailure, clearAttempts, sweep } from "@/lib/rate-limit";
import { pakaiTiketMasuk } from "@/lib/lisensi/tiket-masuk";

function clientIp(req?: Request): string {
  const h = req?.headers;
  const fwd = h?.get("x-forwarded-for");
  return (fwd?.split(",")[0] || h?.get("x-real-ip") || "unknown").trim();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        // Rate limit: batasi percobaan gagal per IP+email (anti brute-force).
        sweep();
        const key = `login:${clientIp(request as Request)}:${email.toLowerCase()}`;
        if (!canAttempt(key)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Tolak akun tidak dikenal ATAU yang dinonaktifkan.
        if (!user || !user.isActive) {
          recordFailure(key);
          return null;
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          recordFailure(key);
          return null;
        }

        clearAttempts(key);
        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    // Tiket masuk `qm1` dari portal qaloka.com (/masuk-qendali). Gagal-tertutup; aturannya di
    // lib/lisensi/tiket-masuk.ts. Peran diambil dari akun di sini, tidak pernah dari tiket.
    Credentials({
      id: "qendali-tiket",
      credentials: { tiket: { type: "text" } },
      async authorize(credentials, request) {
        const tiket = credentials?.tiket;
        if (typeof tiket !== "string") return null;
        sweep();
        const key = `tiket:${clientIp(request as Request)}`;
        if (!canAttempt(key)) return null;
        const hasil = await pakaiTiketMasuk(tiket, "peramban");
        if (!hasil.ok) {
          recordFailure(key);
          return null;
        }
        clearAttempts(key);
        const { id, name, email, role } = hasil.pengguna;
        return { id: String(id), name, email, role: role as never };
      },
    }),
  ],
});
