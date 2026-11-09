/**
 * Side quest magang (keputusan owner 9 Nov 2026): misi WAJIB di luar rotasi pos — Customer Service,
 * Desain Grafis, Digital Marketing — yang diselesaikan anak sepanjang magang. Tugas UTAMA (rotasi,
 * waktu terbanyak) = Konten & Produksi; side quest dikerjakan di sela-selanya.
 *
 * Misi aktif berlaku untuk SEMUA peserta (tanpa baris penugasan) → peserta baru otomatis mendapat
 * semua misi. Anak mengirim bukti (foto/tautan/teks) dari HP; pembimbing menyetujui/menolak + catatan.
 * Aturan di sini MURNI (tanpa DB) supaya bisa diuji — tests/magang-misi.test.ts.
 */

export const KATEGORI_MISI = [
  { key: "cs", label: "Customer Service", prioritas: "Menengah", ringkas: "Penjualan, komunikasi efektif, solutif & persuasif" },
  { key: "desain", label: "Desain Grafis", prioritas: "Menengah", ringkas: "Canva, CorelDraw, pola & pattern jersey" },
  { key: "marketing", label: "Digital Marketing", prioritas: "Rendah", ringkas: "Remarketing, Meta Ads, Shopee Ads" },
] as const;
export type KategoriMisi = (typeof KATEGORI_MISI)[number]["key"];
export const KUNCI_KATEGORI = KATEGORI_MISI.map((k) => k.key) as [KategoriMisi, ...KategoriMisi[]];

export const LEVEL_MISI = [
  { key: "dasar", label: "Dasar" },
  { key: "menengah", label: "Menengah" },
  { key: "lanjut", label: "Lanjut" },
] as const;
export type LevelMisi = (typeof LEVEL_MISI)[number]["key"];
export const KUNCI_LEVEL = LEVEL_MISI.map((k) => k.key) as [LevelMisi, ...LevelMisi[]];

export const JENIS_BUKTI = [
  { key: "foto", label: "Foto" },
  { key: "tautan", label: "Tautan" },
  { key: "teks", label: "Tulisan" },
] as const;
export type JenisBukti = (typeof JENIS_BUKTI)[number]["key"];
export const KUNCI_BUKTI = JENIS_BUKTI.map((k) => k.key) as [JenisBukti, ...JenisBukti[]];

export const STATUS_KIRIMAN = ["menunggu", "disetujui", "ditolak"] as const;
export type StatusKiriman = (typeof STATUS_KIRIMAN)[number];

export const MAKS_FOTO_MISI = 3;
export const MIN_TEKS_MISI = 20;
export const MAKS_TEKS_MISI = 4000;

export function labelKategori(k: string): string {
  return KATEGORI_MISI.find((x) => x.key === k)?.label ?? k;
}
export function labelLevel(k: string): string {
  return LEVEL_MISI.find((x) => x.key === k)?.label ?? k;
}

/** "foto,teks" → ["foto","teks"] (urut, tanpa ganda, hanya jenis yang dikenal). Kosong → ["foto"]. */
export function uraiBukti(s: string | null | undefined): JenisBukti[] {
  const ada = new Set((s ?? "").split(",").map((x) => x.trim()));
  const hasil = KUNCI_BUKTI.filter((k) => ada.has(k));
  return hasil.length ? hasil : ["foto"];
}

export function gabungBukti(xs: readonly string[]): string {
  return uraiBukti(xs.join(",")).join(",");
}

/** Tautan bukti harus http(s) — mencegah `javascript:` tampil sebagai tautan di dasbor. */
export function tautanSah(s: string | null | undefined): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Bukti yang diminta misi harus ada SEMUA. Kembalikan pesan kesalahan (bahasa anak) atau null.
 * jumlahFoto = foto lama yang dipertahankan + foto baru.
 */
