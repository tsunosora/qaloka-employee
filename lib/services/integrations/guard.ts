import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { periksaTiketIntegrasi, tiketDariHeader } from "@/lib/lisensi/tiket-integrasi";
import { kunciLamaDiizinkan } from "@/lib/lisensi/kunci-lama";

/** Header yang HANYA dipasang Cloudflare — keberadaannya saja sudah berarti dari luar. */
const CLOUDFLARE_HEADERS = ["cf-connecting-ip", "cf-ray", "cf-ipcountry"];

function isLoopback(addr: string | undefined | null): boolean {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/, "");
  return a === "127.0.0.1" || a === "::1" || a.startsWith("127.");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Guard mesin-ke-mesin untuk endpoint `/api/integrations/*` (backend Qaloka POS menampilkan
 * kartu ringkas HR).
 *
 * DUA PINTU (11 Okt 2026):
 * A. `Authorization: Qendali <tiket>` — tiket integrasi bertanda tangan dari qaloka.com. Boleh
 *    dari mesin MANA PUN, karena tiketnya membuktikan pemanggilnya produk Qaloka milik usaha yang
 *    SAMA dengan kunci lisensi aplikasi ini. Kalau header ini ada, HANYA tiket yang dinilai —
 *    tiket yang ditolak tidak jatuh ke kunci API (supaya kegagalannya terlihat, bukan tertutup).
 * B. Kunci API lama (di bawah) — MATI secara bawaan sejak peralihan selesai; cuma hidup kalau
 *    jalan mundur `QENDALI_INTEGRASI_KUNCI_LAMA=true` dinyalakan.
 *
 * Pintu B, aslinya:
 *
 * Cerminan dari ApiKeyGuard di sisi PosPro — dua lapis:
 * 1. Kunci API wajib (`x-api-key` vs env HR_API_KEY). Env kosong = tolak, bukan terbuka.
 * 2. Hanya pemanggil loopback. Aplikasi ini terbuka ke internet lewat Cloudflare Tunnel,
 *    jadi tanpa lapis ini endpoint integrasi ikut terekspos. Request lewat tunnel selalu
 *    membawa header Cloudflare walau soketnya tampak loopback, sehingga keduanya diperiksa.
 *    Set HR_API_ALLOW_REMOTE=true bila kelak PosPro dipindah ke server lain.
 *
 * Lempar Response bila ditolak — ditangkap oleh helper `route()`.
 */
export async function requireIntegrationKey(req: Request): Promise<void> {
  const tiket = tiketDariHeader(req);
  if (tiket !== null) {
    const h = await periksaTiketIntegrasi(tiket);
    if (h.sah) return;
    throw NextResponse.json({ message: "Tiket integrasi ditolak.", alasan: h.alasan }, { status: 401 });
  }

  // Pintu B MATI secara bawaan — kunci yang tertinggal di .env tidak membuka apa pun.
  // Lihat lib/lisensi/kunci-lama.ts.
  if (!kunciLamaDiizinkan()) {
    throw NextResponse.json(
      { message: "Endpoint integrasi cuma menerima tiket integrasi Qaloka." },
      { status: 401 }
    );
  }

  const expected = process.env.HR_API_KEY;
  if (!expected) {
    throw NextResponse.json(
      { message: "Integrasi belum diaktifkan di server ini." },
      { status: 401 }
    );
  }

  if (process.env.HR_API_ALLOW_REMOTE !== "true") {
    // Next.js SELALU memasang x-forwarded-for, termasuk untuk request lokal
    // (nilainya ::ffff:127.0.0.1). Jadi yang diperiksa ISINYA, bukan keberadaannya.
    const fromCloudflare = CLOUDFLARE_HEADERS.some((h) => req.headers.get(h));
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = req.headers.get("x-real-ip")?.trim();
    const asalLokal =
      (!forwarded || isLoopback(forwarded)) && (!realIp || isLoopback(realIp));

    if (fromCloudflare || !asalLokal) {
      throw NextResponse.json(
        { message: "Endpoint integrasi hanya untuk pemanggil lokal." },
        { status: 401 }
      );
    }
  }

  const provided = req.headers.get("x-api-key");
  if (typeof provided !== "string" || !safeEqual(provided, expected)) {
    throw NextResponse.json({ message: "API key tidak valid." }, { status: 401 });
  }
}

export { isLoopback };
