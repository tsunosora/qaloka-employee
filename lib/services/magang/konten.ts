/**
 * Jadwal konten magang (12 Nov 2026) — logika MURNI (tanpa DB), dipakai API, UI, skrip impor & tes.
 *
 * Meniru sheet pembina: baris Senin–Sabtu, pemisah kuning tiap hari Minggu, kolom KLASIFIKASI KONSEP
 * berwarna, CODE = kode anak (1..n) atau grup ("GRUB A"). Generator `susunBulan()` melanjutkan giliran
 * kode anak dan giliran grup PROMOTION (EMPATHY) tiap 14 hari dari bulan sebelumnya.
 */

import { kunciKategoriUnik } from "@/lib/services/magang/misi";

// ── Tanggal (YYYY-MM-DD, tanpa zona waktu) ─────────────────────────────────────────────────────

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] as const;

const POLA_YMD = /^\d{4}-\d{2}-\d{2}$/;
const POLA_BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;

function keHari(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
function dariHari(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}
export function tambahHariKonten(ymd: string, k: number): string {
  return dariHari(keHari(ymd) + k);
}
/** 0 = Minggu … 6 = Sabtu. */
export function hariKe(ymd: string): number {
  return (((keHari(ymd) + 4) % 7) + 7) % 7; // 1970-01-01 = Kamis
}
export function bulanSah(bulan: string): boolean {
  return POLA_BULAN.test(bulan);
}
export function tanggalSah(ymd: string): boolean {
  return POLA_YMD.test(ymd) && dariHari(keHari(ymd)) === ymd;
}
/** Semua tanggal dalam bulan "YYYY-MM". */
export function tanggalBulan(bulan: string): string[] {
  const [y, m] = bulan.split("-").map(Number);
  const jumlah = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: jumlah }, (_, i) => `${bulan}-${String(i + 1).padStart(2, "0")}`);
}
export function geserBulan(bulan: string, k: number): string {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** "2026-11-02" → "Senin, 02 November 2026" (format kolom TANGGAL di sheet). */
export function namaTanggal(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${HARI[hariKe(ymd)]}, ${String(d).padStart(2, "0")} ${BULAN[m - 1]} ${y}`;
}
/** "2026-11" → "November 2026". */
export function namaBulan(bulan: string): string {
  const [y, m] = bulan.split("-").map(Number);
  return `${BULAN[m - 1]} ${y}`;
}

// ── Label & warna ─────────────────────────────────────────────────────────────────────────────

/** {nama:"ENTERTAIMENT", sub:"SITKOM"} → "ENTERTAIMENT (SITKOM)". */
export function labelKonsep(k: { nama: string; sub?: string | null }): string {
  const sub = k.sub?.trim();
  return sub ? `${k.nama.trim()} (${sub})` : k.nama.trim();
}

/**
 * Palet warna sel (kunci disimpan di DB). hex = warna sheet; null = tanpa warna (putih). Di layar warna
 * dicampur transparan dengan latar (lihat UI) supaya terbaca di tema terang & gelap — dan SELALU disertai
 * teks (nama konsep/status), tidak bergantung pada warna saja.
 */
export const WARNA_KONTEN = {
  putih: { label: "Tanpa warna", hex: null },
  pink: { label: "Merah muda", hex: "#e8a5c0" },
  lavender: { label: "Ungu muda", hex: "#b4a7d6" },
  merah: { label: "Merah", hex: "#ef4444" },
  kuning: { label: "Kuning", hex: "#facc15" },
  hijau: { label: "Hijau", hex: "#22c55e" },
  biru: { label: "Biru", hex: "#3b82f6" },
  oranye: { label: "Oranye", hex: "#f97316" },
  abu: { label: "Abu-abu", hex: "#a1a1aa" },
} as const satisfies Record<string, { label: string; hex: string | null }>;
export type KunciWarna = keyof typeof WARNA_KONTEN;
export const KUNCI_WARNA = Object.keys(WARNA_KONTEN) as KunciWarna[];
const POLA_HEX = /^#[0-9a-fA-F]{6}$/;

export function warnaSah(w: string): boolean {
  return w in WARNA_KONTEN || POLA_HEX.test(w);
}
/** Kunci palet / #rrggbb → hex; "putih" / tak dikenal → null (tanpa warna). */
export function hexWarna(w: string | null | undefined): string | null {
  if (!w) return null;
  if (POLA_HEX.test(w)) return w.toLowerCase();
  return (WARNA_KONTEN as Record<string, { hex: string | null }>)[w]?.hex ?? null;
}
/**
 * Warna sel CODE seperti di sheet: baris grup → warna grup (EMPATHY merah); baris anak dengan konsep
 * tanpa warna (EDUCATION/TALK) → kuning supaya hari TALK menonjol; selain itu tanpa warna.
 */
export function warnaSelKode(konsepWarna: string | null | undefined, grupWarna: string | null | undefined): string | null {
  if (grupWarna !== undefined && grupWarna !== null) return hexWarna(grupWarna);
  return hexWarna(konsepWarna) === null ? WARNA_KONTEN.kuning.hex : null;
}

// ── Tautan ────────────────────────────────────────────────────────────────────────────────────

export const MAKS_TAUTAN = 500;

/** Hanya http(s) yang boleh (javascript:, data:, ftp: dsb. ditolak). */
export function tautanSah(url: string | null | undefined): boolean {
  if (!url) return false;
  const s = url.trim();
  if (!s || s.length > MAKS_TAUTAN || /\s/.test(s)) return false;
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}
/** "https://www.instagram.com/p/DaohSfOveLK/" → "instagram.com/p/DaohSfOveLK" (label chip ringkas). */
export function tautanPendek(url: string, maks = 28): string {
  let s = url.trim();
  try {
    const u = new URL(s);
    s = `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    /* biarkan apa adanya */
  }
  return s.length > maks ? `${s.slice(0, maks - 1)}…` : s;
}

