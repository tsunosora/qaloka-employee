// Penanda merek Qaloka: huruf Q dari 11 modul + satu blok oranye sebagai ekor.
// Geometrinya DISALIN dari LogoMark situs qaloka.com (components/Icons.jsx), yang diukur dari
// berkas logo resmi — jangan digambar ulang "mirip". Kalau logonya berubah, salin ulang dari sana.
// Modulnya memakai currentColor supaya ikut warna ubinnya; ekornya tetap oranye merek.

const MODUL: [number, number, number, number, number][] = [
  [18.06, 0, 15.86, 16.01, 3.49],
  [36.3, 0, 15.85, 16.01, 3.33],
  [54.37, 0, 16.01, 16.01, 3.48],
  [0, 18.23, 15.85, 15.85, 3.33],
  [72.59, 18.23, 15.86, 15.85, 3.34],
  [0, 36.45, 15.85, 15.85, 3.33],
  [72.59, 36.45, 15.86, 15.85, 3.34],
  [0, 54.52, 15.85, 15.85, 3.33],
  [54.37, 54.52, 16.01, 15.85, 3.48],
  [18.06, 72.74, 15.86, 15.85, 3.49],
  [36.3, 72.74, 15.85, 15.85, 3.33],
];

export function QalokaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <g fill="currentColor">
        {MODUL.map(([x, y, w, h, r]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={r} />
        ))}
      </g>
      <rect x="72.59" y="72.74" width="27.27" height="27.26" rx="4.6" fill="#E2572B" />
    </svg>
  );
}

/** Nama produk yang tampil ke pengguna. Nama internal (proses PM2, database, kunci) TIDAK ikut. */
export const NAMA_PRODUK = "Qaloka Employee";

/** Ubin logo: modul putih di atas ubin merek, ekor oranye. */
export function UbinLogo({ besar = false }: { besar?: boolean }) {
  return (
    <span
      className={`grid ${besar ? "h-11 w-11" : "h-9 w-9"} shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-2 text-white shadow-lg shadow-primary/30`}
    >
      <QalokaMark className={besar ? "h-6 w-6" : "h-5 w-5"} />
    </span>
  );
}

/** "Qaloka Employee" — nama merek tebal, kata produknya berwarna primer. */
export function NamaMerek({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight text-fg ${className}`}>
      Qaloka <span className="text-primary">Employee</span>
    </span>
  );
}
