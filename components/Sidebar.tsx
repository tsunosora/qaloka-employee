"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { bolehHalaman, useLisensi, type LisensiTampil } from "@/components/lisensi/Lisensi";
import { NamaMerek, UbinLogo } from "@/components/QendaliMark";
import {
  IconDashboard,
  IconAttendance,
  IconUsers,
  IconStar,
  IconBox,
  IconSettings,
  IconChevronDown,
  IconClock,
} from "@/components/ui/icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/** Dompet — untuk menu Upah. Lokal di sini karena set ikon bersama belum punya ikon uang. */
const IconUang = (p: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
  </svg>
);

/** Topi wisuda — untuk menu Magang. */
const IconMagang = (p: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M22 10 12 5 2 10l10 5 10-5Z" />
    <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    <path d="M22 10v6" />
  </svg>
);

type Access = "all" | "manager" | "admin";
type NavItem = { label: string; href: string; require?: Access };
type NavGroup = {
  label: string;
  href?: string;
  icon: IconType;
  require?: Access;
  children?: NavItem[];
};

const NAV: NavGroup[] = [
  { label: "Dashboard", href: "/dashboard", icon: IconDashboard },
  {
    label: "Absensi",
    icon: IconAttendance,
    require: "manager",
    children: [
      { label: "Dashboard", href: "/attendance" },
      { label: "Laporan Detail", href: "/attendance/report" },
      { label: "Struk", href: "/attendance/receipt" },
      { label: "Jadwal Shift", href: "/jadwal-shift" },
      { label: "Izin & Cuti", href: "/leave-requests" },
      { label: "Pengajuan Lembur", href: "/lembur" },
      { label: "Absen di Luar Lokasi", href: "/attendance/absen-luar" },
      { label: "Absen Tim", href: "/attendance/absen-tim" },
      { label: "Rekap Tim", href: "/attendance/rekap-tim" },
    ],
  },
  {
    label: "Upah",
    icon: IconUang,
    require: "manager",
    children: [{ label: "Rekap Upah", href: "/upah" }],
  },
  {
    label: "Kerja Harian",
    icon: IconClock,
    require: "manager",
    children: [
      { label: "Reimbursement", href: "/reimbursement" },
      { label: "Kunjungan Klien", href: "/kunjungan" },
      { label: "Timesheet", href: "/timesheet" },
    ],
  },
  { label: "Direktori", href: "/employees", icon: IconUsers, require: "manager" },
  {
    label: "Magang",
    icon: IconMagang,
    require: "manager",
    children: [
      { label: "Minggu Ini", href: "/magang" },
      { label: "Rotasi Pos", href: "/magang/rotasi" },
      { label: "Pos & Soal", href: "/magang/pos" },
      { label: "Jadwal Konten", href: "/magang/konten" },
      { label: "Side Quest", href: "/magang/misi" },
      { label: "Peserta", href: "/magang/peserta" },
      { label: "Sekolah", href: "/magang/sekolah" },
    ],
  },
  { label: "Inventaris", href: "/inventaris", icon: IconBox, require: "manager" },
  {
    label: "Penilaian",
    icon: IconStar,
    children: [
      { label: "Skor Baru", href: "/assessments/single" },
      { label: "Skor Massal", href: "/assessments/bulk" },
      { label: "Template", href: "/assessments/templates" },
      { label: "Laporan", href: "/reports" },
      { label: "Poin & Hadiah", href: "/points", require: "manager" },
    ],
  },
  {
    label: "Pengaturan",
    icon: IconSettings,
    require: "manager",
    children: [
      { label: "Umum", href: "/settings" },
      { label: "Jadwal Kerja", href: "/settings/work-schedules" },
      { label: "Absen lewat HP", href: "/settings/absen-hp" },
      { label: "Tim Kerja", href: "/settings/tim-kerja" },
      { label: "Tarif Upah", href: "/settings/upah" },
      { label: "Akun & Peran", href: "/settings/users", require: "admin" },
      { label: "Langganan", href: "/settings/langganan", require: "admin" },
    ],
  },
];

function allowed(access: Access | undefined, role?: string | null): boolean {
  const isAdmin = role === "ADMIN" || role === "OWNER";
  const isManager = isAdmin || role === "HR";
  if (access === "admin") return isAdmin;
  if (access === "manager") return isManager;
  return true;
}

/**
 * Saring NAV sesuai role DAN lisensi: buang grup/anak yang tak diizinkan atau yang fiturnya
 * tidak termasuk paket (kosmetik — servernya yang menolak sungguhan).
 */
