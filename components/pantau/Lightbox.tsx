"use client";

import { useEffect, useRef, useState } from "react";
import { IconX } from "@/components/ui/icons";

/** Foto diperbesar: Esc / tombol Tutup / klik latar menutup; fokus pindah ke tombol Tutup lalu kembali. */
export function Lightbox({ src, alt, onTutup }: { src: string; alt: string; onTutup: () => void }) {
  const tombol = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const sebelum = document.activeElement as HTMLElement | null;
    tombol.current?.focus();
    const tekan = (e: KeyboardEvent) => e.key === "Escape" && onTutup();
    window.addEventListener("keydown", tekan);
    return () => {
      window.removeEventListener("keydown", tekan);
      sebelum?.focus?.();
    };
  }, [onTutup]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 print:hidden"
      onClick={onTutup}
    >
      <button
        ref={tombol}
        type="button"
        onClick={onTutup}
        className="absolute right-3 top-3 inline-flex h-11 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-900"
      >
        <IconX aria-hidden="true" /> Tutup
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto tersaji lewat rute ber-sesi, bukan aset statis */}
      <img src={src} alt={alt} className="max-h-[85vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

/** Gambar mini yang membuka lightbox (tombol 64px — lebih dari 44px sentuh). */
export function GambarMini({ src, alt, onBuka }: { src: string; alt: string; onBuka: (src: string, alt: string) => void }) {
  const [rusak, setRusak] = useState(false);
  if (rusak) {
    return (
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-border p-1 text-center text-[11px] leading-tight text-subtle">
        Foto tidak tersedia
      </span>
    );
  }
  return (
    <button type="button" onClick={() => onBuka(src, alt)} className="shrink-0 overflow-hidden rounded-xl border border-border" aria-label={`Perbesar: ${alt}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto tersaji lewat rute ber-sesi */}
      <img src={src} alt="" loading="lazy" className="h-16 w-16 object-cover" onError={() => setRusak(true)} />
    </button>
  );
}
