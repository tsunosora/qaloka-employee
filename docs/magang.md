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
- Voliko memakai **Sabtu** (permintaan Faisal): `f1c2349` terdeploy 8 Nov 15.38 (skrip `~/alat/deploy-rms-haritugas-20261108.sh`),
  setelan dipasang 15.38.57 lewat `PUT /api/magang/setelan` sebagai admin (`~/alat/setel-hari-tugas-sabtu-20261108.sh`).
  Exindo tetap bawaan Jumat (belum dideploy).

## Absen dari HP lewat halaman pribadi (9 Nov 2026)

- Fitur absen HP (add-on `hr.absen_hp`: foto kamera depan diperkecil, GPS + akurasi ≤150 m, BANYAK lokasi dengan
  radius per lokasi, satu HP per orang, opsional QR) SUDAH ADA sejak 13 Okt di `/absen/<token>` — dinyalakan PER
  KARYAWAN di **Setelan → Absen HP**. Yang baru (`feat/absen-hp-portal`): halaman pribadi `/me/<token>` menampilkan
  kartu **Absen masuk / pulang** di atas tab (untuk semua karyawan yang absen HP-nya menyala, termasuk peserta
  magang; tidak tampil di mode owner) → membuka `/absen/<token>` dengan sesi PIN yang sama (tanpa PIN ulang);
  halaman absen punya tombol **Halaman pribadi** kembali (hanya bila lisensi memuat `hr.portal`).
- Absen HP = baris `Attendance` `machineName "hp"` + `AbsenHpBukti` (foto, titik, jarak, lokasi); masuk/pulang
  ditetapkan `relabelDeviceScans()` bersama scan mesin Fingerspot → alur mesin tidak berubah. Di luar radius:
  ditolak, atau (setelan `absen_hp_luar_lokasi`, bawaan boleh) jadi pengajuan yang menunggu persetujuan
  (Absensi → Absen di luar lokasi). Foto bukti per tanggal: Setelan → Absen HP.
- **Ringkasan/Absensi halaman pribadi** tidak lagi menghitung hari SEBELUM masa magang (`MagangPeserta.mulai`
  paling awal; karyawan biasa: `joinDate`) sebagai tidak hadir — `lib/services/portal/awal-hitung.ts`,
  tes `tests/portal-awal-hitung.test.ts`. Rekap dasbor admin belum memakai aturan ini.
- Voliko (9 Nov): absen HP dinyalakan untuk 4 peserta (cadangan `~/cadangan/absen-hp-magang-20261109/`, skrip
  `~/alat/nyalakan-absen-hp-magang-20261109.sh`). Lokasi terdaftar: **Toko Pusat** (radius 100 m, dari 18 Okt).
  Lokasi cabang BELUM: tidak ada koordinat sah di sistem (`company_branches` POS: Imogiri & Sewon tanpa
  lat/lng) → Faisal menambahkannya di Setelan → Absen HP → *Lokasi saya* sambil berdiri di cabang.
- **Terdeploy ke Voliko 9 Nov 11.01** (`509e919`, skrip `~/alat/deploy-rms-absenportal-20261109.sh`, log `.log` di
  sebelahnya, cadangan `~/cadangan/deploy-rms-20261109-110118/`). Diperiksa: `/me`, `/absen`, portal API 200;
  peserta mendapat `absenHp: true`; poller Fingerspot tetap jalan.
- **Perbaikan foto + log penolakan terdeploy 9 Nov 11.23** (`f77dedb`, `fix/absen-hp-foto`; skrip
  `~/alat/deploy-rms-absenfoto-20261109.sh`, cadangan `~/cadangan/deploy-rms-20261109-112304/`). Pemicu: Yufita "foto tidak
  diterima" tanpa jejak apa pun di server. Foto kini diperkecil lewat 3 jalan (bitmap → `<img>` → berkas asli ≤6 MB); HEIC,
  foto besar & sesi PIN habis punya pesan sendiri. **Penolakan tercatat** di `~/.pm2/logs/ratemystaff-error-12.log`
  (`grep "absen-hp] TOLAK"`: karyawan, kode, jarak, akurasi, ukuran/jenis foto — tanpa koordinat/token). Diuji di
  produksi dengan kiriman id-perangkat tak sah (tercatat, tidak ada yang ditulis). Lokasi aktif: Voliko Pusat & Voliko Cabang.