function navForRole(role: string | null | undefined, lisensi: LisensiTampil): NavGroup[] {
  const boleh = (access: Access | undefined, href?: string) =>
    allowed(access, role) && (!href || bolehHalaman(lisensi, href));
  return NAV.filter((g) => boleh(g.require, g.href))
    .map((g) =>
      g.children
        ? { ...g, children: g.children.filter((c) => boleh(c.require, c.href)) }
        : g
    )
    .filter((g) => !g.children || g.children.length > 0);
}

export function Sidebar({ role }: { role?: string | null }) {
  return (
    // h-dvh + overflow-hidden: tinggi aside dikunci ke layar; yang bergulir hanya daftar menu
    // (di SidebarNav), jadi logo tetap di atas dan kartu bawah tetap di bawah tanpa menutupi menu.
    <aside className="glass sticky top-0 z-20 hidden h-dvh w-64 shrink-0 flex-col gap-1 overflow-hidden rounded-none border-y-0 border-l-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:flex">
      <SidebarNav role={role} />
    </aside>
  );
}

/** Shared nav content — used by the desktop aside and the mobile drawer. */
export function SidebarNav({ role }: { role?: string | null }) {
  const pathname = usePathname();
  const lisensi = useLisensi();
  const nav = navForRole(role, lisensi);
  // Yang menyala cuma tautan yang PALING cocok dengan alamatnya (per segmen). Dulu dicocokkan
  // per awalan, jadi "Dashboard" Absensi (/attendance) ikut menyala di Laporan Detail, Struk,
  // dan Absen di Luar Lokasi — dua menu aktif sekaligus.
  const semuaHref = nav.flatMap((g) => [g.href, ...(g.children ?? []).map((c) => c.href)]).filter(Boolean) as string[];
  const cocok = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const terbaik = semuaHref.filter(cocok).sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === terbaik;

  // Menu aktif digulir ke dalam pandangan saat dimuat (mis. Pengaturan di bawah daftar panjang).
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <>
      <Link href="/dashboard" className="mb-6 flex shrink-0 items-center gap-2.5 px-2">
        <UbinLogo />
        <NamaMerek className="text-lg" />
      </Link>

      {/* Satu-satunya bagian yang bergulir. min-h-0 supaya boleh menyusut di kolom flex.
          -mx-1/px-1 & -my-1/py-1: ruang untuk cincin fokus agar tak terpotong tepi gulir.
          Di desktop, alur scrollbar dicadangkan tetap (tanpa geser tata letak saat menu
          memanjang) dan dikompensasi dengan margin kanan supaya lebar menu sama seperti dulu. */}
      <nav
        ref={navRef}
        aria-label="Navigasi utama"
        className="-mx-1 -my-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-1 py-1 text-sm lg:-mr-3.5 lg:[scrollbar-gutter:stable]"
      >
        {nav.map((group) =>
          group.children ? (
            <NavGroupItem key={group.label} group={group} isActive={isActive} />
          ) : (
            <Link
              key={group.label}
              href={group.href!}
              aria-current={isActive(group.href!) ? "page" : undefined}
              className={linkClass(isActive(group.href!))}
            >
              <group.icon className="text-[18px] shrink-0" />
              <span>{group.label}</span>
            </Link>
          )
        )}
      </nav>

      <div className="mt-2 shrink-0 rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted">
        <p className="font-semibold text-fg">Team Management</p>
        <p className="mt-0.5 leading-relaxed">
          Absensi, proyek, briefing &amp; penilaian dalam satu tempat.
        </p>
      </div>
    </>
  );
}

function NavGroupItem({
  group,
  isActive,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
}) {
  const anyActive = group.children!.some((c) => isActive(c.href));
  const [open, setOpen] = useState(anyActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition max-lg:min-h-11 ${
          anyActive && !open
            ? "text-fg"
            : "text-muted hover:bg-surface-2 hover:text-fg"
        }`}
      >
        <group.icon className="text-[18px] shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <IconChevronDown
          className={`text-[15px] text-subtle transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ${
          open ? "mt-1 grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-3">
            {group.children!.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                aria-current={isActive(c.href) ? "page" : undefined}
                tabIndex={open ? undefined : -1}
                className={subLinkClass(isActive(c.href))}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function linkClass(active: boolean) {
  return [
    // max-lg:min-h-11 — target sentuh ≥44px di laci HP; desktop tetap seperti semula.
    "flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition max-lg:min-h-11",
    active
      ? "bg-gradient-to-r from-primary to-primary-2 text-on-primary shadow-lg shadow-primary/25"
      : "text-muted hover:bg-surface-2 hover:text-fg",
  ].join(" ");
}

function subLinkClass(active: boolean) {
  return [
    "flex items-center rounded-lg px-3 py-2 transition max-lg:min-h-11",
    active
      ? "bg-surface-2 font-medium text-primary"
      : "text-muted hover:bg-surface-2 hover:text-fg",
  ].join(" ");
}
