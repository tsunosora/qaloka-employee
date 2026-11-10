/**
 * DATA jadwal konten Voliko, November 2026 — disalin dari sheet pembina (tangkapan 10 Nov 2026).
 * Dipakai tools/magang/voliko-jadwal-konten.ts dan tests/magang-konten-impor.test.ts.
 * Nama asli anak HANYA boleh ada di berkas data ini (bukan di kode/tes).
 *
 * - 2–14 Nov  = persis sheet pembina (kode 1–4, GRUB A tgl 14), usulan=false.
 * - 16–28 Nov = USULAN dengan 3 anak baru (kode 5–7), usulan=true → tampil berlencana "Usulan" sampai
 *   pembina menekan "Tandai disetujui".
 * - Urutan grup (giliran PROMOTION/EMPATHY): A, B, C → sesudah GRUB B (28 Nov) berikutnya GRUB C (12 Des).
 */

export const MIGRASI_KONTEN = "20261112000000_magang_jadwal_konten";

/** kode = kolom CODE di sheet; pesertaId = MagangPeserta.id di DB Voliko; panggilan = Employee.nickname (dicek). */
export const ANAK_VOLIKO = [
  { kode: 1, pesertaId: 2, panggilan: "Yufita" },
  { kode: 2, pesertaId: 3, panggilan: "Alif" },
  { kode: 3, pesertaId: 4, panggilan: "Marisa" },
  { kode: 4, pesertaId: 1, panggilan: "Rizki" },
  { kode: 5, pesertaId: 5, panggilan: "Aqila" },
  { kode: 6, pesertaId: 6, panggilan: "Cerry" },
  { kode: 7, pesertaId: 7, panggilan: "Putra" },
] as const;

/** Grup konten (terpisah dari tim rotasi pos). anggota = kode anak. */
export const GRUP_VOLIKO = [
  { nama: "GRUB A", warna: "merah", urutan: 1, anggota: [1, 2] },
  { nama: "GRUB B", warna: "merah", urutan: 2, anggota: [3, 4] },
  { nama: "GRUB C", warna: "merah", urutan: 3, anggota: [5, 6, 7] },
] as const;

/** Ejaan "ENTERTAIMENT" mengikuti sheet pembina (data, bukan salah ketik kode). */
export const KONSEP_VOLIKO = [
  { kunci: "sitkom", nama: "ENTERTAIMENT", sub: "SITKOM", warna: "pink", urutan: 1, referensi: [{ label: "Contoh sitkom", url: "https://www.instagram.com/p/DaohSfOveLK/" }] },
  { kunci: "flexing", nama: "ENGAGEMENT", sub: "FLEXING", warna: "lavender", urutan: 2, referensi: [{ label: "Contoh flexing", url: "https://www.instagram.com/p/DaWieu1vdlh/" }] },
  { kunci: "talk", nama: "EDUCATION", sub: "TALK", warna: "putih", urutan: 3, referensi: [{ label: "Contoh talk", url: "https://www.instagram.com/p/Dd8HA6jjzL4/" }] },
  { kunci: "empathy", nama: "PROMOTION", sub: "EMPATHY", warna: "merah", urutan: 4, referensi: [{ label: "Contoh empathy", url: "https://www.instagram.com/p/DfWr1BqtY4G/" }] },
] as const;

/** Catatan & brief (panel kiri sheet). URL drive "1. VOLIKO PRINT" belum diketahui → kosong (diisi pembina). */
export const BRIEF_VOLIKO = {
  drive: [{ label: "1. VOLIKO PRINT", url: "" }],
  catatan: "Setiap jadwal konten absen di Xposer untuk brief konten",
  font: "Rubik / Rubik-Bold",
  preset: "Outline black",
  caption: [
    "Mulai dari Montage Banner, Stiker, DTF, Kaos, Akrilik, Laser Cutting, Brosur, hingga Merchandise.",
    "",
    "💬 Gratis Konsultasi",
    "⚡ Proses Cepat",
    "💰 Harga Terjangkau",
    "✨ Kualitas Premium",
    "🎨 Bisa Custom Sesuai Kebutuhan",
    "",
    "Butuh cetak untuk produk, promosi, branding, event, atau bisnis? Konsultasikan langsung dengan Voliko Print!",
    "",
    "Voliko Print — Bikin Produk Makin Berkelas, Bikin Brand Makin Berkesan!",
  ].join("\n"),
  hashtag:
    "#VolikoPrint #JasaPercetakan #JasaPrinting #JasaCetak #DigitalPrinting #Percetakan #JasaPrint #MontageBanner #CetakStiker #DTFPrinting #KaosCustom #AkrilikCustom #LaserCutting #CetakBrosur #MerchandiseCustom #CustomPrinting #CetakCustom #Branding #Promosi #PercetakanJogja #DigitalPrintingJogja #PrintJogja",
};

export type BarisVoliko = { tanggal: string; konsep: "sitkom" | "flexing" | "talk" | "empathy"; kode: number | null; grup: string | null; usulan: boolean };

const s = (tanggal: string, konsep: BarisVoliko["konsep"], kode: number, usulan: boolean): BarisVoliko => ({ tanggal, konsep, kode, grup: null, usulan });
const g = (tanggal: string, grup: string, usulan: boolean): BarisVoliko => ({ tanggal, konsep: "empathy", kode: null, grup, usulan });

export const BARIS_VOLIKO: readonly BarisVoliko[] = [
  // Sheet pembina (2–14 Nov)
  s("2026-11-02", "sitkom", 1, false),
  s("2026-11-03", "flexing", 2, false),
  s("2026-11-04", "sitkom", 3, false),
  s("2026-11-05", "flexing", 4, false),
  s("2026-11-06", "talk", 1, false),
  s("2026-11-07", "flexing", 2, false),
  s("2026-11-09", "sitkom", 3, false),
  s("2026-11-10", "flexing", 4, false),
  s("2026-11-11", "sitkom", 1, false),
  s("2026-11-12", "flexing", 2, false),
  s("2026-11-13", "talk", 3, false),
  g("2026-11-14", "GRUB A", false),
  // Usulan dengan 3 anak baru (16–28 Nov)
  s("2026-11-16", "sitkom", 4, true),
  s("2026-11-17", "flexing", 5, true),
  s("2026-11-18", "sitkom", 6, true),
  s("2026-11-19", "flexing", 7, true),
  s("2026-11-20", "talk", 1, true),
  s("2026-11-21", "flexing", 2, true),
  s("2026-11-23", "sitkom", 3, true),
  s("2026-11-24", "flexing", 4, true),
  s("2026-11-25", "sitkom", 5, true),
  s("2026-11-26", "flexing", 6, true),
  s("2026-11-27", "talk", 7, true),
  g("2026-11-28", "GRUB B", true),
];