## Side quest, sekolah & rombongan baru (9 Nov 2026, `feat/magang-sidequest` — terdeploy ke Voliko 14.52)

Dasar: dokumen *Materi Internship* Faisal (9 Nov). Tugas UTAMA (rotasi, waktu terbanyak) = **Konten** & **Produksi**;
**Customer Service** & **Desain Grafis** (prioritas menengah) dan **Digital Marketing** (rendah) = SIDE QUEST wajib
yang dikerjakan sepanjang magang. Kewajiban foto & video tiap produk jadi tetap berlaku (baris di tiap pos).

- **Side quest** (`lib/services/magang/misi.ts`, `misi-db.ts`, tabel `MagangMisi` + `MagangMisiKiriman`): menu
  **Magang → Side Quest** — bank misi (judul, deskripsi, kategori `cs|desain|marketing`, level dasar/menengah/lanjut,
  bukti foto/tautan/tulisan, poin, aktif) + antrean *Perlu diperiksa* (saring sekolah). Kosong → *Pakai bank misi awal*
  (`contoh-misi.ts`: CS 7, Desain 7 termasuk tugas akhir **jersey fantasy**, Marketing 5 = 19 misi, tanpa harga/kebijakan).
  Misi aktif berlaku untuk SEMUA peserta tanpa baris penugasan → peserta baru otomatis mendapatnya. Anak mengirim bukti
  dari `/me/<token>` tab Magang (kartu Side Quest, foto diperkecil di HP, maks 3); satu baris per anak per misi:
  menunggu → disetujui (terkunci) / ditolak + catatan (anak memperbaiki, `kirimKe` naik). Diputus dari dasbor ATAU tab
  **Bimbingan** (semua pembimbing pos aktif boleh — side quest bukan pos; mode owner baca saja). Progres x/y per kategori
  + poin di Minggu Ini & rapor. Side quest TIDAK mengubah nilai akhir (rapor menyebutnya). Tautan hanya http(s).
- **Sekolah**: `MagangPeserta`/`MagangPendaftar` + `guruPembimbing`, `kontakGuru`; `MagangDaftar.sekolah` = tautan
  pendaftaran khusus satu sekolah/rombongan (formulir terkunci; server memakai sekolah tautan). Nama sekolah dikelompokkan
  tanpa peduli huruf besar/spasi (`sekolah.ts` — data Voliko memuat 3 tulisan untuk satu sekolah). Saringan sekolah di
  Minggu Ini, Peserta, Rotasi, antrean Side Quest; **Cetak rapor per sekolah** (`/magang/rapor/sekolah`, satu anak per
  halaman, isi rapor = komponen `RaporIsi` yang sama dengan rapor per anak).
- **Rotasi rombongan baru**: `POST /api/magang/rotasi {dari, mode:"baru", pesertaIds?}` → HANYA anak tanpa jadwal sejak
  `dari` (atau yang dicentang) yang disusun; jadwal anak lain tidak berubah & ikut dihitung sebagai isi pos (kapasitas
  dihormati). UI Rotasi Pos: *Tambah peserta baru saja* vs *Susun ulang semua…* (konfirmasi). Aturan "semua pos sebelum
  mengulang" tetap; bila semua pos yang belum dipegang penuh → tetap `berbagi` (banner peringatan). Simulasi: 5 pos ×
  2 mgg × kap 3 menampung 12 anak dari 3 rombongan (mulai 16 Nov, 7 Des, 4 Jan) tanpa berbagi; kap 2 → 17 blok berbagi.
- **Lokasi pos**: `MagangPos.lokasi` (label, mis. "Voliko Sport"). Lokasi tim Pusat/Cabang tetap di catatan peserta.
- **Pos prioritas** (`lib/services/magang/pos-prioritas.ts`, semua 2 minggu, kap 3, 8–9 soal): Konten: Shooting &
  Talent · Konten: Editing, Copywriting & Posting · Produksi: Voliko Print · Produksi: Voliko Sport (lokasi Voliko Sport)
  · Runner & Stok.
