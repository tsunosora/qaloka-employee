/**
 * Side quest magang (keputusan owner 9 Nov 2026): misi WAJIB di luar rotasi pos — mis. Customer Service,
 * Desain Grafis, Digital Marketing — yang diselesaikan anak sepanjang magang. Tugas UTAMA (rotasi,
 * waktu terbanyak) = Konten & Produksi; side quest dikerjakan di sela-selanya.
 *
 * Misi aktif berlaku untuk SEMUA peserta (tanpa baris penugasan) → peserta baru otomatis mendapat
 * semua misi. Anak mengirim bukti (foto/tautan/teks) dari HP; pembimbing menyetujui/menolak + catatan.
 * Sejak 10 Nov 2026 KATEGORI dikelola admin (tabel MagangMisiKategori); di sini hanya aturan MURNI
 * (tanpa DB) supaya bisa diuji — tests/magang-misi.test.ts, tests/magang-misi-kategori.test.ts.
 */

/**
 * Kategori bawaan — HANYA isi awal: dipakai migrasi 20261110000000_magang_misi_kategori (nilai yang sama)
 * dan tombol "Pakai bank misi awal" (dipastikan ada sebelum misi contoh dimasukkan). Setelah itu admin
 * bebas mengganti nama/urutan/menonaktifkan; kode lain membaca kategori dari DB.
 */
export const KATEGORI_AWAL = [
  { kunci: "cs", nama: "Customer Service", prioritas: "Menengah", ringkas: "Penjualan, komunikasi efektif, solutif & persuasif", urutan: 1 },
  { kunci: "desain", nama: "Desain Grafis", prioritas: "Menengah", ringkas: "Canva, CorelDraw, pola & pattern jersey", urutan: 2 },
  { kunci: "marketing", nama: "Digital Marketing", prioritas: "Rendah", ringkas: "Remarketing, Meta Ads, Shopee Ads", urutan: 3 },
] as const;
export type KunciKategoriAwal = (typeof KATEGORI_AWAL)[number]["kunci"];

/** Satu kategori side quest seperti tersimpan di DB (bentuk yang dikirim ke klien juga). */
export type KategoriMisi = {
  kunci: string;
  nama: string;
  ringkas: string | null;
  prioritas: string | null;
  urutan: number;
  aktif: boolean;
};

/** Peta kunci → kategori, untuk label cepat. */
export type PetaKategori = ReadonlyMap<string, Pick<KategoriMisi, "nama" | "aktif">>;

export function petaKategori(daftar: readonly Pick<KategoriMisi, "kunci" | "nama" | "aktif">[]): PetaKategori {
  return new Map(daftar.map((k) => [k.kunci, { nama: k.nama, aktif: k.aktif }]));
}

export const MAKS_KUNCI_KATEGORI = 40;
export const MAKS_NAMA_KATEGORI = 80;
/** Bentuk kunci yang sah: huruf kecil/angka dipisah "-" (mis. "cs", "desain-grafis", "kategori-2"). */
export const POLA_KUNCI_KATEGORI = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Desain Grafis & Video!" → "desain-grafis-video". Kosong (mis. hanya simbol) → "kategori". */
export function slugKategori(nama: string, maks = MAKS_KUNCI_KATEGORI): string {
  const s = nama
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maks)
    .replace(/-+$/g, "");
  return s || "kategori";
}

/**
 * Kunci baru yang belum terpakai: slug nama, lalu "-2", "-3", … (dipotong supaya tetap ≤ 40 huruf).
 * Perbandingan tanpa beda huruf besar/kecil — kolomnya ber-collation _ci di MySQL.
 */
export function kunciKategoriUnik(nama: string, terpakai: Iterable<string>): string {
  const ada = new Set([...terpakai].map((k) => k.toLowerCase()));
  const dasar = slugKategori(nama);
  if (!ada.has(dasar)) return dasar;
  for (let i = 2; ; i++) {
    const akhiran = `-${i}`;
    const calon = `${slugKategori(nama, MAKS_KUNCI_KATEGORI - akhiran.length)}${akhiran}`;
    if (!ada.has(calon)) return calon;
  }
}

/**
 * Kategori boleh dipakai misi baru/yang diubah? Kembalikan pesan kesalahan (untuk admin) atau null.
 * Misi lama yang SUDAH berada di kategori nonaktif boleh tetap disimpan di kategori itu (tidak dipaksa pindah).
 */