export function periksaBukti(
  diminta: readonly JenisBukti[],
  isi: { teks: string | null; tautan: string | null; jumlahFoto: number }
): string | null {
  if (diminta.includes("foto") && isi.jumlahFoto < 1) return "Lampirkan minimal 1 foto hasil kerjamu.";
  if (isi.jumlahFoto > MAKS_FOTO_MISI) return `Foto maksimal ${MAKS_FOTO_MISI}.`;
  if (diminta.includes("tautan") && !isi.tautan) return "Tempelkan tautan hasil kerjamu (mis. tautan Instagram atau Google Drive).";
  if (isi.tautan && !tautanSah(isi.tautan)) return "Tautan harus diawali https://";
  const teks = (isi.teks ?? "").trim();
  if (diminta.includes("teks") && teks.length < MIN_TEKS_MISI) return `Ceritakan lebih lengkap — minimal ${MIN_TEKS_MISI} huruf.`;
  return null;
}

/** Anak boleh mengirim/menyunting bukti selama BELUM disetujui. */
export function bolehKirimMisi(status: string | null | undefined): boolean {
  return status !== "disetujui";
}

type MisiRingkas = { id: number; kategori: string; poin: number };
type KirimanRingkas = { misiId: number; status: string };

export type ProgresKategori = {
  kategori: string;
  label: string;
  prioritas: string;
  selesai: number;
  menunggu: number;
  ditolak: number;
  total: number;
  poin: number;
  poinMaks: number;
};

/**
 * Progres side quest satu anak: per kategori x/y misi disetujui + poin. Hanya misi AKTIF (yang
 * diberikan) yang dihitung — kiriman untuk misi yang sudah dinonaktifkan tidak menambah x maupun y.
 */
export function progresMisi(misi: readonly MisiRingkas[], kiriman: readonly KirimanRingkas[]) {
  const status = new Map(kiriman.map((k) => [k.misiId, k.status]));
  const kategori: ProgresKategori[] = KATEGORI_MISI.map((k) => {
    const milik = misi.filter((m) => m.kategori === k.key);
    const st = (s: string) => milik.filter((m) => status.get(m.id) === s);
    const selesai = st("disetujui");
    return {
      kategori: k.key,
      label: k.label,
      prioritas: k.prioritas,
      selesai: selesai.length,
      menunggu: st("menunggu").length,
      ditolak: st("ditolak").length,
      total: milik.length,
      poin: selesai.reduce((s, m) => s + m.poin, 0),
      poinMaks: milik.reduce((s, m) => s + m.poin, 0),
    };
  });
  // Misi berkategori lain (data lama/manual) tetap dihitung di total supaya tidak hilang diam-diam.
  const lain = misi.filter((m) => !KUNCI_KATEGORI.includes(m.kategori as KategoriMisi));
  if (lain.length) {
    const selesai = lain.filter((m) => status.get(m.id) === "disetujui");
    kategori.push({
      kategori: "lain",
      label: "Lainnya",
      prioritas: "—",
      selesai: selesai.length,
      menunggu: lain.filter((m) => status.get(m.id) === "menunggu").length,
      ditolak: lain.filter((m) => status.get(m.id) === "ditolak").length,
      total: lain.length,
      poin: selesai.reduce((s, m) => s + m.poin, 0),
      poinMaks: lain.reduce((s, m) => s + m.poin, 0),
    });
  }
  const jumlah = (f: keyof Pick<ProgresKategori, "selesai" | "menunggu" | "total" | "poin" | "poinMaks">) =>
    kategori.reduce((s, k) => s + k[f], 0);
  return {
    kategori: kategori.filter((k) => k.total > 0),
    selesai: jumlah("selesai"),
    menunggu: jumlah("menunggu"),
    total: jumlah("total"),
    poin: jumlah("poin"),
    poinMaks: jumlah("poinMaks"),
  };
}

export type ProgresMisi = ReturnType<typeof progresMisi>;