- **Skrip data Voliko** `tools/magang/voliko-pos-prioritas.ts` (`npx tsx …` di folder app; DRY-RUN bawaan, `--jalankan`
  untuk menulis; perlu migrasi sudah terpasang; cadangan JSON dulu; satu transaksi tanpa DDL): buat 5 pos + soal (bila
  belum ada), NONAKTIFKAN (tidak hapus) Customer Service/Desainer/Operator Outdoor/Operator A3+, susun ulang penugasan
  4 anak mulai Senin 16 Nov (minggu Orientasi 9–14 Nov tidak disentuh; batal bila ada tugas/jurnal ≥ 16 Nov). Orientasi
  dibiarkan aktif → nonaktifkan sebelum *Susun ulang semua*, atau pakai *Tambah peserta baru*.
- **Deploy** `tools/magang/deploy-sidequest-voliko.sh <SHA>` (cadangan DB+.env+storage, ff-only dari f77dedb, migrasi,
  build, restart `ratemystaff` saja). Migrasi `20261109000000_magang_sidequest_sekolah` hanya MENAMBAH (2 tabel, 6 kolom nullable + 1 indeks).
- Tes: `magang-misi`, `magang-rotasi-rombongan`, `magang-sekolah`, `magang-pendaftaran-sekolah`, `magang-pos-prioritas`,
  `magang-sidequest-ui`, `portal-side-quest`.

### Deploy Voliko 9 Nov 2026 (izin Faisal)

- **14.51–14.52** `~/web/rate-my-staff` `f77dedb` → **`0a179c3`** (ff-only; skrip `~/alat/deploy-rms-sidequest-20261109.sh` + `.log`,
  dijalankan `setsid nohup`; cadangan `~/cadangan/deploy-rms-20261109-145127` 51 tabel 5,5 MB + .env + storage). Lockfile sama →
  npm ci dilewati; migrasi `20261109000000_magang_sidequest_sekolah` terpasang; build OK (18 peringatan Turbopack = sama seperti
  sebelumnya); restart `ratemystaff` saja (poller tidak berubah, tidak di-restart). Log galat tidak bertambah.
- Diperiksa: /login, /me, /absen 200; `/magang/misi` & `/magang/rapor/sekolah` ada di build; absensi hari ini (16 baris, 4 HP) dan
  jurnal (2) identik sebelum/sesudah; webhook Fingerspot hidup (GET 405), scan mesin terakhir 13.20 WIB (sebelum deploy) — scan
  pulang belum terlihat saat dicek 15.00.
- **14.59 skrip pos prioritas** (`npx tsx tools/magang/voliko-pos-prioritas.ts`, dry-run dulu → `--jalankan`; log
  `~/alat/voliko-pos-prioritas-{dryrun-,}20261109.log`, cadangan `~/cadangan/magang-pos-prioritas-20261109-145944/`): pos baru
  id 13–17 aktif, pos 9–12 (CS, Desainer, Operator Outdoor, Operator A3+) nonaktif (tidak dihapus), Orientasi (id 8) TETAP aktif;
  4 penugasan Orientasi 9–14 Nov dipertahankan, 40 penugasan lama ≥16 Nov diganti 40 baru (0 berbagi). Tidak ada tugas/jurnal ≥16 Nov.
- **15.00 bank side quest + sekolah** (`~/alat/voliko-misi-sekolah-20261109.ts` + `.log`, cadangan
  `~/cadangan/magang-misi-sekolah-2026-11-09T07-59-55-430Z/`): 19 misi (CS 7, Desain 7, Marketing 5); `MagangPeserta.sekolah`
  peserta #2 & #4 dirapikan jadi "SMK Negeri 2 Sewon" (hanya kolom itu; pendaftar & jurusan tidak disentuh).
