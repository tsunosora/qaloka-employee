"use client";

/**
 * Keadaan lisensi Qaloka untuk tampilan: menyaring menu, menjaga halaman, dan memasang
 * spanduk tenggang / hanya-baca. SEMUA INI KOSMETIK — penegakan yang sebenarnya ada di server
 * (lib/http.ts → route()). Keadaannya dihitung di server (layout dasbor) lalu dioper lewat
 * context, jadi tidak ada permintaan tambahan dan menu tidak berkedip.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { ATURAN_HALAMAN, fiturUntuk } from "@/lib/lisensi/aturan-jalur";

export type LisensiTampil = {
  ditegakkan: boolean;
  status: string;
  hanyaBaca: boolean;
  alasan: string | null;
  fitur: string[];
  sisaHari: number | null;
  sisaHariTenggang: number | null;
};

const TERBUKA: LisensiTampil = {
  ditegakkan: false,
  status: "tanpa_lisensi",
  hanyaBaca: false,
  alasan: null,
  fitur: [],
  sisaHari: null,
  sisaHariTenggang: null,
};

const Konteks = createContext<LisensiTampil>(TERBUKA);

export function LisensiProvider({ nilai, children }: { nilai: LisensiTampil | null; children: ReactNode }) {
  return <Konteks.Provider value={nilai ?? TERBUKA}>{children}</Konteks.Provider>;
}

export const useLisensi = () => useContext(Konteks);

/** Boleh melihat jalur halaman ini? Gagal-terbuka: tanpa kunci = boleh. */
export function bolehHalaman(l: LisensiTampil, href: string): boolean {
  // Hanya-baca: semua layar boleh dibuka (servernya cuma menolak menulis).
  if (!l.ditegakkan || l.hanyaBaca) return true;
  const kode = fiturUntuk(href, ATURAN_HALAMAN);
  return !kode || l.fitur.includes(kode);
}

/** Ganti isi halaman yang fiturnya tidak termasuk paket dengan penjelasan + jalan keluar. */
export function PenjagaHalaman({ children }: { children: ReactNode }) {
  const l = useLisensi();
  const jalur = usePathname() || "/";
  if (bolehHalaman(l, jalur)) return <>{children}</>;
  const kode = fiturUntuk(jalur, ATURAN_HALAMAN);
  return (
    <div className="glass mx-auto mt-10 max-w-lg rounded-2xl p-6 text-sm">
      <h1 className="font-display text-lg font-bold text-fg">Fitur ini belum aktif di langganan ini</h1>
      <p className="mt-2 leading-relaxed text-muted">
        Halaman ini butuh fitur <code className="rounded bg-surface-2 px-1">{kode}</code>, yang tidak termasuk paket
        Qaloka Employee yang terpasang. Datanya tidak diapa-apakan.
      </p>
      <p className="mt-3">
        <Link href="/settings/langganan" className="font-semibold text-primary underline-offset-2 hover:underline">
          Lihat langganan
        </Link>
      </p>
    </div>
  );
}

/** Spanduk masa tenggang & hanya-baca. Tidak dirender saat lisensi aktif atau tidak ditegakkan. */
export function SpandukLisensi() {
  const l = useLisensi();
  if (!l.ditegakkan || (l.status !== "tenggang" && !l.hanyaBaca)) return null;
  const sebab =
    l.alasan === "masa_berlaku_habis"
      ? "Lisensi Qaloka sudah habis"
      : "Kunci lisensi Qaloka tidak cocok dengan instalasi ini";
  const teks = l.hanyaBaca
    ? `${sebab}: aplikasi HANYA-BACA. Data lama tetap bisa dibuka & diekspor, absensi dari mesin tetap masuk, tapi data baru belum bisa disimpan dari layar.`
    : `Masa berlaku lisensi sudah lewat — masih bisa dipakai ${l.sisaHariTenggang ?? 0} hari lagi sebelum jadi hanya-baca.`;
  return (
    <div
      role="status"
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        l.hanyaBaca ? "border-danger/40 bg-danger/10 text-fg" : "border-warning/40 bg-warning/10 text-fg"
      }`}
    >
      {teks}{" "}
      <Link href="/settings/langganan" className="font-semibold underline underline-offset-2">
        Perbarui langganan
      </Link>
    </div>
  );
}