// ── Kode & grup ───────────────────────────────────────────────────────────────────────────────

export type AnakKonten = { pesertaId: number; kode: number | null; panggilan: string };
export type GrupKonten = { id: number; nama: string; anggota: number[] };

/** Kolom CODE: "1" / "GRUB A" / "" (belum dibagi). */
export function kodeTampil(b: { pesertaId: number | null; grupId: number | null }, anak: readonly AnakKonten[], grup: readonly GrupKonten[]): string {
  if (b.grupId != null) return grup.find((g) => g.id === b.grupId)?.nama ?? "(grup dihapus)";
  if (b.pesertaId != null) {
    const a = anak.find((x) => x.pesertaId === b.pesertaId);
    return a?.kode != null ? String(a.kode) : a ? "–" : "";
  }
  return "";
}
/** Kolom NAMA PKL: panggilan anak, atau panggilan semua anggota grup. */
export function namaPkl(b: { pesertaId: number | null; grupId: number | null }, anak: readonly AnakKonten[], grup: readonly GrupKonten[]): string {
  const nama = (id: number) => anak.find((a) => a.pesertaId === id)?.panggilan ?? "";
  if (b.grupId != null) return (grup.find((g) => g.id === b.grupId)?.anggota ?? []).map(nama).filter(Boolean).join(", ");
  if (b.pesertaId != null) return nama(b.pesertaId);
  return "";
}

// ── Susunan per minggu (pemisah kuning tiap Minggu) ───────────────────────────────────────────

export type ItemPekan<T> =
  | { jenis: "minggu"; tanggal: string; baris: T[] }
  | { jenis: "hari"; tanggal: string; baris: T[]; libur: string | null };

/**
 * Semua tanggal bulan itu berurutan: hari Minggu → pemisah (baris Minggu, bila ada, ikut di dalamnya),
 * Senin–Sabtu → hari (boleh kosong; libur diberi nama). Baris tiap tanggal diurut `urutan` lalu `id`.
 */
