/**
 * Pos rotasi PRIORITAS (keputusan owner 9 Nov 2026): kerja utama anak magang = KONTEN (shooting, talent,
 * editing, copywriting, produksi dengan AI, posting) dan PRODUKSI (Voliko Print = digital printing,
 * Voliko Sport = produsen jersey/sportswear, Runner). Customer Service & Desain BUKAN pos lagi — jadi
 * side quest (misi). Setiap produk jadi tetap wajib difoto + dibuat video singkat (baris di tiap pos).
 *
 * Semua pos 2 minggu (minggu 1 didampingi, minggu 2 mandiri), kapasitas 3: simulasi 5 pos × kap 3 muat
 * 12 anak dari 3 rombongan tanpa "berbagi". Soal = pengetahuan UMUM pekerjaannya (tanpa harga,
 * kebijakan usaha, atau merek/tipe mesin tertentu).
 *
 * Dipasang ke server lewat tools/magang/voliko-pos-prioritas.ts. `rencanakan()` di bawah = bagian
 * MURNI skrip itu (tanpa DB) supaya bisa diuji — tests/magang-pos-prioritas.test.ts.
 */

import { susunRotasi, seninDari, tambahMinggu, type PenugasanAda, type PenugasanBaru, type PesertaRotasi } from "./rotasi";

export type SoalPrioritas = { pertanyaan: string; pilihan: string[]; benar: number };
export type PosPrioritas = {
  nama: string;
  durasiMinggu: number;
  kapasitas: number;
  /** Label tempat; null = lokasi tim tetap dicatat di catatan peserta. */
  lokasi: string | null;
  urutan: number;
  deskripsi: string;
  soal: SoalPrioritas[];
};

/** Baris wajib di SETIAP pos. */
export const BARIS_FOTO_VIDEO =
  "- Kewajiban foto & video produk jadi: setiap produk yang selesai dikerjakan difoto + dibuat video singkat, lalu diserahkan ke pembimbing";

const target = (...baris: string[]) => [...baris.map((b) => `- ${b}`), BARIS_FOTO_VIDEO].join("\n");