- Verifikasi API portal (sesi 5 menit, GET saja; `~/alat/verifikasi-sidequest-20261109.sh` + `.log`): keempat anak posIni Orientasi,
  berikut = pos 16 Nov sesuai jadwal, hari tugas Sabtu, 19 misi 0/7·0/7·0/5; Bimbingan Faisal: 6 pos, 0 bukti menunggu.
- **Ingat:** Orientasi masih aktif → sebelum "Susun ulang semua", nonaktifkan dulu; untuk anak baru pakai "Tambah peserta baru saja".

## Kategori side quest diatur admin + lampiran izin (`feat/magang-kategori-izin` — terdeploy ke Voliko 9 Nov 17.51)

- **Kategori side quest** = tabel `MagangMisiKategori` (`kunci` tetap, `nama`, `ringkas`, `prioritas`, `urutan`, `aktif`).
  `MagangMisi.kategori` tetap teks kunci, kini FK ke `kunci` (ganti nama tidak mengubah kunci; hapus diblokir selama dipakai,
  termasuk misi yang sudah dihapus lunak). Migrasi `20261110000000_magang_misi_kategori`: buat tabel, `INSERT IGNORE` 3 kategori
  lama (cs/desain/marketing, urutan 1–3) + kunci lain yang sudah dipakai misi (urutan 99), lebarkan kolom kategori 20→40, lalu
  FK. Data misi/kiriman tidak berubah (diuji: checksum 20 misi sama sebelum/sesudah). `KATEGORI_AWAL` hanya untuk bank awal.
- UI: Magang → Side Quest → **Kategori** (tambah, ganti nama, urutkan naik/turun, aktif/nonaktif, hapus; bila dipakai →
  "Nonaktifkan saja" atau "Pindahkan misinya ke…" lalu hapus). Kategori nonaktif = misinya tidak tampil di HP & tidak dihitung
  progres (sama seperti misi nonaktif). Dropdown form misi, chip Minggu Ini, rapor, HP anak, Bimbingan ikut tabel. Tingkat
  (Dasar/Menengah/Lanjut) tetap. API: `/api/magang/misi/kategori` (GET/POST), `[id]` (PATCH/DELETE→409 `{dipakai}`),
  `[id]/pindah {ke}`, `urutan {ids}`.
- **Lampiran izin** (`LeaveLampiran`, migrasi `20261110010000_izin_lampiran`, `lib/services/leave/lampiran.ts`): di `/me` tab Izin
  (karyawan & peserta magang) 1–3 berkas per pengajuan — foto diperkecil di HP jadi JPEG (helper absen HP; HEIC yang tak bisa
  dibaca browser → pesan ramah) atau PDF, maks 5 MB/berkas. Tambah/hapus lampiran selama masih menunggu. Server memeriksa isi
  (byte JPG/PNG/WebP/`%PDF-`), nama acak di `storage/izin/YYYY-MM/` (mode 0600, ikut tar cadangan deploy), pengaman path.
  Akses: pemilik (sesi PIN; mode owner baca saja) + akun dasbor yang boleh memutus izin (`requireManager`) — tidak ada URL
  publik. Dasbor Izin: lencana "N lampiran", gambar mini + pratinjau, "Unduh PDF". Batas body proxy Next 10 MB → HP mengunggah
  bertahap ≤9 MB (pengajuan + tambahan). Pembatalan izin hanya mengubah status — lampiran tetap sebagai bukti. Formulir izin
  publik (tautan) belum menerima lampiran.
- Deploy: `tools/magang/deploy-kategori-izin-voliko.sh <SHA>` (ff-only dari `0a179c3`, cadangan DB+.env+storage, migrasi, build,
  restart `ratemystaff` saja, banding hitungan misi per kategori & izin sebelum/sesudah).
- Tes: `magang-misi-kategori`, `leave-lampiran` (+ pembaruan `magang-misi`, `magang-sidequest-ui`).

### Deploy Voliko 9 Nov 2026 17.51 (izin Faisal)