export function susunPekan<T extends { tanggal: string; urutan?: number; id?: number }>(
  bulan: string,
  baris: readonly T[],
  libur: ReadonlyMap<string, string> = new Map()
): ItemPekan<T>[] {
  const per = new Map<string, T[]>();
  for (const b of baris) {
    const l = per.get(b.tanggal) ?? [];
    l.push(b);
    per.set(b.tanggal, l);
  }
  for (const l of per.values()) l.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || (a.id ?? 0) - (b.id ?? 0));
  return tanggalBulan(bulan).map((t) =>
    hariKe(t) === 0 ? { jenis: "minggu", tanggal: t, baris: per.get(t) ?? [] } : { jenis: "hari", tanggal: t, baris: per.get(t) ?? [], libur: libur.get(t) ?? null }
  );
}

// ── Pola & generator ──────────────────────────────────────────────────────────────────────────

/** Hari 1 (Senin) … 6 (Sabtu) → kunci konsep. */
export type PolaHari = Partial<Record<1 | 2 | 3 | 4 | 5 | 6, string>>;
export type PolaKonten = { hari: PolaHari; empathy: string | null; selangHari: number };

/** Pola sheet pembina: Sen SITKOM, Sel FLEXING, Rab SITKOM, Kam FLEXING, Jum TALK, Sab FLEXING; EMPATHY tiap 14 hari. */
export const POLA_BAWAAN: PolaKonten = {
  hari: { 1: "sitkom", 2: "flexing", 3: "sitkom", 4: "flexing", 5: "talk", 6: "flexing" },
  empathy: "empathy",
  selangHari: 14,
};
export const KUNCI_POLA = "magang_konten_pola";
export const KUNCI_BRIEF = "magang_konten_brief";

/** Konsep contoh untuk instalasi baru (tombol "Pakai konsep contoh"); kunci cocok dengan POLA_BAWAAN. */
export const KONSEP_CONTOH = [
  { kunci: "sitkom", nama: "ENTERTAINMENT", sub: "SITKOM", warna: "pink", urutan: 1 },
  { kunci: "flexing", nama: "ENGAGEMENT", sub: "FLEXING", warna: "lavender", urutan: 2 },
  { kunci: "talk", nama: "EDUCATION", sub: "TALK", warna: "putih", urutan: 3 },
  { kunci: "empathy", nama: "PROMOTION", sub: "EMPATHY", warna: "merah", urutan: 4 },
] as const;

/** Kunci konsep baru dari sub (atau nama) — slug yang tidak berubah saat konsep diganti nama. */
export function kunciKonsepUnik(k: { nama: string; sub?: string | null }, terpakai: Iterable<string>): string {
  return kunciKategoriUnik(k.sub?.trim() || k.nama, terpakai);
}

export type UsulanBaris = { tanggal: string; konsep: string; kode: number | null; grupId: number | null };
/** Baris yang SUDAH ada di bulan itu (mode isi tanggal kosong): dipakai untuk melanjutkan giliran. */
export type BarisAda = { kode: number | null; grupId: number | null; empathy: boolean };

export type InputSusun = {
  bulan: string;
  /** Kode anak aktif (akan diurutkan). Kosong → baris tanpa anak (belum dibagi). */
  kode: readonly number[];
  /** Id grup aktif dalam urutan giliran EMPATHY. */
  grupUrut: readonly number[];
  polaHari: PolaHari;
  empathyKonsep: string | null;
  selangEmpathy?: number;
  /** Kode anak terakhir yang dipakai sebelum bulan ini (null = mulai dari kode terkecil). */
  mulaiKodeSetelah: number | null;
  /** EMPATHY terakhir sebelum bulan ini; null = EMPATHY pertama di Sabtu KEDUA bulan ini, grup pertama. */
  empathyTerakhir: { tanggal: string; grupId: number | null } | null;
  libur: ReadonlySet<string>;
  /** Tanggal yang sudah punya baris → tidak dibuat ulang, tapi gilirannya ikut dihitung. */
  ada?: ReadonlyMap<string, readonly BarisAda[]>;
};
export type HasilSusun = { baris: UsulanBaris[]; dilewati: { tanggal: string; alasan: "libur" | "sudah-ada" | "tanpa-pola" }[] };

