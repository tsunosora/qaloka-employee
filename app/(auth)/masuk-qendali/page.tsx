"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { IconAlert } from "@/components/ui/icons";
import { NamaMerek, UbinLogo } from "@/components/QendaliMark";

/**
 * /masuk-qendali?tiket=qm1.… — tujuan tombol "Buka aplikasimu" di portal qaloka.com.
 * Jalurnya kontrak dengan repo qendali (lib/tiket-masuk.mjs → JALUR_MASUK).
 *
 * Tiket dipindah ke badan permintaan dan alamat browser dibersihkan SEBELUM diperiksa, supaya
 * tiketnya tidak tertinggal di riwayat, header Referer, atau log akses. Pemeriksaannya di server
 * (provider "qendali-tiket" di lib/auth.ts → lib/lisensi/tiket-masuk.ts).
 */
export default function MasukQalokaPage() {
  const router = useRouter();
  const [gagal, setGagal] = useState(false);
  const sudah = useRef(false);

  useEffect(() => {
    if (sudah.current) return;
    sudah.current = true;
    const tiket = new URLSearchParams(window.location.search).get("tiket") ?? "";
    window.history.replaceState(null, "", "/masuk-qendali");
    const masuk = tiket
      ? signIn("qendali-tiket", { tiket, redirect: false }).then((res) => !!res && !res.error)
      : Promise.resolve(false);
    masuk.then((ok) => {
      if (!ok) {
        setGagal(true);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }, [router]);

  return (
    <main className="ambient relative flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="glass-2 relative z-10 w-full max-w-sm space-y-5 rounded-3xl p-8 text-center shadow-2xl">
        <div className="flex flex-col items-center">
          <span className="mb-3">
            <UbinLogo besar />
          </span>
          <h1>
            <NamaMerek className="text-2xl" />
          </h1>
        </div>
        {gagal ? (
          <>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-danger"
              style={{ background: "color-mix(in oklab, var(--danger) 16%, transparent)" }}
            >
              <IconAlert className="shrink-0 text-[16px]" />
              Tautan masuk dari qaloka.com tidak bisa dipakai (sudah dipakai, kedaluwarsa, atau akunmu
              belum terdaftar di sini).
            </div>
            <Link href="/login" className="btn-primary h-11 w-full">
              Masuk dengan email &amp; sandi
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted">Membuka dasbor…</p>
        )}
      </div>
    </main>
  );
}