export const POS_PRIORITAS: readonly PosPrioritas[] = [
  {
    nama: "Konten: Shooting & Talent",
    durasiMinggu: 2,
    kapasitas: 3,
    lokasi: null,
    urutan: 20,
    deskripsi: target(
      "Minggu 1 (didampingi): ikut sesi shooting — menyiapkan cahaya, latar, HP/kamera & tripod",
      "Merekam minimal 5 klip produk per minggu dengan framing rapi, tegak 9:16 untuk reels/Shopee Video",
      "Minggu 2 (mandiri): merekam bahan untuk minimal 3 video pendek dari naskah/arahan pembimbing",
      "Tampil sebagai talent di minimal 1 video per minggu: menatap kamera, bicara jelas, produk terlihat",
      "Ikut merekam bahan video panjang (YouTube) bersama tim minimal 1 kali",
      "Memeriksa hasil rekaman (fokus, cahaya, suara) sebelum diserahkan ke editor",
      "Selalu minta izin sebelum merekam pelanggan atau rekan kerja"
    ),
    soal: [
      { pertanyaan: "Rasio video yang tepat untuk reels / Shopee Video adalah…", pilihan: ["16:9 mendatar", "9:16 tegak", "1:1 kotak", "4:3"], benar: 1 },
      { pertanyaan: "Aturan sepertiga (rule of thirds) artinya…", pilihan: ["Merekam setiap adegan 3 kali", "Memakai 3 lampu sekaligus", "Video maksimal 3 menit", "Objek utama diletakkan di sekitar garis/titik potong kisi 3×3"], benar: 3 },
      { pertanyaan: "Cahaya yang paling mudah & bagus untuk merekam produk di siang hari?", pilihan: ["Cahaya jendela yang lembut dari depan/samping", "Lampu kuning yang remang", "Matahari terik langsung ke arah lensa", "Lampu kilat HP dari jarak dekat"], benar: 0 },
      { pertanyaan: "Supaya suara rekaman jelas, sebaiknya…", pilihan: ["Merekam di tempat ramai supaya hidup", "Menyalakan musik keras saat merekam", "Merekam di tempat tenang dengan mikrofon dekat sumber suara", "Menjauhkan HP dari orang yang bicara"], benar: 2 },
      { pertanyaan: "Sebelum merekam wajah pelanggan untuk konten, yang harus dilakukan?", pilihan: ["Langsung merekam diam-diam", "Merekam dulu, izin belakangan", "Bertanya ke teman saja", "Minta izin dulu; kalau menolak, jangan direkam"], benar: 3 },
      { pertanyaan: "Supaya video tidak goyang, cara yang benar?", pilihan: ["Pakai tripod/penyangga atau pegang dengan dua tangan dekat badan", "Zoom digital sampai maksimal", "Merekam sambil berjalan cepat dengan satu tangan", "Menggoyangkan HP supaya terlihat seru"], benar: 0 },
      { pertanyaan: "Saat menjadi talent yang memperkenalkan produk, sikap yang tepat?", pilihan: ["Membelakangi kamera", "Menutupi produk dengan tangan", "Menatap kamera, bicara jelas, produk terlihat", "Berbicara sangat pelan"], benar: 2 },
      { pertanyaan: "Mengapa 3 detik pertama video pendek sangat penting?", pilihan: ["Untuk menaruh logo besar saja", "Penonton memutuskan lanjut menonton atau menggulir lewat", "Karena bagian itu tidak ikut tayang", "Tidak ada bedanya dengan detik lain"], benar: 1 },
      { pertanyaan: "Sebelum mulai merekam, lensa kamera HP sebaiknya…", pilihan: ["Dibiarkan saja", "Ditutup jari supaya aman", "Diolesi air", "Dilap dengan kain bersih supaya gambar tidak buram"], benar: 3 },
    ],
  },
  {
    nama: "Konten: Editing, Copywriting & Posting",
    durasiMinggu: 2,
    kapasitas: 3,
    lokasi: null,
    urutan: 21,
    deskripsi: target(
      "Minggu 1 (didampingi): belajar alur edit — memotong klip, menambah teks & musik, ekspor 9:16",
      "Minimal 3 video pendek diedit & diserahkan ke pembimbing per minggu",
      "Membantu menyunting 1 video panjang (YouTube): membuang bagian kosong, menambah judul & teks",
      "Menulis caption untuk tiap video: hook di kalimat pertama + ajakan bertindak (CTA)",
      "Membuat minimal 2 flyer/gambar iklan untuk marketplace & media sosial per minggu",
      "Mencoba produksi konten dengan bantuan AI (ide naskah, caption, gambar) — hasilnya selalu dicek & dirapikan",
      "Admin sosmed (didampingi): menyiapkan posting & story sesuai jadwal, membantu membalas pesan masuk marketplace & sosmed",
      "Semua unggahan dicek pembimbing sebelum tayang"
    ),
    soal: [
      { pertanyaan: "Dalam caption atau video, \"hook\" adalah…", pilihan: ["Kalimat/adegan pembuka yang membuat orang berhenti dan memperhatikan", "Daftar tagar di akhir caption", "Nama akun pembuat video", "Musik latar"], benar: 0 },
      { pertanyaan: "CTA (call to action) yang baik contohnya…", pilihan: ["Tidak menulis apa-apa", "\"Klik keranjang kuning / chat kami untuk pesan\"", "Menulis ulang nama produk 5 kali", "Hanya emoji"], benar: 1 },
      { pertanyaan: "Mode warna yang dipakai untuk gambar yang tampil di layar (sosmed/marketplace)?", pilihan: ["CMYK", "Pantone", "RGB", "Hitam putih"], benar: 2 },
      { pertanyaan: "Ukuran ekspor yang umum untuk video pendek tegak?", pilihan: ["1920×1080", "800×600", "1080×1080", "1080×1920"], benar: 3 },
      { pertanyaan: "Hasil tulisan atau gambar dari AI sebaiknya…", pilihan: ["Langsung diunggah tanpa dibaca", "Dicek kebenaran & ejaannya, dirapikan, lalu dicek pembimbing", "Disalin persis ke semua akun", "Tidak boleh dipakai sama sekali"], benar: 1 },
      { pertanyaan: "Teks di dalam video pendek sebaiknya…", pilihan: ["Kecil di pojok bawah", "Berwarna sama dengan latar", "Besar, kontras, dan tidak tertutup tombol aplikasi", "Bergerak sangat cepat"], benar: 2 },
      { pertanyaan: "Mengapa jadwal posting dibuat teratur?", pilihan: ["Supaya akun aktif konsisten dan pengikut tahu kapan ada konten baru", "Supaya bisa posting sekaligus 30 video sehari lalu berhenti", "Tidak ada gunanya", "Supaya admin libur"], benar: 0 },
      { pertanyaan: "Pembeli bertanya lewat pesan marketplace. Yang tepat?", pilihan: ["Dibiarkan sampai besok", "Dijawab ketus supaya singkat", "Meminta data pribadi pembeli lain", "Dibalas sopan & cepat; bila tidak tahu jawabannya, tanya pembimbing dulu"], benar: 3 },
      { pertanyaan: "Musik untuk video sebaiknya diambil dari…", pilihan: ["Lagu siapa saja dari internet", "Pustaka musik di aplikasi atau musik bebas pakai", "Rekaman radio", "Video orang lain"], benar: 1 },
    ],
  },
  {
    nama: "Produksi: Voliko Print",
    durasiMinggu: 2,
    kapasitas: 3,
    lokasi: null,
    urutan: 22,
    deskripsi: target(
      "Minggu 1 (didampingi): mengenal alur produksi digital printing — antrian, cek file, mesin, finishing, packing",
      "Potong produk indoor, outdoor & kertas dengan lurus dan aman (penggaris besi, alas potong, cutter tajam)",
      "Membantu operator mesin outdoor & indoor: memasang bahan, mengecek hasil cetak",
      "Finishing outdoor & indoor (mata ayam, laminasi, merapikan) minimal 10 pesanan per minggu bersama tim",
      "Minggu 2 (mandiri): mengerjakan potong & finishing pesanan sederhana sendiri, lalu dicek pembimbing",
      "QC sebelum packing: ukuran, warna, jumlah sesuai nota",
      "Packing rapi supaya tidak rusak di jalan"
    ),
    soal: [
      { pertanyaan: "Mode warna yang dipakai untuk mencetak adalah…", pilihan: ["RGB", "CMYK", "HSL", "Hex"], benar: 1 },
      { pertanyaan: "Gunanya bleed (area lebih di tepi desain)?", pilihan: ["Supaya file lebih kecil", "Supaya warna lebih terang", "Supaya cepat dicetak", "Supaya tidak ada garis putih di tepi saat dipotong"], benar: 3 },
      { pertanyaan: "Cara memotong hasil cetak dengan cutter yang aman & rapi?", pilihan: ["Pakai penggaris besi, alas potong, cutter tajam, tangan di luar jalur pisau", "Tanpa alas langsung di atas meja", "Dipotong kira-kira saja", "Menarik cutter ke arah badan"], benar: 0 },
      { pertanyaan: "Hasil cetak tiba-tiba bergaris. Langkah pertama yang tepat?", pilihan: ["Naikkan kecepatan cetak", "Cetak ulang terus sampai bagus", "Lapor operator; lakukan nozzle check & bersihkan head", "Ganti bahan yang lebih tebal"], benar: 2 },
      { pertanyaan: "Mata ayam (keling) pada banner gunanya untuk…", pilihan: ["Hiasan", "Lubang tempat tali saat banner dipasang", "Menambah berat banner", "Menandai sisi depan"], benar: 1 },
      { pertanyaan: "Hasil cetak yang tintanya belum kering sebaiknya…", pilihan: ["Langsung digulung", "Ditumpuk supaya rata", "Dilap kain basah", "Ditunggu kering dulu sebelum digulung/dikemas"], benar: 3 },
      { pertanyaan: "QC sebelum packing berarti mengecek…", pilihan: ["Ukuran, warna, jumlah & kerapian sesuai nota", "Cuaca hari itu", "Nama operator", "Harga bahan"], benar: 0 },
      { pertanyaan: "Banner besar sebaiknya dikemas dengan cara…", pilihan: ["Dilipat kecil-kecil", "Ditumpuk tanpa pembungkus", "Digulung rapi dengan sisi cetak di dalam lalu dibungkus", "Dimasukkan amplop kertas"], benar: 2 },
      { pertanyaan: "Laminasi doff hasilnya…", pilihan: ["Mengkilap seperti kaca", "Tidak mengkilap / redup", "Berwarna perak", "Bertekstur pasir"], benar: 1 },
    ],
  },
  {
    nama: "Produksi: Voliko Sport",
    durasiMinggu: 2,
    kapasitas: 3,
    lokasi: "Voliko Sport",
    urutan: 23,
    deskripsi: target(
      "Minggu 1 (didampingi): mengenal alur produksi jersey — file desain → print sublim → press → potong → jahit → QC → packing",
      "Potong bahan jersey mengikuti pola dengan rapi, minimal 5 set per minggu bersama tim",
      "Membantu operator mesin print sublim, heat press, dan jahit-potong",
      "Press & QC jersey: warna, posisi motif, ukuran, jahitan, nama & nomor sesuai daftar pesanan",
      "Minggu 2 (mandiri): mengerjakan potong, press & QC pesanan sederhana sendiri, lalu dicek pembimbing",
      "Packing per pesanan: cek ukuran & jumlah, lipat rapi, beri label",
      "Bekerja aman di dekat mesin panas & mesin jahit"
    ),
    soal: [
      { pertanyaan: "Sablon sublimasi bekerja dengan cara…", pilihan: ["Tinta dipindah dari kertas transfer ke kain memakai panas & tekanan", "Kain dicelup ke tinta", "Tinta dioles kuas", "Kain dicetak langsung tanpa panas"], benar: 0 },
      { pertanyaan: "Desain untuk sublimasi dicetak mirror (terbalik) di kertas transfer karena…", pilihan: ["Supaya hemat tinta", "Supaya lebih cepat kering", "Saat dipress, gambar terbalik lagi sehingga tulisan terbaca benar di kain", "Tidak ada alasannya"], benar: 2 },
      { pertanyaan: "Bahan yang cocok untuk sublimasi adalah…", pilihan: ["Katun 100%", "Wol", "Kulit", "Polyester"], benar: 3 },
      { pertanyaan: "Bekerja di dekat mesin heat press yang benar?", pilihan: ["Menyentuh plat untuk cek panas", "Tangan menjauhi plat panas & ikuti arahan operator", "Meninggalkan kain di bawah plat lama-lama", "Membiarkan anak lain bermain di dekatnya"], benar: 1 },
      { pertanyaan: "Hasil press berbayang/dobel biasanya karena…", pilihan: ["Kertas transfer bergeser saat dipress", "Kain terlalu bersih", "Ruangan terlalu terang", "Tinta terlalu sedikit di botol"], benar: 0 },
      { pertanyaan: "Saat QC jersey tim, yang wajib dicocokkan dengan daftar pesanan?", pilihan: ["Warna lantai produksi", "Nama, nomor punggung & ukuran tiap jersey", "Merek benang", "Jam pesanan masuk"], benar: 1 },
      { pertanyaan: "Memotong bahan jersey sebaiknya…", pilihan: ["Kira-kira tanpa pola", "Menebak ukuran", "Mengikuti pola ukuran dengan rapi & teliti", "Dipotong sebesar mungkin"], benar: 2 },
      { pertanyaan: "Sebelum mengganti benang atau jarum mesin jahit…", pilihan: ["Mesin dibiarkan menyala", "Pedal diinjak supaya cepat", "Tidak perlu apa-apa", "Matikan mesin dan jauhkan kaki dari pedal"], benar: 3 },
    ],
  },
  {
    nama: "Runner & Stok",
    durasiMinggu: 2,
    kapasitas: 3,
    lokasi: null,
    urutan: 24,
    deskripsi: target(
      "Minggu 1 (didampingi): ikut tugas runner — mengirim paket ke ekspedisi, membeli bahan, mengambil/mengantar barang",
      "Setiap tugas runner: bawa daftar titipan, minta nota/resi, serahkan nota & uang kembalian ke pembimbing hari itu juga",
      "Stock opname minimal 1 kali per minggu: hitung stok fisik, cocokkan & update catatan stok",
      "Melaporkan stok yang menipis atau selisih ke pembimbing",
      "Merapikan rak bahan & barang: yang masuk lebih dulu dipakai lebih dulu (FIFO)",
      "Minggu 2 (mandiri): menjalankan tugas runner & stok sendiri, lalu dicek pembimbing",
      "Selamat di jalan: helm, patuh lalu lintas, tidak memakai HP saat berkendara"
    ),
    soal: [
      { pertanyaan: "Stock opname artinya…", pilihan: ["Membeli stok baru", "Menjual stok lama", "Menghitung stok fisik lalu mencocokkan dengan catatan", "Memindahkan stok ke gudang lain"], benar: 2 },
      { pertanyaan: "Barang yang masuk lebih dulu dipakai lebih dulu. Ini disebut…", pilihan: ["LIFO", "FIFO", "COD", "SKU"], benar: 1 },
      { pertanyaan: "Sesudah membeli bahan atau mengirim paket, yang wajib dibawa pulang?", pilihan: ["Nota/resi pembelian atau pengiriman", "Kantong plastik", "Tidak ada", "Foto selfie di toko"], benar: 0 },
      { pertanyaan: "Saat stock opname, jumlah fisik berbeda dengan catatan. Yang tepat?", pilihan: ["Mengubah angka supaya sama", "Diam saja", "Membuang barang yang lebih", "Hitung ulang, lalu laporkan selisihnya ke pembimbing"], benar: 3 },
      { pertanyaan: "Saat berkendara untuk tugas runner…", pilihan: ["Boleh membalas chat sambil jalan", "Memakai helm, patuh lalu lintas, berhenti dulu bila perlu memakai HP", "Ngebut supaya cepat", "Membonceng barang melebihi batas"], benar: 1 },
      { pertanyaan: "Sebelum paket diserahkan ke ekspedisi, yang dicek?", pilihan: ["Warna lakban", "Cuaca", "Nama, nomor HP & alamat penerima pada label sudah benar", "Tidak perlu dicek"], benar: 2 },
      { pertanyaan: "Uang kembalian belanja bahan sebaiknya…", pilihan: ["Disimpan sendiri", "Dibelikan jajan", "Dicatat & diserahkan bersama nota ke pembimbing", "Dibagi dengan teman"], benar: 2 },
      { pertanyaan: "Stok bahan tinggal sedikit. Yang dilakukan?", pilihan: ["Menunggu sampai habis", "Menyembunyikan sisa bahan", "Memakai bahan lain tanpa bilang", "Melapor ke pembimbing supaya bisa dibeli"], benar: 3 },
    ],
  },
];

