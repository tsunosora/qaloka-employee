/**
 * Bank side quest awal untuk tombol "Pakai bank misi awal" (hanya bila belum ada misi). Disusun dari
 * dokumen Materi Internship (9 Nov 2026): Customer Service & Desain Grafis = prioritas menengah,
 * Digital Marketing = prioritas rendah. Bahasa sederhana untuk anak SMK; TIDAK memuat harga atau
 * kebijakan usaha tertentu — semuanya bisa disunting di Magang → Side Quest.
 *
 * Privasi: bukti tidak boleh memuat nomor/wajah/data pelanggan → pakai inisial atau minta izin.
 */
import type { JenisBukti, KunciKategoriAwal, LevelMisi } from "./misi";

export type MisiContoh = {
  kategori: KunciKategoriAwal;
  level: LevelMisi;
  judul: string;
  deskripsi: string;
  bukti: JenisBukti[];
  poin: number;
};

export const CONTOH_MISI: readonly MisiContoh[] = [
  // ── Customer Service (menengah): penjualan, komunikasi efektif, solutif & persuasif ──────────────
  {
    kategori: "cs",
    level: "dasar",
    judul: "Kenali 5 produk",
    deskripsi:
      "Pilih 5 produk yang dijual. Untuk tiap produk tulis: namanya, bahannya, kegunaannya, dan untuk siapa cocok. Pakai bahasa yang mudah dipahami pelanggan. Tanya pembimbing kalau ada yang belum tahu — jangan menebak.",
    bukti: ["teks"],
    poin: 10,
  },
  {
    kategori: "cs",
    level: "dasar",
    judul: "Latihan membalas chat pelanggan",
    deskripsi:
      "Bersama pembimbing, praktikkan membalas chat: salam → tanya kebutuhan → beri pilihan → rangkum pesanan → ucapkan terima kasih. Kirim tulisan percakapannya (boleh hasil main peran). Jangan sertakan nomor atau nama asli pelanggan.",
    bukti: ["teks"],
    poin: 10,
  },
  {
    kategori: "cs",
    level: "dasar",
    judul: "Update story WhatsApp 3 kali",
    deskripsi:
      "Buat 3 story WhatsApp usaha dari foto/video produk jadi (minta izin pembimbing sebelum diunggah). Tiap story beri tulisan singkat yang jelas. Kirim tangkapan layar ketiga story.",
    bukti: ["foto"],
    poin: 10,
  },
  {
    kategori: "cs",
    level: "dasar",
    judul: "Packing 3 pesanan dengan rapi",
    deskripsi:
      "Kemas 3 pesanan yang akan dikirim: cek isi sesuai pesanan, lindungi produk, tutup rapi, label terbaca. Foto tiap paket SEBELUM ditutup dan sesudah dilabel (tutupi alamat/nomor pelanggan).",
    bukti: ["foto"],
    poin: 10,
  },
  {
    kategori: "cs",
    level: "menengah",
    judul: "Follow up 3 pelanggan",
    deskripsi:
      "Didampingi pembimbing, tindak lanjuti 3 pelanggan yang komunikasinya belum selesai. Catat untuk masing-masing: inisial pelanggan, apa yang ditanyakan, apa yang kamu sampaikan, dan hasilnya.",
    bukti: ["teks"],
    poin: 15,
  },
  {
    kategori: "cs",
    level: "menengah",
    judul: "Menangani komplain",
    deskripsi:
      "Main peran dengan pembimbing: pelanggan komplain. Praktikkan: dengarkan sampai selesai, minta maaf, ulangi masalahnya, tawarkan solusi yang disetujui pembimbing, pastikan pelanggan puas. Tulis langkah yang kamu lakukan dan apa yang kamu pelajari.",
    bukti: ["teks"],
    poin: 15,
  },
  {
    kategori: "cs",
    level: "menengah",
    judul: "Menawarkan dengan sopan (persuasif)",
    deskripsi:
      "Tulis 3 contoh kalimat menawarkan produk tambahan atau produk yang cocok untuk pelanggan, tanpa memaksa. Minta pembimbing menilai mana yang paling enak dibaca, lalu perbaiki yang lain.",
    bukti: ["teks"],
    poin: 15,
  },

  // ── Desain Grafis (menengah): Canva, CorelDraw, pola, pattern, jersey fantasy ──────────────────
  {
    kategori: "desain",
    level: "dasar",
    judul: "Canva: flyer promo ukuran story",
    deskripsi:
      "Buat 1 flyer promo produk di Canva ukuran story (1080×1920). Harus ada: foto produk, judul yang jelas, logo usaha, dan ajakan (mis. \"Pesan sekarang\"). Isi promo/harga tanyakan pembimbing — jangan mengarang.",
    bukti: ["foto"],
    poin: 10,
  },
  {
    kategori: "desain",
    level: "dasar",
    judul: "Canva: 3 desain feed satu tema",
    deskripsi: "Buat 3 desain feed Instagram (1080×1080) dengan warna, huruf, dan gaya yang sama supaya terlihat satu keluarga.",
    bukti: ["foto"],
    poin: 10,
  },
  {
    kategori: "desain",
    level: "dasar",
    judul: "CorelDraw: kenali alat dasar",
    deskripsi:
      "Pelajari alat dasar CorelDraw: kotak, lingkaran, teks, warna isi & garis, mengelompokkan (group), dan meratakan (align). Buat satu logo/tulisan sederhana, kirim tangkapan layarnya.",
    bukti: ["foto"],
    poin: 10,
  },
  {
    kategori: "desain",
    level: "menengah",
    judul: "CorelDraw: siapkan file siap cetak",
    deskripsi:
      "Ambil satu desain lalu siapkan untuk dicetak: ukuran sesuai pesanan, beri bleed, teks diubah ke kurva, warna CMYK, simpan PDF. Tulis langkah yang kamu lakukan dan kirim tangkapan layarnya.",
    bukti: ["foto", "teks"],
    poin: 15,
  },
  {
    kategori: "desain",
    level: "menengah",
    judul: "Pola jersey",
    deskripsi:
      "Bersama pembimbing, pelajari pola desain jersey (badan depan, badan belakang, lengan, kerah). Gambar ulang polanya di CorelDraw dengan ukuran yang benar.",
    bukti: ["foto"],
    poin: 15,
  },
  {
    kategori: "desain",
    level: "menengah",
    judul: "Pattern jersey",
    deskripsi: "Buat 2 motif pattern (pola berulang) untuk jersey, lalu tempelkan pada pola badan depan. Ceritakan ide motifnya.",
    bukti: ["foto", "teks"],
    poin: 15,
  },
  {
    kategori: "desain",
    level: "lanjut",
    judul: "Tugas akhir: desain jersey fantasy",
    deskripsi:
      "Rancang satu jersey fantasy lengkap: tampak depan & belakang, nama & nomor punggung, logo, pattern, dan pilihan warna. Presentasikan ke pembimbing (ide, warna, alasan) lalu perbaiki sesuai masukan.",
    bukti: ["foto", "teks"],
    poin: 30,
  },

  // ── Digital Marketing (rendah): dasar pemasaran, branding, remarketing, Shopee Ads, Meta Ads ───
  {
    kategori: "marketing",
    level: "dasar",
    judul: "Dasar pemasaran: siapa pembeli kita?",
    deskripsi: "Pilih satu produk. Tulis siapa yang biasanya membeli, kenapa mereka butuh, dan di mana mereka biasanya mencari produk itu (Instagram, Shopee, WhatsApp, dll).",
    bukti: ["teks"],
    poin: 10,
  },
  {
    kategori: "marketing",
    level: "dasar",
    judul: "Branding: kenali ciri akun usaha",
    deskripsi: "Amati akun media sosial usaha. Tulis 3 cirinya: warna yang sering dipakai, gaya bahasa, dan cara memasang logo. Beri 1 saran perbaikan.",
    bukti: ["teks"],
    poin: 10,
  },
  {
    kategori: "marketing",
    level: "menengah",
    judul: "Remarketing: pesan untuk pelanggan lama",
    deskripsi:
      "Susun 1 pesan WhatsApp untuk menyapa pelanggan lama (mis. kabar produk baru). Pesan WAJIB diperiksa pembimbing; kirim hanya bila diizinkan. Kirim isi pesannya.",
    bukti: ["teks"],
    poin: 15,
  },
  {
    kategori: "marketing",
    level: "dasar",
    judul: "Shopee Ads: kenali menu iklan",
    deskripsi: "Bersama pembimbing, buka menu iklan Shopee. Tulis arti 3 istilah yang kamu temui (mis. anggaran harian, kata kunci, klik) dengan bahasamu sendiri.",
    bukti: ["teks"],
    poin: 10,
  },
  {
    kategori: "marketing",
    level: "dasar",
    judul: "Meta Ads: kenali iklan Facebook & Instagram",
    deskripsi: "Bersama pembimbing, lihat satu contoh iklan di Meta Ads Manager. Tulis tujuan iklannya, siapa yang ditargetkan, dan materi apa yang dipakai.",
    bukti: ["teks"],
    poin: 10,
  },
];
