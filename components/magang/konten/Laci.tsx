"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@/components/ui/icons";
import { FOKUS } from "@/components/magang/konten/tipe";

/**
 * Laci samping (layar < 1280 px): panel kanan selebar maks. 28rem (penuh di HP) di atas tirai. Esc / tirai /
 * tombol Tutup menutup; fokus pindah ke tombol Tutup saat dibuka dan kembali ke pemicu saat ditutup.
 */
export function Laci({ id, judul, onClose, children }: { id?: string; judul: string; onClose: () => void; children: ReactNode }) {
  const tutup = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const asal = document.activeElement as HTMLElement | null;
    tutup.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      asal?.focus?.();
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={judul} id={id}>
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_.15s_ease]" onClick={onClose} />
      <div className="glass-2 absolute inset-y-0 right-0 flex w-full max-w-md flex-col shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <h2 className="font-display text-base font-bold text-fg">{judul}</h2>
          <button ref={tutup} type="button" onClick={onClose} aria-label="Tutup" className={`grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg ${FOKUS}`}>
            <IconX className="text-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>,
    document.body
  );
}