/** Pos lama yang dinonaktifkan (TIDAK dihapus) saat pos prioritas dipasang. Cocok nama persis. */
export const POS_LAMA_NONAKTIF: readonly string[] = ["Customer Service", "Desainer", "Operator Outdoor", "Operator A3+"];

// ── Perencanaan MURNI untuk skrip pemasangan ─────────────────────────────────────────────────

/** Pos di DB (yang belum dihapus lunak). */
export type PosDb = { id: number; nama: string; aktif: boolean; durasiMinggu: number; kapasitas: number; jumlahSoal: number };

export type RencanaPos = {
  def: PosPrioritas;
  /** id DB; NEGATIF = belum dibuat (placeholder di dry-run, diganti id asli saat dijalankan). */
  id: number;
  baru: boolean;
  /** Pos sudah ada tapi belum punya soal → soal dari `def` ditambahkan. */
  tambahSoal: boolean;
  durasiMinggu: number;
  kapasitas: number;
};

export type Rencana = {
  dari: string;
  pos: RencanaPos[];
  nonaktifkan: { id: number; nama: string }[];
  /** Pos aktif lain yang tetap aktif (mis. Orientasi) — ikut rotasi bila "Susun rotasi semua" ditekan di UI. */
  tetapAktif: { id: number; nama: string }[];
  /** Penugasan yang dipertahankan (mulai < dari). */
  ada: PenugasanAda[];
  /** Penugasan yang dipertahankan tapi masih berjalan pada/sesudah `dari`. */
  berjalan: PenugasanAda[];
  /** Penugasan yang akan dihapus (mulai ≥ dari). */
  hapus: PenugasanAda[];
  usulan: PenugasanBaru[];
  /** Masalah yang membuat skrip harus berhenti. */
  masalah: string[];
};

