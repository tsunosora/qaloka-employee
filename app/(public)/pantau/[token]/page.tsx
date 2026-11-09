import type { Metadata } from "next";
import { PantauGuru } from "@/components/pantau/PantauGuru";

// Halaman guru tidak boleh diindeks (tautan rahasia). X-Robots-Tag juga dipasang next.config.ts untuk semua jalur.
export const metadata: Metadata = {
  title: "Pantauan guru pembimbing",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * PUBLIK — pantauan anak magang untuk guru pembimbing satu sekolah (/pantau/<token> + PIN, hanya baca).
 * Halaman selalu 200; token tak berlaku ditampilkan setelah API status membalas 404.
 */
export default async function PantauPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PantauGuru token={token} />;
}
