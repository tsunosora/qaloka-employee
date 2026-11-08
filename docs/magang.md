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
   **tugas mengingat**: dibuka pada *hari tugas* (setelan, bawaan Jumat), tepat waktu sampai Senin berikutnya, sesudahnya masih bisa
   diisi tapi ditandai terlambat. Isinya (1) tulisan dari ingatan, minimal 80 huruf, (2) maksimal
   5 soal acak dari bank soal pos itu (tetap per anak+minggu). Sekali kirim, tidak bisa diubah.
5. **Minggu Ini** — pos tiap anak, status tugas minggu ini/lalu, daftar *Perlu dinilai* (bisa disaring per pos;
   hanya peserta yang masih aktif). Pembimbing — dari dasbor ATAU dari halaman pribadinya (tab **Bimbingan**) —
   menilai isi ingatan + 4 aspek praktik (ketelitian, kecepatan, inisiatif, disiplin & sikap) skala
   1–4 + catatan yang tampil di HP anak.
6. **Rapor** — per anak: nilai akhir, aspek, pengalaman per pos (target belajarnya), catatan per
   minggu, kop nama usaha (setelan `nama_usaha`) dan kolom tanda tangan Pembimbing & Pimpinan. Tombol
   *Cetak / simpan PDF* (menu & kepala disembunyikan; cetakan SELALU terang walau tema layar gelap).

## Aturan (kode: `lib/services/magang/`)

| | |
|---|---|
| Rotasi (`rotasi.ts`) | Tiap anak memegang SEMUA pos sebelum mengulang. Pos yang belum dia pegang dipilih mulai dari "gilirannya" (indeks digeser urutan anak) supaya anak tidak berebut. Pos penuh → tetap ditaruh di pos paling longgar, ditandai **berbagi**. Anak masuk di tengah jalan disusun mulai minggu masuknya. Tanpa tanggal selesai = 13 minggu. |
| Nilai minggu (`nilai.ts`) | 30% kuis + 20% isi ingatan + 50% rata praktik (skala 1–4 → 0–100). Pos tanpa soal: bobot kuis pindah ke ingatan. Belum dinilai lengkap = kosong (bukan nol). |
| Predikat | ≥85 Sangat baik · ≥70 Baik · ≥55 Cukup · <55 Perlu bimbingan |
| Riwayat | Tugas menyimpan salinan soal + jawaban → menyunting/menghapus soal tidak mengubah nilai lama. Hapus pos = lunak (rapor tetap menyebut namanya). |
| Keamanan | Soal dikirim ke HP tanpa kunci; kunci diperiksa di server. Mode owner (`?owner=1`) hanya melihat — kirim tugas = 403. |

Tes: `tests/magang-*.test.ts`, `portal-tab-magang.test.ts`, `cetak-terang.test.ts`.
Migrasi (semuanya hanya MENAMBAH): `20261106000000_program_magang` (5 tabel), `20261107000000_magang_jurnal_pendaftaran`
(3 tabel), `20261108000000_magang_pembimbing_portal` (2 kolom nullable + FK).

## Jurnal harian & pendaftaran (7 Nov 2026)

- **Halaman pribadi anak** = `/<host>/me/<token>` (Magang → Peserta → *Tautan HP*). Tab Magang memuat
  kartu **Jurnal harian**: apa yang dikerjakan (≥20 huruf), kendala, foto hasil kerja (maks 3, diperkecil
  di HP, disimpan di `storage/magang`, hanya tersaji lewat rute ber-PIN/ber-login). Boleh diisi hari ini
  + 2 HARI KERJA ke belakang (Minggu & libur di tabel Holiday dilewati — sama dengan hitungan rapor); bisa disunting sampai dicek pembimbing. Selama tugas mengingat mingguan belum
  dikirim, riwayat jurnal TIDAK dikirim ke HP (supaya tulisan mingguan tetap dari ingatan).
- Pengawas mengecek jurnal di **Minggu Ini → Jurnal harian belum dicek** (komentar tampil di HP anak).
  Daftarnya satu baris terlipat PER ANAK (anak yang jurnal tertuanya paling lama menunggu di atas) dengan
  tombol *Tandai semua dicek* (`POST /api/magang/jurnal/cek`; ada kendala → konfirmasi dulu).
  Rapor: "jurnal terisi X dari Y hari kerja" (Senin–Sabtu, tanpa libur nasional) — kerajinan saja,
  tidak masuk nilai mingguan.