/**
 * Susun usulan jadwal satu bulan (Senin–Sabtu; Minggu & libur dilewati):
 * - Hari biasa: konsep = polaHari[hari], kode anak = giliran berikutnya (melanjutkan bulan lalu, berputar).
 * - Sabtu yang jatuh ≥ (EMPATHY terakhir + selang) dan ada grup: konsep EMPATHY untuk grup berikutnya —
 *   hari grup TIDAK memakan giliran anak. Sabtu libur → EMPATHY pindah ke Sabtu berikutnya.
 * - Tanggal yang sudah punya baris (`ada`) dilewati, tapi kode/grupnya memajukan giliran.
 */
export function susunBulan(input: InputSusun): HasilSusun {
  const selang = input.selangEmpathy ?? 14;
  const kode = [...new Set(input.kode)].sort((a, b) => a - b);
  const grup = [...input.grupUrut];
  const tanggal = tanggalBulan(input.bulan);
  const pakaiEmpathy = !!input.empathyKonsep && grup.length > 0;

  let kodeTerakhir = input.mulaiKodeSetelah;
  let grupTerakhir: number | null = input.empathyTerakhir?.grupId ?? null;
  let jatuh: string;
  if (input.empathyTerakhir) {
    jatuh = tambahHariKonten(input.empathyTerakhir.tanggal, selang);
    // Bulan-bulan tanpa jadwal di antaranya: jaga irama 14 hari, mulai dari bulan ini.
    while (jatuh < tanggal[0]) jatuh = tambahHariKonten(jatuh, selang);
  } else {
    jatuh = tanggal.filter((t) => hariKe(t) === 6)[1] ?? tanggal[tanggal.length - 1];
  }

  const kodeBerikut = (): number | null => {
    if (kode.length === 0) return null;
    const k = kodeTerakhir == null ? kode[0] : (kode.find((x) => x > kodeTerakhir!) ?? kode[0]);
    kodeTerakhir = k;
    return k;
  };
  const grupBerikut = (): number => {
    const i = grupTerakhir == null ? -1 : grup.indexOf(grupTerakhir);
    const g = grup[(i + 1) % grup.length];
    grupTerakhir = g;
    return g;
  };

  const hasil: HasilSusun = { baris: [], dilewati: [] };
  for (const t of tanggal) {
    const h = hariKe(t);
    if (h === 0) continue;
    const ada = input.ada?.get(t);
    if (ada && ada.length > 0) {
      for (const b of ada) {
        if (b.empathy) {
          if (b.grupId != null) grupTerakhir = b.grupId;
          jatuh = tambahHariKonten(t, selang);
        }
        if (b.kode != null) kodeTerakhir = b.kode;
      }
      hasil.dilewati.push({ tanggal: t, alasan: "sudah-ada" });
      continue;
    }
    if (input.libur.has(t)) {
      hasil.dilewati.push({ tanggal: t, alasan: "libur" });
      continue;
    }
    if (pakaiEmpathy && h === 6 && t >= jatuh) {
      hasil.baris.push({ tanggal: t, konsep: input.empathyKonsep!, kode: null, grupId: grupBerikut() });
      jatuh = tambahHariKonten(t, selang);
      continue;
    }
    const konsep = input.polaHari[h as 1 | 2 | 3 | 4 | 5 | 6];
    if (!konsep) {
      hasil.dilewati.push({ tanggal: t, alasan: "tanpa-pola" });
      continue;
    }
    hasil.baris.push({ tanggal: t, konsep, kode: kodeBerikut(), grupId: null });
  }
  return hasil;
}

// ── Penggantian & izin anak ───────────────────────────────────────────────────────────────────

