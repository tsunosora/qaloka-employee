"use client";

import { IconAlert, IconCheck } from "@/components/ui/icons";
import { soft } from "@/components/portal/ui";

/** Warna pos di kisi rotasi — urut indeks pos, berulang bila pos > 8. */
export const WARNA_POS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#db2777", "#65a30d"];
export const warnaPos = (indeks: number) => WARNA_POS[((indeks % WARNA_POS.length) + WARNA_POS.length) % WARNA_POS.length];

export type StatusTugas = "tanpa-pos" | "dinilai" | "menunggu-nilai" | "belum-buka" | "belum-diisi" | "terlambat";

const STATUS: Record<StatusTugas, { label: string; warna: string }> = {
  "tanpa-pos": { label: "Tidak ada pos", warna: "var(--fg-subtle)" },
  dinilai: { label: "Sudah dinilai", warna: "var(--success)" },
  "menunggu-nilai": { label: "Perlu dinilai", warna: "var(--warning)" },
  "belum-buka": { label: "Belum dibuka", warna: "var(--fg-muted)" },
  "belum-diisi": { label: "Belum diisi", warna: "var(--info)" },
  terlambat: { label: "Terlambat, belum diisi", warna: "var(--danger)" },
};

export function ChipStatus({ status, label }: { status: StatusTugas; label?: string }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ ...soft(s.warna, 18), color: s.warna }}>
      {label ?? s.label}
    </span>
  );
}

export function Pesan({ jenis, children }: { jenis: "ok" | "galat"; children: React.ReactNode }) {
  const warna = jenis === "ok" ? "var(--success)" : "var(--danger)";
  return (
    <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${jenis === "ok" ? "text-success" : "text-danger"}`} style={soft(warna)}>
      {jenis === "ok" ? <IconCheck className="shrink-0 text-[16px]" /> : <IconAlert className="shrink-0 text-[16px]" />}
      {children}
    </div>
  );
}

export function Judul({ judul, keterangan, aksi }: { judul: string; keterangan: string; aksi?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-fg">{judul}</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted">{keterangan}</p>
      </div>
      {aksi && <div className="flex flex-wrap gap-2">{aksi}</div>}
    </div>
  );
}

export function Kosong({ children }: { children: React.ReactNode }) {
  return <div className="glass rounded-2xl p-10 text-center text-sm text-subtle">{children}</div>;
}

export function Memuat({ baris = 3, tinggi = "h-24" }: { baris?: number; tinggi?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className={`glass ${tinggi} animate-pulse rounded-2xl`} />
      ))}
    </div>
  );
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** "2026-11-09" → "9 Nov". */
export function tglPendek(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${BULAN[m - 1]}`;
}

export function warnaNilai(n: number | null): string {
  if (n == null) return "var(--fg-subtle)";
  if (n >= 85) return "var(--success)";
  if (n >= 70) return "var(--info)";
  if (n >= 55) return "var(--warning)";
  return "var(--danger)";
}

/** Pilihan skala 1–4 bertombol (lebih cepat di HP daripada dropdown). */
export function PilihSkala({
  nilai,
  onChange,
  label,
  bantu,
  skala,
}: {
  nilai: number | null;
  onChange: (n: number) => void;
  label: string;
  bantu?: string;
  skala: readonly { nilai: number; label: string }[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-fg">{label}</legend>
      {bantu && <p className="text-xs text-muted">{bantu}</p>}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {skala.map((s) => (
          <button
            key={s.nilai}
            type="button"
            onClick={() => onChange(s.nilai)}
            aria-pressed={nilai === s.nilai}
            className={`rounded-xl border px-2 py-2 text-left text-xs transition ${
              nilai === s.nilai ? "border-primary bg-primary/10 font-semibold text-fg" : "border-border text-muted hover:border-border-strong hover:text-fg"
            }`}
          >
            <span className="block font-display text-base font-bold">{s.nilai}</span>
            {s.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