export function periksaKategoriMisi(
  kunci: string,
  daftar: readonly Pick<KategoriMisi, "kunci" | "nama" | "aktif">[],
  kategoriLama?: string | null
): string | null {
  const k = daftar.find((x) => x.kunci === kunci);
  if (!k) return "Kategori tidak ditemukan. Muat ulang halaman lalu pilih kategori lagi.";
  if (!k.aktif && kategoriLama !== kunci) return `Kategori "${k.nama}" sedang nonaktif. Aktifkan dulu atau pilih kategori lain.`;
  return null;
}

/** Kategori hanya bisa dihapus bila tidak dirujuk misi mana pun (termasuk misi yang sudah dihapus). */
export function bolehHapusKategori(dipakai: number): boolean {
  return dipakai === 0;
}

/** Pindahkan semua misi dari kategori asal ke tujuan: kesalahan (untuk admin) atau null. */
export function periksaPindahKategori(
  asal: Pick<KategoriMisi, "kunci">,
  tujuan: Pick<KategoriMisi, "kunci" | "nama" | "aktif"> | null | undefined
): string | null {
  if (!tujuan) return "Kategori tujuan tidak ditemukan.";
  if (tujuan.kunci === asal.kunci) return "Pilih kategori tujuan yang berbeda.";
  if (!tujuan.aktif) return `Kategori "${tujuan.nama}" nonaktif — pilih kategori yang aktif.`;
  return null;
}

/** Urutan kategori: urutan lalu nama. */
export function urutkanKategori<T extends Pick<KategoriMisi, "urutan" | "nama">>(daftar: readonly T[]): T[] {
  return [...daftar].sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama, "id"));
}

/**
 * Label pendek untuk chip (Minggu Ini, dsb.): nama apa adanya bila muat, kalau tidak dipotong di batas
 * kata + "…". Tampilkan nama lengkap di atribut title.
 */
export function labelSingkatKategori(nama: string, maks = 18): string {
  const n = nama.trim().replace(/\s+/g, " ");
  if (n.length <= maks) return n;
  const potong = n.slice(0, maks - 1);
  const spasi = potong.lastIndexOf(" ");
  return `${(spasi >= 3 ? potong.slice(0, spasi) : potong).replace(/[\s&,/-]+$/, "")}…`;
}

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

/** Nama kategori dari peta DB; kunci tak dikenal tampil apa adanya. */
export function labelKategori(k: string, peta: PetaKategori): string {
  return peta.get(k)?.nama ?? k;
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
 *
 * kategori = daftar dari DB; hasil diurutkan menurut `urutan` kategori. Kategori NONAKTIF diperlakukan
 * sama dengan misi nonaktif: misinya tidak dihitung sama sekali (tidak muncul, tidak menambah total).
 * Misi berkunci yang TIDAK ada di daftar (seharusnya mustahil karena FOREIGN KEY) masuk "Lainnya"
 * supaya tidak hilang diam-diam.
 */
export function progresMisi(
  misi: readonly MisiRingkas[],
  kiriman: readonly KirimanRingkas[],
  kategori: readonly Pick<KategoriMisi, "kunci" | "nama" | "prioritas" | "urutan" | "aktif">[]
) {
  const status = new Map(kiriman.map((k) => [k.misiId, k.status]));
  const dikenal = new Set(kategori.map((k) => k.kunci));
  const hitung = (kunci: string, label: string, prioritas: string, milik: readonly MisiRingkas[]): ProgresKategori => {
    const st = (s: string) => milik.filter((m) => status.get(m.id) === s);
    const selesai = st("disetujui");
    return {
      kategori: kunci,
      label,
      prioritas,
      selesai: selesai.length,
      menunggu: st("menunggu").length,
      ditolak: st("ditolak").length,
      total: milik.length,
      poin: selesai.reduce((s, m) => s + m.poin, 0),
      poinMaks: milik.reduce((s, m) => s + m.poin, 0),
    };
  };
  const hasil: ProgresKategori[] = urutkanKategori(kategori.filter((k) => k.aktif)).map((k) =>
    hitung(k.kunci, k.nama, k.prioritas || "—", misi.filter((m) => m.kategori === k.kunci))
  );
  const lain = misi.filter((m) => !dikenal.has(m.kategori));
  if (lain.length) hasil.push(hitung("lain", "Lainnya", "—", lain));
  const jumlah = (f: keyof Pick<ProgresKategori, "selesai" | "menunggu" | "total" | "poin" | "poinMaks">) =>
    hasil.reduce((s, k) => s + k[f], 0);
  return {
    kategori: hasil.filter((k) => k.total > 0),
    selesai: jumlah("selesai"),
    menunggu: jumlah("menunggu"),
    total: jumlah("total"),
    poin: jumlah("poin"),
    poinMaks: jumlah("poinMaks"),
  };
}

export type ProgresMisi = ReturnType<typeof progresMisi>;