- `~/web/rate-my-staff` `0a179c3` → **`abc2ee0`** (ff-only; `setsid nohup` skrip `~/alat/deploy-rms-kategori-izin-20261110.sh` + `.log`;
  cadangan `~/cadangan/deploy-rms-20261109-175104` 53 tabel 5,6 MB + .env + storage). Lockfile sama (npm ci dilewati); migrasi
  `20261110000000_magang_misi_kategori` + `20261110010000_izin_lampiran`; build OK (20 peringatan Turbopack: +2 dari akses berkas
  dinamis `lib/services/leave/lampiran.ts`, jenis sama dengan absen-hp); restart `ratemystaff` saja (restart 7; poller tak disentuh).
- Diperiksa (`~/alat/verifikasi-kategori-izin-20261110.sh` + `.log`, tanpa menulis): hitungan magang/izin sebelum = sesudah; 3 kategori
  (cs/desain/marketing, Menengah/Menengah/Rendah, urutan 1–3); checksum misi per kategori identik (7/7/5), kiriman 0; 4 anak melihat
  19 misi; kiriman berkas .txt → 422 "tidak bisa dipakai", LeaveRequest/LeaveLampiran/`storage/izin` tetap 2/0/0; lampiran tanpa sesi
  401, dasbor tanpa login 302; /me /absen /login 200; log galat tidak bertambah; absensi hari ini (Fingerspot 16, HP 7) & jurnal (4)
  identik. Unggah lampiran SAH sengaja tidak diuji di produksi (akan membuat pengajuan sungguhan + notifikasi manajer; tidak ada rute
  hapus pengajuan) — diuji di DB uji lokal.

## Pantauan guru sekolah (feat/magang-pantau-guru — BELUM dideploy)

Guru pembimbing dari sekolah memantau anak sekolahnya sendiri lewat tautan + PIN, **hanya melihat**.

- **Model** `MagangPantau` (migrasi `20261111000000_magang_pantau_guru`, hanya MENAMBAH satu tabel): `sekolahKunci`
  (= `kunciSekolah()`), `sekolahLabel`, `token` unik (32 bita acak base64url), `pinHash` (bcrypt, PIN 6–8 angka dari admin),
  `aktif`, `kedaluwarsa` (opsional, berlaku s.d. akhir hari itu), `tampilLampiranIzin` (bawaan mati), `terakhirDibukaAt`,
  `dibukaKali`, `dicabutAt`, `dibuatOlehId` (User, SetNull). Kolom tambahan `kunciAktif` (unik; = sekolahKunci selama aktif,
  NULL sesudah dicabut) menjamin **satu tautan aktif per sekolah** di tingkat DB.
- **Admin** Magang → **Sekolah** (`/magang/sekolah`, `requireManager`): sekolah dari semua peserta (aktif & nonaktif) dikelompokkan
  `daftarSekolah()` — jumlah anak, rentang mulai–selesai, nama guru pembimbing, *Cetak rapor sekolah*. Panel tautan: buat (PIN
  ditampilkan sekali, kedaluwarsa terisi tanggal selesai terakhir, centang lampiran), salin tautan, dibuka N× / terakhir, ubah tanggal,
  nyalakan/matikan lampiran, ganti PIN, **ganti tautan** (cabut + buat baru, PIN tetap), **cabut**. API: `GET/POST /api/magang/pantau`,
  `PATCH /api/magang/pantau/[id] {pin?, kedaluwarsa?, tampilLampiranIzin?}`, `POST …/[id]/cabut`, `POST …/[id]/ganti {pin?}`.
  pinHash tidak pernah dikirim; token penuh hanya ke manajer.
- **Guru** `/pantau/<token>` (bebas login di `proxy.ts`; lisensi `hr.assessment`): layar PIN → kepala (sekolah + nama usaha) →
  saringan tanggal (bawaan awal magang → hari ini; *Semua / Minggu ini / Bulan ini* / tanggal bebas) → kartu anak (pos minggu ini +
  lokasi, kehadiran %, jurnal x/y, side quest x/y) → detail (`#anak-<id>`, tombol Kembali peramban bekerja) dengan bagian terlipat:
  Ringkasan (+ nilai per pos), Absensi (masuk/pulang, status, sumber HP/Mesin; HP: nama lokasi + jarak + foto), Jurnal (+ komentar
  pembimbing, foto), Izin & sakit (lampiran hanya bila diizinkan), Pos & jadwal, Tugas mengingat (nilai, predikat, terlambat, catatan
  pembimbing — BUKAN tulisan/jawaban kuis anak), Side quest (per kategori + judul misi disetujui, TANPA poin). Foto → lightbox.
  *Cetak rekap anak* / *Cetak rekap sekolah* (satu anak per halaman, terang, tanpa foto) → simpan PDF lewat peramban.
