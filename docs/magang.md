# Program Magang / PKL

Menu **Magang** (paket Kinerja, kode fitur `hr.assessment`). Tujuannya: anak magang/PKL bergiliran
memegang semua pos kerja, dan tiap akhir minggu mengingat kembali apa yang dipelajari sebagai
bahan penilaian — supaya di akhir magang dia punya pengalaman nyata + rapor untuk melamar kerja.

## Alur

1. **Pos & Soal** — pos kerja yang dirotasi. Kosong? tombol *Pakai contoh pos percetakan* mengisi
   7 pos (pengetahuan umum, bisa disunting). Tiap pos: lama (1 atau 2 minggu), target belajar
   (tampil di HP anak), pembimbing, kapasitas, bank soal pilihan ganda.
2. **Peserta** — anak didaftarkan dulu di **Direktori** (supaya punya halaman pribadi `/me/<token>`
   + PIN), lalu ditambahkan di sini dengan tanggal mulai & selesai.
3. **Rotasi Pos** — *Susun rotasi* mulai minggu tertentu. Penugasan sebelum minggu itu tidak
   berubah; sesudahnya disusun ulang. Klik blok untuk mengganti pos/lama satu penugasan.
4. **Halaman pribadi anak → tab Magang** — pos minggu ini + target, pos berikutnya, jadwal, dan
   **tugas mengingat**: dibuka Jumat, tepat waktu sampai Senin berikutnya, sesudahnya masih bisa
   diisi tapi ditandai terlambat. Isinya (1) tulisan dari ingatan, minimal 80 huruf, (2) maksimal
   5 soal acak dari bank soal pos itu (tetap per anak+minggu). Sekali kirim, tidak bisa diubah.
5. **Minggu Ini** — pos tiap anak, status tugas minggu ini/lalu, daftar *Perlu dinilai*. Pembimbing
   menilai isi ingatan + 4 aspek praktik (ketelitian, kecepatan, inisiatif, disiplin & sikap) skala
   1–4 + catatan yang tampil di HP anak.
6. **Rapor** — per anak: nilai akhir, aspek, pengalaman per pos (target belajarnya), catatan per
   minggu. Tombol *Cetak / simpan PDF* (menu & kepala disembunyikan saat dicetak).

## Aturan (kode: `lib/services/magang/`)

| | |
|---|---|
| Rotasi (`rotasi.ts`) | Tiap anak memegang SEMUA pos sebelum mengulang. Pos yang belum dia pegang dipilih mulai dari "gilirannya" (indeks digeser urutan anak) supaya anak tidak berebut. Pos penuh → tetap ditaruh di pos paling longgar, ditandai **berbagi**. Anak masuk di tengah jalan disusun mulai minggu masuknya. Tanpa tanggal selesai = 13 minggu. |
| Nilai minggu (`nilai.ts`) | 30% kuis + 20% isi ingatan + 50% rata praktik (skala 1–4 → 0–100). Pos tanpa soal: bobot kuis pindah ke ingatan. Belum dinilai lengkap = kosong (bukan nol). |
| Predikat | ≥85 Sangat baik · ≥70 Baik · ≥55 Cukup · <55 Perlu bimbingan |
| Riwayat | Tugas menyimpan salinan soal + jawaban → menyunting/menghapus soal tidak mengubah nilai lama. Hapus pos = lunak (rapor tetap menyebut namanya). |
| Keamanan | Soal dikirim ke HP tanpa kunci; kunci diperiksa di server. Mode owner (`?owner=1`) hanya melihat — kirim tugas = 403. |

Tes: `tests/magang-rotasi.test.ts`, `magang-nilai.test.ts`, `magang-rapor.test.ts`.
Migrasi: `20261106000000_program_magang` (hanya menambah 5 tabel).

## Jurnal harian & pendaftaran (7 Nov 2026)

- **Halaman pribadi anak** = `/<host>/me/<token>` (Magang → Peserta → *Tautan HP*). Tab Magang memuat
  kartu **Jurnal harian**: apa yang dikerjakan (≥20 huruf), kendala, foto hasil kerja (maks 3, diperkecil
  di HP, disimpan di `storage/magang`, hanya tersaji lewat rute ber-PIN/ber-login). Boleh diisi hari ini
  + 2 hari ke belakang; bisa disunting sampai dicek pembimbing. Selama tugas mengingat mingguan belum
  dikirim, riwayat jurnal TIDAK dikirim ke HP (supaya tulisan mingguan tetap dari ingatan).
- Pengawas mengecek jurnal di **Minggu Ini → Jurnal harian belum dicek** (komentar tampil di HP anak).
  Rapor: "jurnal terisi X dari Y hari kerja" (Senin–Sabtu, tanpa libur nasional) — kerajinan saja,
  tidak masuk nilai mingguan.
- **Akun anak**, dua jalur: (1) *Tambah peserta → Buat akun baru* — karyawan + peserta sekaligus,
  tautan HP langsung tersalin, anak membuat PIN saat pertama membuka; (2) *Tautan pendaftaran mandiri*
  `/daftar-magang/<kode>` (berlaku s.d. tanggal tertentu, bisa ditutup) — anak mengisi data + PIN,
  masuk `MagangPendaftar` "menunggu" (BUKAN karyawan: tidak makan kuota, tidak di Direktori/absensi)
  sampai pengawas **Setujui** (karyawan dibuat dengan token & PIN pendaftarannya) atau **Tolak** (alasan
  tampil saat anak membuka tautannya). Penahan kiriman 30/jam per IP (satu kelas bisa mendaftar dari
  WiFi yang sama).
