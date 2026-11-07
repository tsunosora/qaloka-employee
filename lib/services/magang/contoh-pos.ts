/**
 * Contoh pos kerja percetakan untuk tombol "Pakai contoh pos percetakan" (hanya bila belum ada pos).
 * Isinya pengetahuan UMUM percetakan — bukan data usaha mana pun — dan semuanya bisa disunting.
 * Durasi: pos yang butuh latihan tangan/alat = 2 minggu (minggu 1 didampingi, minggu 2 mandiri),
 * pos yang alurnya sederhana = 1 minggu.
 * Tiap pos 5 soal = sebanyak soal yang diundi per minggu (dulu 3 → anak hanya dapat 3 soal; temuan simulasi 7 Nov 2026).
 */

type SoalContoh = { pertanyaan: string; pilihan: string[]; benar: number };
type PosContoh = { nama: string; durasiMinggu: number; deskripsi: string; soal: SoalContoh[] };

export const CONTOH_POS: readonly PosContoh[] = [
  {
    nama: "Operator Cetak",
    durasiMinggu: 2,
    deskripsi:
      "- Menyalakan & mematikan mesin dengan urutan yang benar\n- Mengambil pekerjaan dari antrian dan mengecek file sebelum cetak\n- Memasang bahan (roll/lembar) dengan lurus\n- Nozzle check & membersihkan head bila hasil bergaris\n- Mencatat bahan terpakai & hasil cetak gagal",
    soal: [
      { pertanyaan: "Sebelum mencetak, apa yang paling penting dicek di file?", pilihan: ["Ukuran & resolusi sesuai pesanan", "Nama file", "Jumlah layer", "Tanggal file dibuat"], benar: 0 },
      { pertanyaan: "Mode warna yang dipakai untuk mencetak adalah…", pilihan: ["RGB", "CMYK", "HSL", "Hex"], benar: 1 },
      { pertanyaan: "Hasil cetak tiba-tiba bergaris. Langkah pertama yang tepat?", pilihan: ["Naikkan kecepatan cetak", "Ganti bahan yang lebih tebal", "Nozzle check lalu bersihkan head", "Cetak ulang terus sampai bagus"], benar: 2 },
      { pertanyaan: "Bahan yang dipasang miring saat mencetak akan menyebabkan…", pilihan: ["Hasil cetak ikut miring/bergeser", "Tidak berpengaruh", "Warna jadi lebih terang", "Mesin mencetak lebih cepat"], benar: 0 },
      { pertanyaan: "Mencatat bahan terpakai setiap hari gunanya untuk…", pilihan: ["Hiasan laporan", "Mencocokkan stok & menghitung biaya", "Mengganti nama file", "Tidak ada gunanya"], benar: 1 },
    ],
  },
  {
    nama: "Setting File & Desain",
    durasiMinggu: 2,
    deskripsi:
      "- Membuka file pelanggan dan mengecek ukuran, resolusi, warna\n- Memberi bleed & batas aman teks\n- Mengubah teks ke kurva/outline sebelum dikirim ke operator\n- Menyusun beberapa desain dalam satu bahan supaya hemat\n- Menyimpan file dengan nama yang rapi",
    soal: [
      { pertanyaan: "Resolusi yang umum untuk cetakan dilihat dekat (brosur, kartu nama)?", pilihan: ["72 dpi", "150 dpi", "300 dpi", "30 dpi"], benar: 2 },
      { pertanyaan: "Gunanya bleed (area lebih di tepi desain)?", pilihan: ["Supaya file lebih kecil", "Supaya tidak ada garis putih saat dipotong", "Supaya warna lebih terang", "Supaya cepat dicetak"], benar: 1 },
      { pertanyaan: "Sebelum file dikirim ke operator, teks sebaiknya…", pilihan: ["Diubah ke kurva/outline", "Dihapus", "Diperbesar dua kali", "Diberi warna RGB"], benar: 0 },
      { pertanyaan: "Format file yang paling aman dikirim ke operator cetak?", pilihan: ["PDF siap cetak", "Tangkapan layar", "File Word", "Foto layar dari HP"], benar: 0 },
      { pertanyaan: "Batas aman (safe area) pada desain gunanya…", pilihan: ["Tempat menaruh logo besar", "Menjaga teks penting tidak ikut terpotong", "Memperbesar ukuran file", "Menambah warna"], benar: 1 },
    ],
  },
  {
    nama: "CS & Kasir",
    durasiMinggu: 2,
    deskripsi:
      "- Menyapa & menanyakan kebutuhan pelanggan\n- Memastikan ukuran, bahan, jumlah, finishing, dan tanggal ambil sebelum membuat nota\n- Membuat nota & menerima pembayaran di sistem kasir (didampingi)\n- Menangani pertanyaan & komplain dengan sopan\n- Mencatat pesanan supaya diteruskan ke desain/produksi",
    soal: [
      { pertanyaan: "Sebelum membuat nota, yang wajib dipastikan ke pelanggan?", pilihan: ["Warna kesukaan pelanggan", "Ukuran, bahan, jumlah, finishing & tanggal ambil", "Alamat media sosial pelanggan", "Nama desainer yang diinginkan"], benar: 1 },
      { pertanyaan: "Pelanggan komplain hasil cetak. Sikap pertama yang benar?", pilihan: ["Langsung menyalahkan file pelanggan", "Mendengarkan, mencatat masalahnya, lalu mengecek hasilnya", "Menyuruh datang besok", "Diam saja"], benar: 1 },
      { pertanyaan: "Sesudah menerima pembayaran, yang harus dilakukan?", pilihan: ["Mencatat di sistem kasir & memberi nota", "Menyimpan uang di saku dulu", "Menulis di kertas saja", "Tidak perlu dicatat kalau nominalnya kecil"], benar: 0 },
      { pertanyaan: "Pelanggan minta pesanan selesai hari ini padahal antrian penuh. Yang tepat?", pilihan: ["Langsung menyanggupi", "Cek antrian ke produksi dulu, lalu beri jawaban jujur", "Menolak tanpa alasan", "Diam saja"], benar: 1 },
      { pertanyaan: "Data pelanggan (nama & nomor HP) sebaiknya…", pilihan: ["Dibagikan ke grup umum", "Dicatat di sistem dan dijaga kerahasiaannya", "Ditulis di kertas bekas", "Tidak perlu dicatat"], benar: 1 },
    ],
  },
  {
    nama: "Finishing",
    durasiMinggu: 1,
    deskripsi:
      "- Memotong hasil cetak dengan rapi & aman\n- Memasang mata ayam/keling di banner\n- Laminasi doff/glossy\n- Mengecek hasil sebelum diserahkan ke packing",
    soal: [
      { pertanyaan: "Mata ayam (keling) pada banner gunanya untuk…", pilihan: ["Hiasan", "Tempat tali saat banner dipasang", "Menambah berat banner", "Menandai sisi depan"], benar: 1 },
      { pertanyaan: "Cara memotong hasil cetak dengan cutter yang benar?", pilihan: ["Tanpa alas di atas meja", "Pakai penggaris besi, alas potong & cutter tajam", "Pakai gunting kuku", "Dipotong kira-kira saja"], benar: 1 },
      { pertanyaan: "Laminasi doff hasilnya…", pilihan: ["Mengkilap seperti kaca", "Tidak mengkilap / redup", "Berwarna perak", "Transparan berpasir"], benar: 1 },
      { pertanyaan: "Sebelum dilaminasi, hasil cetak harus…", pilihan: ["Masih basah", "Sudah kering & bersih dari debu", "Dilipat dulu", "Digulung kencang"], benar: 1 },
      { pertanyaan: "Cutter yang sedang tidak dipakai sebaiknya…", pilihan: ["Dibiarkan terbuka di meja", "Pisaunya ditutup & disimpan di tempatnya", "Dititipkan ke pelanggan", "Diletakkan di lantai"], benar: 1 },
    ],
  },
  {
    nama: "Gudang & Stok",
    durasiMinggu: 1,
    deskripsi:
      "- Menerima barang masuk & mencocokkan dengan surat jalan\n- Menyimpan bahan di raknya, rapi & aman dari air/panas\n- Mengeluarkan bahan untuk produksi & mencatatnya\n- Ikut stok opname",
    soal: [
      { pertanyaan: "Barang yang datang lebih dulu dipakai lebih dulu. Ini disebut…", pilihan: ["FIFO", "LIFO", "COD", "SKU"], benar: 0 },
      { pertanyaan: "Stok opname artinya…", pilihan: ["Membeli stok baru", "Menghitung stok fisik lalu mencocokkan dengan catatan sistem", "Menjual stok lama", "Memindahkan stok ke gudang lain"], benar: 1 },
      { pertanyaan: "Tempat menyimpan roll bahan yang baik?", pilihan: ["Di lantai dekat pintu", "Di rak, jauh dari air & panas", "Di luar ruangan", "Di bawah AC yang menetes"], benar: 1 },
      { pertanyaan: "Bahan yang keluar untuk produksi harus…", pilihan: ["Dicatat jumlahnya", "Tidak perlu dicatat", "Dicatat sebulan sekali saja", "Dicatat oleh pelanggan"], benar: 0 },
      { pertanyaan: "Stok bahan tinggal sedikit. Yang dilakukan?", pilihan: ["Menunggu sampai habis", "Melapor ke atasan / bagian pembelian", "Menyembunyikan sisa bahan", "Memakai bahan lain tanpa bilang"], benar: 1 },
    ],
  },
  {
    nama: "Packing & Pengiriman",
    durasiMinggu: 1,
    deskripsi:
      "- Mengecek jumlah & kesesuaian barang dengan nota\n- Mengemas supaya tidak rusak di jalan\n- Menulis label pengiriman\n- Menyerahkan ke pelanggan/kurir dan mencatatnya",
    soal: [
      { pertanyaan: "Sebelum barang diserahkan atau dikirim, yang dicek?", pilihan: ["Jumlah & kesesuaian dengan nota", "Warna plastik pembungkus", "Cuaca hari itu", "Tidak perlu dicek"], benar: 0 },
      { pertanyaan: "Label pengiriman minimal memuat…", pilihan: ["Harga barang", "Nama, nomor HP & alamat penerima", "Nama operator cetak", "Jenis mesin cetak"], benar: 1 },
      { pertanyaan: "Hasil cetak yang tintanya belum kering sebaiknya…", pilihan: ["Langsung digulung/ditumpuk", "Ditunggu kering dulu", "Dilap dengan kain basah", "Dijemur di bawah hujan"], benar: 1 },
      { pertanyaan: "Banner besar sebaiknya dikemas dengan cara…", pilihan: ["Dilipat kecil-kecil supaya muat", "Digulung rapi lalu dibungkus pelindung", "Ditumpuk tanpa pembungkus", "Dimasukkan amplop kertas"], benar: 1 },
      { pertanyaan: "Bukti serah terima / resi pengiriman gunanya…", pilihan: ["Tidak ada gunanya", "Bukti barang sudah diterima bila ada komplain", "Hiasan nota", "Hanya untuk kurir"], benar: 1 },
    ],
  },
  {
    nama: "Konten & Foto Produk",
    durasiMinggu: 1,
    deskripsi:
      "- Memotret hasil cetak dengan cahaya & latar yang rapi\n- Menulis keterangan singkat produk\n- Menyiapkan unggahan media sosial (dicek pembimbing sebelum tayang)\n- Menjaga data pribadi pelanggan tidak ikut terpotret",
    soal: [
      { pertanyaan: "Foto produk yang baik untuk media sosial?", pilihan: ["Gelap supaya misterius", "Cahaya cukup, latar rapi, produk jelas", "Banyak barang lain di belakang", "Diambil dari jauh sekali"], benar: 1 },
      { pertanyaan: "Sebelum memposting foto pesanan pelanggan, yang harus dipastikan?", pilihan: ["Pelanggan mengizinkan & tidak ada data pribadi yang terlihat", "Fotonya diberi filter paling terang", "Diposting tengah malam", "Tidak perlu apa-apa"], benar: 0 },
      { pertanyaan: "Rasio gambar feed Instagram yang umum?", pilihan: ["1:1 atau 4:5", "16:1", "1:10", "3:1"], benar: 0 },
      { pertanyaan: "Sebelum foto hasil kerja diunggah, sebaiknya…", pilihan: ["Langsung unggah apa adanya", "Dicek pembimbing/atasan dulu", "Diunggah di akun pribadi", "Diberi filter sebanyak-banyaknya"], benar: 1 },
      { pertanyaan: "Keterangan produk yang baik berisi…", pilihan: ["Hanya emoji", "Nama produk, bahan/ukuran, dan cara memesan", "Data pribadi pelanggan", "Kata-kata asal"], benar: 1 },
    ],
  },
];