type IsiBaris = {
  judul?: string | null;
  ref?: string | null;
  caption?: string | null;
  linkFootage?: string | null;
  linkEkspor?: string | null;
  catatan?: string | null;
  statusId: number;
  selesaiAt?: Date | string | null;
};
/**
 * "Ganti" saat membuat ulang jadwal hanya boleh menghapus baris yang BELUM dikerjakan: status masih
 * status awal, belum selesai, dan semua isian kosong. Baris lain dipertahankan (giliran ikut dihitung).
 */
export function bolehDiganti(b: IsiBaris, statusAwalId: number): boolean {
  const kosong = (s: string | null | undefined) => !s || !s.trim();
  return (
    b.statusId === statusAwalId &&
    !b.selesaiAt &&
    kosong(b.judul) &&
    kosong(b.ref) &&
    kosong(b.caption) &&
    kosong(b.linkFootage) &&
    kosong(b.linkEkspor) &&
    kosong(b.catatan)
  );
}

/** Baris milik anak: kodenya sendiri, atau grup yang dia ikuti. */
export function milikAnak(b: { pesertaId: number | null; grupId: number | null }, anak: { pesertaId: number; grupIds: readonly number[] }): boolean {
  if (b.pesertaId != null) return b.pesertaId === anak.pesertaId;
  if (b.grupId != null) return anak.grupIds.includes(b.grupId);
  return false;
}

export type StatusIzin = { id: number; aktif: boolean; anakBoleh: boolean; final: boolean };
/**
 * Boleh-tidaknya anak mengubah satu baris (dan memasang statusBaru bila diisi). null = boleh;
 * selain itu pesan untuk anak. Baris final terkunci; status final / bukan anakBoleh hanya pembina.
 */
export function cekUbahAnak(statusLama: Pick<StatusIzin, "final">, statusBaru?: StatusIzin | null): string | null {
  if (statusLama.final) return "Konten ini sudah divalidasi pembina, tidak bisa diubah lagi.";
  if (statusBaru) {
    if (statusBaru.final) return "Status ini hanya bisa dipasang pembina.";
    if (!statusBaru.anakBoleh || !statusBaru.aktif) return "Status ini tidak bisa kamu pilih.";
  }
  return null;
}

/** selesaiAt sesudah status berubah: final → diisi (tetap tanggal lama bila sudah final); bukan final → kosong. */
export function selesaiAtBaru(final: boolean, lama: Date | null, sekarang: Date = new Date()): Date | null {
  if (!final) return null;
  return lama ?? sekarang;
}

// ── Sunting sebagian (PATCH) ───────────────────────────────────────────────────────────────────

/** Salinan objek tanpa kunci bernilai undefined — supaya hanya kolom yang DIKIRIM yang ditulis. */
export function tanpaUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export type UbahKontenMasuk = {
  konsepId?: number;
  pesertaId?: number | null;
  grupId?: number | null;
  statusId?: number;
  judul?: string | null;
  ref?: string | null;
  caption?: string | null;
  linkFootage?: string | null;
  linkEkspor?: string | null;
  catatan?: string | null;
  usulan?: boolean;
  urutan?: number;
};

/**
 * Data update Prisma untuk PATCH pembina (tanpa tanggal & diubahOleh — diisi route). Hanya kolom yang dikirim;
 * memilih anak mengosongkan grup dan sebaliknya (hanya bila salah satunya dikirim terisi); `status` (hasil
 * periksaRujukan, hanya ada bila statusId dikirim) → selesaiAt.
 */
export function dataUbahKonten(
  d: UbahKontenMasuk,
  status: { final: boolean } | null,
  selesaiAtLama: Date | null,
  sekarang: Date = new Date()
): Record<string, unknown> {
  const data: Record<string, unknown> = tanpaUndefined(d);
  if (d.pesertaId) data.grupId = null;
  if (d.grupId) data.pesertaId = null;
  if (status) data.selesaiAt = selesaiAtBaru(status.final, selesaiAtLama, sekarang);
  return data;
}
