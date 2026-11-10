"use client";

import { IconClock } from "@/components/ui/icons";
import { soft } from "./ui";

/** "09:00" + 15 → "09.15" (batas datang sebelum dihitung terlambat). */
export function batasTelat(masuk: string, toleransiMenit: number): string {
  const [h, m] = masuk.split(":").map(Number);
  const t = h * 60 + m + Math.max(0, toleransiMenit);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}.${String(t % 60).padStart(2, "0")}`;
}

/**
 * Baris info jam kerja khusus anak magang — supaya anak (dan pembina yang membuka halaman ini) tahu status
 * "Terlambat" dihitung dari jam berapa. Teks lengkap, bukan warna saja.
 */
export function JamKerjaMagang({ jam, ringkas = false }: { jam: { label: string; masuk: string; toleransiMenit: number }; ringkas?: boolean }) {
  return (
    <p
      className="flex items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm text-fg"
      style={soft("var(--info)", 8)}
    >
      <IconClock className="mt-0.5 shrink-0 text-[16px] text-info" aria-hidden="true" />
      <span>
        <b className="tabular block">Jam kerja magang {jam.label}</b>
        {!ringkas && (
          <span className="block text-muted">
            Dihitung terlambat bila masuk lewat <span className="tabular">{batasTelat(jam.masuk, jam.toleransiMenit)}</span>
          </span>
        )}
      </span>
    </p>
  );
}
