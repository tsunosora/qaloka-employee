"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@/components/Sidebar";
import { IconMenu, IconX } from "@/components/ui/icons";

/** Hamburger + slide-in drawer for < lg screens (desktop keeps the fixed aside). */
export function MobileSidebar({ role }: { role?: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Close the drawer whenever navigation happens (state disesuaikan saat render, bukan di effect).
  const [pathTerakhir, setPathTerakhir] = useState(pathname);
  if (pathTerakhir !== pathname) {
    setPathTerakhir(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Kunci gulir halaman di belakang laci (html + body — iOS mengabaikan body saja).
    // Lebar scrollbar yang hilang diganti padding supaya isi halaman tidak bergeser.
    const html = document.documentElement;
    const body = document.body;
    const sebelum = { html: html.style.overflow, body: body.style.overflow, pr: body.style.paddingRight };
    const lebarScrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (lebarScrollbar > 0) body.style.paddingRight = `${lebarScrollbar}px`;

    closeBtnRef.current?.focus();
    const tombolMenu = menuBtnRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = sebelum.html;
      body.style.overflow = sebelum.body;
      body.style.paddingRight = sebelum.pr;
      // Fokus kembali ke tombol menu yang membuka laci.
      tombolMenu?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={menuBtnRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="grid h-9 w-9 place-items-center rounded-xl border border-border-strong text-muted transition hover:bg-surface-2 hover:text-fg active:scale-95"
      >
        <IconMenu className="text-[19px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_.15s_ease]"
            onClick={() => setOpen(false)}
          />
          {/* h-dvh + overflow-hidden: yang bergulir hanya daftar menu di SidebarNav;
              padding bawah ikut safe-area (bilah gestur HP). */}
          <div className="glass-2 absolute left-0 top-0 flex h-dvh w-72 max-w-[85vw] flex-col gap-1 overflow-hidden rounded-none border-y-0 border-l-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-[slideIn_.2s_cubic-bezier(0.16,1,0.3,1)]">
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup menu"
              className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-lg text-subtle transition hover:bg-surface-2 hover:text-fg"
            >
              <IconX className="text-[18px]" />
            </button>
            <SidebarNav role={role} />
          </div>

          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes slideIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }
          `}</style>
        </div>
      )}
    </div>
  );
}