- **Akun anak**, dua jalur: (1) *Tambah peserta → Buat akun baru* — karyawan + peserta sekaligus,
  tautan HP langsung tersalin, anak membuat PIN saat pertama membuka; (2) *Tautan pendaftaran mandiri*
  `/daftar-magang/<kode>` (berlaku s.d. tanggal tertentu, bisa ditutup) — anak mengisi data + PIN,
  masuk `MagangPendaftar` "menunggu" (BUKAN karyawan: tidak makan kuota, tidak di Direktori/absensi)
  sampai pengawas **Setujui** (karyawan dibuat dengan token & PIN pendaftarannya) atau **Tolak** (alasan
  tampil saat anak membuka tautannya). Penahan kiriman 30/jam per IP (satu kelas bisa mendaftar dari
  WiFi yang sama).

## Pembimbing & perbaikan hasil simulasi (8 Nov 2026)

Simulasi penuh 13 minggu (laporan `D:\FAISAL\laporan-magang\`) menemukan 9 hal; semuanya diperbaiki di
`feat/magang` (satu commit per perbaikan, masing-masing dengan tes yang gagal di kode lama).

- **Pembimbing bekerja dari halaman pribadinya.** Karyawan yang menjadi pembimbing pos aktif mendapat tab
  **Bimbingan** di `/me/<token>`: anak di posnya minggu ini, *Perlu dinilai* (rubrik sama), *Jurnal belum
  dicek* per anak. Cakupan = HANYA pos yang dia bimbing (`lib/services/magang/pembimbing.ts`; pos lain → 404).
  Mode owner (`?owner=1`) hanya melihat (tulis = 403). Yang menilai/mengecek tercatat di
  `MagangTugas.dinilaiOlehKaryawanId` / `MagangJurnal.dicekOlehKaryawanId` (dasbor tetap `…OlehId` = akun);
  nama tampil lewat `namaPengurus()`. Tugas mengikuti POS-nya: ganti pembimbing → tugas lama yang belum dinilai
  pindah ke pembimbing baru. Pos dihapus/nonaktif → hanya bisa diurus dari dasbor.
- **Halaman pribadi peserta magang**: label "Halaman Peserta Magang" / "Peserta magang" (bukan "Karyawan");
  tab Lembur, Kunjungan, Klaim, Timesheet disembunyikan (`lib/services/portal/tab-portal.ts`). Ringkasan,
  Absensi, Penilaian, Poin, Izin tetap tampil — menunggu keputusan owner.
- **Kartu nilai di HP**: "Kuis 2 dari 5 benar", rubrik *Isi tulisanmu*, predikat.
- **Pos contoh** berisi 5 soal per pos (dulu 3 → anak hanya dapat 3 soal). Situs yang sudah memasangnya tetap.
- **Pesan pendaftar ditolak** diberi tanda baca (`pesanDitolak()`).
- **Cetak selalu terang**: blok `@media print` di `app/globals.css` menimpa token tema (berlaku semua halaman).
- Penahan pendaftaran (30/jam per IP) ada di memori proses — cukup untuk satu instalasi; hilang saat restart.

## Hari tugas mengingat bisa diatur (8 Nov 2026)

- **Minggu Ini → Setelan tugas mengingat**: pilih Senin–Sabtu (tersimpan begitu dipilih; `PUT /api/magang/setelan`,
  minimal Manajer). Disimpan di `Setting` kunci `magang_hari_tugas` (`"1"`…`"6"`). Kosong/tak sah = **Jumat**
  → instalasi lain tidak berubah. Tanpa migrasi.
- Aturan (`nilai.ts`: `jendelaTugas`/`keadaanJendela(senin, hari, hariTugas)`): buka = Senin minggu itu + (hari − 1);
  batas tepat waktu TETAP Senin berikutnya (Sabtu → Sabtu, Minggu, Senin; Selasa = terlambat). Minggu tugas tetap
  Senin minggu itu (Sabtu/Minggu ikut minggu rotasi yang sama). Ikut setelan: pembukaan di HP anak, kiriman (400
  "dibuka mulai hari …"), status Minggu Ini ("Dibuka Sabtu"), penahan riwayat jurnal, teks HP & dasbor.
- Tes: `tests/magang-hari-tugas.test.ts`.
- Voliko memakai **Sabtu** (permintaan Faisal).