- **Rute publik** `/api/public/pantau/<token>`: `GET` (status), `POST masuk {pin}`, `POST keluar`, `GET anak?dari&sampai`,
  `GET anak/[id]?dari&sampai`, berkas `anak/[id]/absen-foto/[buktiId]`, `anak/[id]/jurnal/[jurnalId]/foto/[n]`,
  `anak/[id]/izin/[izinId]/lampiran/[lampiranId]`. Halaman `/pantau/<token>` selalu 200 (token tak berlaku → layar "Tautan tidak berlaku").
- **Kehadiran %** (`pantau.ts hariKerjaAnak/hitungKehadiran`): hari kerja dari max(dari, mulai) s.d. min(sampai, hari ini, selesai),
  Senin–Sabtu tanpa Holiday (aturan rapor/jurnal); hari sebelum mulai tidak dihitung; hari ini yang belum ada absen/izin belum dihitung;
  absen di hari Minggu/libur ditampilkan "hadir (tidak dihitung)". Status per hari dari `aggregateAttendance` (laporan yang sama dengan
  dasbor); karyawan nonaktif → dari scan mentah. Rekap dasbor admin tidak berubah.
- **Keamanan**
  - Token tak dikenal / dicabut / kedaluwarsa → 404 dengan pesan SAMA ("Tautan tidak berlaku. Minta tautan baru ke admin.").
  - Cookie `rms_pantau` HttpOnly, SameSite=Lax, Secure di produksi, Path=/, 8 jam, HMAC(AUTH_SECRET) atas `{id, sidik token, sidik
    pinHash, exp}`. Tiap permintaan memeriksa ulang DB: aktif, tidak dicabut, tidak kedaluwarsa, sidik token & PIN cocok → cabut /
    ganti tautan / ganti PIN langsung mematikan sesi lama. Satu cookie per peramban (dua sekolah di peramban yang sama saling menimpa).
  - Penahan PIN di **memori proses** (seperti `lib/rate-limit.ts`; hilang saat restart, cukup untuk satu instalasi PM2): 5 salah per
    token+IP → 15 menit, plus batas 20 salah per token dari semua IP.
  - Cakupan: anak = `sekolahSama(peserta.sekolah, sekolahKunci)` DAN karyawan tidak dihapus; id anak sekolah lain → 404; berkas
    diperiksa milik anak itu → 404. Respons: `Cache-Control: no-store, private`, `X-Robots-Tag: noindex`, `nosniff`; halaman
    `robots noindex`. Masuk/keluar boleh saat lisensi hanya-baca (seperti sesi portal).
  - TIDAK pernah dikirim ke guru: nomor HP, publicToken, PIN/portalPin, kode karyawan/PIN mesin, gaji/upah, poin, karyawan lain,
    catatan internal peserta, kontak guru, koordinat/perangkat/akurasi absen HP. Serializer menyusun objek baru dari medan yang diizinkan.
- **Tes**: `tests/magang-pantau.test.ts` (cakupan antarsekolah & varian nama, tautan dicabut/kedaluwarsa/ganti, cookie token/PIN lama,
  penahan PIN, kehadiran tanpa hari sebelum mulai/Minggu/libur, rute memeriksa sesi + cakupan, lisensi/proxy) dan
  `tests/magang-pantau-serial.test.ts` (tidak ada kunci terlarang di JSON guru).
- **Deploy**: `tools/magang/deploy-pantau-guru-voliko.sh <SHA>` (ff-only dari `abc2ee0`, cadangan DB+.env+storage, migrasi, build,
  restart `ratemystaff` saja; hitungan data magang sebelum = sesudah; MagangPantau = 0; curl `/api/public/pantau/tidak-ada` → 404).