export function rencanakan(input: {
  posDb: readonly PosDb[];
  peserta: readonly PesertaRotasi[];
  penugasan: readonly PenugasanAda[];
  dari: string;
}): Rencana {
  const { dari } = input;
  const masalah: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || seninDari(dari) !== dari) masalah.push(`Tanggal mulai ${dari} bukan hari Senin.`);

  const pos: RencanaPos[] = POS_PRIORITAS.map((def, i) => {
    const sama = input.posDb.filter((p) => p.nama === def.nama);
    if (sama.length > 1) masalah.push(`Ada ${sama.length} pos bernama "${def.nama}" (id ${sama.map((p) => p.id).join(", ")}) — rapikan dulu di UI.`);
    const p = sama[0];
    if (!p) return { def, id: -(i + 1), baru: true, tambahSoal: true, durasiMinggu: def.durasiMinggu, kapasitas: def.kapasitas };
    if (!p.aktif) masalah.push(`Pos "${def.nama}" (id ${p.id}) sudah ada tapi NONAKTIF — aktifkan dulu di UI atau ganti namanya.`);
    return { def, id: p.id, baru: false, tambahSoal: p.jumlahSoal === 0, durasiMinggu: p.durasiMinggu, kapasitas: p.kapasitas };
  });

  const namaBaru = new Set(POS_PRIORITAS.map((p) => p.nama));
  const namaLama = new Set(POS_LAMA_NONAKTIF);
  const nonaktifkan = input.posDb.filter((p) => p.aktif && namaLama.has(p.nama)).map((p) => ({ id: p.id, nama: p.nama }));
  const tetapAktif = input.posDb
    .filter((p) => p.aktif && !namaLama.has(p.nama) && !namaBaru.has(p.nama))
    .map((p) => ({ id: p.id, nama: p.nama }));

  const ada = input.penugasan.filter((a) => a.mulai < dari);
  const hapus = input.penugasan.filter((a) => a.mulai >= dari);
  const berjalan = ada.filter((a) => tambahMinggu(a.mulai, a.minggu) > dari);

  const usulan =
    masalah.length > 0
      ? []
      : susunRotasi({
          pos: pos.map((p) => ({ id: p.id, durasiMinggu: p.durasiMinggu, kapasitas: p.kapasitas })),
          peserta: input.peserta,
          ada,
          dari,
        });

  return { dari, pos, nonaktifkan, tetapAktif, ada, berjalan, hapus, usulan, masalah };
}

