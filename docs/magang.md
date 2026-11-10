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

## Pantauan guru sekolah (feat/magang-pantau-guru — terdeploy ke Voliko 10 Nov 00.46)

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

### Deploy Voliko 10 Nov 2026 00.45–00.46 (izin Faisal)

- `~/web/rate-my-staff` `abc2ee0` → **`da81381`** (ff-only, `setsid nohup` `~/alat/deploy-rms-pantau-guru-20261110.sh` + `.log`; cadangan
  `~/cadangan/deploy-rms-20261110-004531` 55 tabel 5,6 MB + .env + storage). Lockfile sama; migrasi `20261111000000_magang_pantau_guru`;
  build OK (20 peringatan Turbopack); restart `ratemystaff` saja (restart 8; poller tak berubah, tak di-restart). `6dc0d91` TIDAK ikut.
- Diperiksa: log galat kosong; /login, /me, /absen 200; `/pantau/<palsu>` 200 tanpa nama anak/sekolah, `X-Robots-Tag: noindex`,
  `Cache-Control: no-store`; API `/api/public/pantau/<palsu>` (status, masuk PIN, anak, anak/1) → 404 "Tautan tidak berlaku…" sama semua;
  halaman Magang → Sekolah ada di build (`/magang/sekolah` → login); hitungan magang/izin sebelum = sesudah; rotasi 7 anak (80 blok),
  jurnal, absensi 9 Nov (Fingerspot 22, HP 8) identik; MagangPantau = 0 (tautan guru dibuat Faisal sendiri). Webhook Fingerspot hidup
  (GET 405); deploy tengah malam → scan baru belum ada, cek pagi.

## Jadwal konten (feat/magang-jadwal-konten — terdeploy ke Voliko 10 Nov 16.13)

Meniru sheet pembina konten (kolom NO, TANGGAL, JUDUL POSTINGAN, KLASIFIKASI KONSEP, REF, STATUS, CODE, NAMA PKL, CAPTION,
LINK FOLDER FOOTAGE, LINK EKSPOR KONTEN; baris Senin–Sabtu, pemisah kuning tiap Minggu; panel kiri catatan & brief).

- **Model** (migrasi `20261112000000_magang_jadwal_konten`, hanya MENAMBAH: 5 tabel + `MagangPeserta.kodeKonten` nullable unik;
  4 status bawaan `INSERT IGNORE`): `MagangKontenKonsep` (`kunci` tetap, `nama` + `sub` → "ENTERTAIMENT (SITKOM)" — ejaan pembina
  disimpan apa adanya, `warna` = kunci palet/hex, `referensi` [{label,url}]), `MagangKontenStatus` (`anakBoleh` = anak boleh memilih,
  `final` = dihitung selesai & hanya pembina; bawaan Belum take / Sudah take / Editing / Selesai-Diposting), `MagangKontenGrup` +
  `MagangKontenGrupAnggota` (terpisah dari tim rotasi; `urutan` = giliran hari grup), `MagangKonten` (satu baris = satu konten:
  anak ATAU grup ATAU belum dibagi, `usulan`, `urutan` untuk >1 baris/hari, `selesaiAt` diisi saat status final, pengubah akun/karyawan).
  Catatan & brief = Setting `magang_konten_brief` (JSON drive/catatan/font/preset/caption/hashtag, zod `briefSchema`); pola hari =
  Setting `magang_konten_pola` (bawaan Sen SITKOM, Sel FLEXING, Rab SITKOM, Kam FLEXING, Jum TALK, Sab FLEXING, EMPATHY tiap 14 hari).
- **Dasbor** Magang → **Jadwal Konten** (`/magang/konten?bulan=YYYY-MM`, `requireManager`): tabel padat (kepala & kolom NO/TANGGAL
  lengket, gulir ke samping), sunting di sel (Enter/keluar = simpan, Esc = batal; tampil seketika, dibatalkan bila server menolak),
  pilihan konsep/status/CODE ("1 · panggilan", "GRUB A") berupa daftar berwarna + teks, tautan sebagai chip (`noopener`), NAMA PKL dari
  kode/anggota grup, tambah baris per tanggal, hapus (konfirmasi), saringan anak/grup/status, legenda kode & grup, lencana **Usulan** +
  *Tandai disetujui* / *Setujui semua usulan*. Panel *Catatan & brief* (bawaan tampil di layar ≥1536 px; tombol tampil/sembunyi):
  drive, note, font, preset, referensi per konsep, caption + hashtag dengan *Salin caption*. **Setelan**: konsep, status, grup + anggota,
  kode anak (unik, tukar kode aman), pola hari.
- **Generator** `susunBulan()` (`lib/services/magang/konten.ts`, *Buat jadwal bulan berikut* → pratinjau → simpan): Senin–Sabtu;
  Minggu & Holiday dilewati tanpa memakan giliran; kode anak melanjutkan kode terakhir sebelum bulan itu (berputar); Sabtu yang jatuh
  ≥ EMPATHY terakhir + selang → hari grup untuk grup berikutnya (hari grup tidak memakan giliran anak; Sabtu libur → Sabtu berikutnya;
  tanpa riwayat → Sabtu kedua, grup pertama). Bawaan hanya mengisi tanggal kosong (tanggal terisi ikut memajukan giliran → tanpa
  duplikat); *Ganti* menghapus baris yang BELUM dikerjakan saja (status awal, semua isian kosong). Baris baru: Belum take, usulan.
- **HP anak** (`/me/<token>` tab Magang, kartu **Jadwal Konten** di bawah pos minggu ini): *Konten hari ini* + pengingat ("Hari ini jadwal
  kontenmu — <note>"), konsep, catatan pembina, referensi, font/preset/drive, caption (*Salin caption*); anak mengisi judul, link footage,
  link ekspor, dan status `anakBoleh`. Status final tampil "Divalidasi pembina" (terkunci). Daftar *Berikutnya* / *Sebelumnya* (4 minggu
  ke belakang – 6 minggu ke depan). Rute `GET/PATCH /api/public/portal/<token>/magang/konten[/id]`: hanya baris kode sendiri / grupnya
  (lainnya 404), mode owner baca saja (403), status final / bukan anakBoleh → 403, baris final → 409, tautan hanya http(s).
- **Pantau guru**: detail anak menampilkan "Konten: x selesai dari y terjadwal" (hitungan saja, tanpa tautan).
- **Impor Voliko** `tools/magang/voliko-jadwal-konten.ts` (data: `tools/magang/data/voliko-konten-nov2026.ts`): `TZ=Asia/Jakarta npx tsx
  tools/magang/voliko-jadwal-konten.ts` = DRY RUN (cetak tabel), `--jalankan` = cadangan JSON (`--cadangan=`, bawaan
  `~/cadangan/magang-konten-<waktu>`) lalu satu transaksi tanpa DDL. Batal bila migrasi belum ada / id+panggilan anak tidak cocok / kode
  dipegang anak lain. Idempoten (konsep/status per kunci, grup per nama, kode hanya bila kosong/sama, brief hanya bila belum ada, baris
  (tanggal, konsep, kode/grup) yang sama dilewati). Isi: kode 1–7, GRUB A/B/C, 4 konsep + referensi IG, brief (URL drive "1. VOLIKO
  PRINT" BELUM diketahui → kosong), 2–14 Nov persis sheet, 16–28 Nov usulan dengan 3 anak baru. Senin 30 Nov tidak ada di sheet —
  isi lewat *Buat jadwal* bulan November (isi tanggal kosong). Giliran grup sesudahnya: C (12 Des), A, B.
- **Deploy** `tools/magang/deploy-jadwal-konten-voliko.sh <SHA>` (ff-only dari `da81381`, cadangan DB+.env+storage, migrasi, build,
  restart `ratemystaff` saja; hitungan MagangKonten* sesudah = konten 0, status 4). Impor data = langkah terpisah sesudahnya.
- Tes: `magang-konten` (generator meniru November pembina, usulan 7 anak, pemisah Minggu, tautan, cakupan & izin anak, brief, rute),
  `magang-konten-impor` (konsistensi data, 24 baris Senin–Sabtu, nama asli hanya di berkas data).

### Deploy Voliko 10 Nov 2026 16.12–16.13 + impor November (izin Faisal)

- `~/web/rate-my-staff` `da81381` → **`469adf6`** (ff-only, `setsid nohup` `~/alat/deploy-rms-jadwal-konten-20261110.sh` + `.log`; cadangan
  `~/cadangan/deploy-rms-20261110-161207` 56 tabel 5,7 MB + .env + storage). Lockfile sama; migrasi `20261112000000_magang_jadwal_konten`;
  restart `ratemystaff` saja. Hitungan magang/izin sebelum = sesudah (penugasan 93, jurnal 11, peserta 8); tidak ada galat baru.
- Impor `tools/magang/voliko-jadwal-konten.ts`: dry-run (`~/alat/voliko-jadwal-konten-dryrun-20261110.log`) → `--jalankan`
  (`~/alat/voliko-jadwal-konten-20261110.log`, cadangan `~/cadangan/magang-konten-20261110-161343/`): 4 konsep + 4 referensi IG, 3 grup
  (A Yufita+Alif, B Marisa+Rizki, C Aqila+Cerry+Putra; 7 anggota), kode 1–7, brief (drive "1. VOLIKO PRINT" TANPA URL, catatan Xposer,
  Rubik / Rubik-Bold, Outline black, caption + hashtag), **24 baris** 2–28 Nov (12 baris 16–28 Nov = USULAN). Ulang dry-run → 0 baris baru.
- Verifikasi (`~/alat/verifikasi-jadwal-konten-20261110.sh` + `.log`, GET sesi portal 5 menit): /login /me /absen /pantau 200, API pantau palsu
  404, `/magang/konten` → login; kartu konten: Rizki (kode 4) 5 jadwal termasuk hari ini 10 Nov, Yufita 5, Aqila 2; absensi hari ini
  (Fingerspot 12, HP 11 — scan pagi sesudah deploy semalam MASUK), jurnal, rotasi identik.
- Catatan: peserta ke-8 **WAFIQ** (SMK N 4, dibuat 10 Nov 09.20) belum punya kode konten & grup, absen HP belum menyala.

### Perbaikan sunting sebagian (fix/magang-konten-patch)

- **Sebab** (live sejak `469adf6`): skema PATCH Jadwal Konten memakai `teksOpsional`/`tautanOpsional`
  (`.nullable().optional().transform(v => … : null)`), jadi kolom yang TIDAK dikirim menjadi `null`, lalu route menulis `{...d}`.
  Sunting satu sel, ganti status/konsep/CODE, atau *Tandai disetujui* (`{usulan:false}`) mengosongkan judul, ref, caption,
  link footage, link ekspor, dan catatan baris itu. Kartu HP anak (`ubahKontenAnakSchema`) punya pola yang sama, tetapi
  klien selalu mengirim ketiga kolomnya (tidak terkena); *Setujui semua usulan* memakai `updateMany({usulan:false})` (aman).
  Masalah kedua: di zod 4 `.default()` tetap terisi di dalam `.partial()` — `ubahKonsepSchema` dari panel *Catatan & brief*
  (`PATCH {referensi}`) mengembalikan warna konsep ke "putih" dan aktif ke true; `ubahGrupKontenSchema` tanpa `anggota`
  akan mengisi `[]` (= semua anggota grup dihapus); `ubahStatusKontenSchema` mengembalikan warna/aktif/anakBoleh/final.
- **Perbaikan**: `teksParsial`/`tautanParsial` (`lib/validators/magang-konten.ts`): tidak dikirim = `undefined` (tidak ditulis),
  `null`/`""` = dikosongkan. Skema ubah konten, konten anak, konsep, status, grup ditulis ulang tanpa `.default()`. Data update
  PATCH pembina dibangun fungsi murni `dataUbahKonten()` (`lib/services/magang/konten.ts`): hanya kunci yang dikirim; memilih
  anak mengosongkan grup (dan sebaliknya) hanya bila salah satunya dikirim terisi; `selesaiAt` hanya disentuh bila `statusId`
  dikirim. Route konsep/status/grup/anak menulis `tanpaUndefined(parsed.data)`. Skema buat (POST) tidak berubah.
- **Diaudit**: konten `[id]` / konsep / status / grup → diperbaiki; portal anak `konten/[id]` → diperbaiki (klien tidak terkena);
  `kode` (PUT daftar, anak di luar daftar tak disentuh), `brief` & `pola` (PUT dokumen utuh; `PanelBrief`/`TabPola` selalu kirim
  dokumen lengkap) → aman; `misi/kategori/[id]` (sudah `teksUbah`), `pantau/[id]` (cek `!== undefined`) → aman; formulir penuh
  `pos/[id]`, `peserta/[id]`, `misi/[id]`, `soal/[id]` → aman (satu-satunya pemanggil, halaman Pos/Peserta/Side quest, selalu
  mengirim objek lengkap termasuk lokasi, guruPembimbing, kontakGuru, aktif); aksi `jurnal/[id]`, `tugas/[id]`, `misi/kiriman/[id]`,
  `pendaftaran/[id]`, `rotasi/[id]`, `setelan`, portal bimbingan → aman (isi aksi lengkap, bukan sunting sebagian).
- **Tes** `tests/magang-konten-patch.test.ts` (18): `{statusId}` / `{usulan:false}` tanpa kolom teks; `dataUbahKonten` menjaga
  kolom lain untuk statusId (final & bukan), konsepId, usulan, pesertaId, grupId, satu sel; `null`/`""` mengosongkan; skema anak;
  konsep `{referensi}`, status `{nama}`, grup `{nama}` tanpa nilai bawaan. Terhadap skema lama: 14 gagal, 4 lulus (tolak tautan /
  anak+grup / trim tetap sama).
- **Deploy** `tools/magang/deploy-fix-konten-patch-voliko.sh <SHA>` (ff-only dari `469adf6`, tanpa migrasi — batal bila `prisma/`
  berubah; potret JSON kolom teks MagangKonten sebelum & sesudah, exit 2 bila ada kolom berisi yang menjadi kosong).

### Deploy perbaikan Voliko 10 Nov 2026 17.49 (izin Faisal)

- `~/web/rate-my-staff` `469adf6` → **`3d74d30`** (`fix/magang-konten-patch`, ff-only, `setsid nohup` `~/alat/deploy-rms-fix-konten-patch-20261110.sh` + `.log`;
  cadangan `~/cadangan/deploy-rms-20261110-174915` 61 tabel + .env + storage + `konten-teks-{sebelum,sesudah}.json`). Tanpa migrasi; lockfile sama;
  restart `ratemystaff` saja. Galat baru 0.
- Jepretan sebelum = sesudah (`~/alat/jepret-konten-20261110.sh`): 24 baris konten (checksum semua kolom), warna konsep pink/lavender/putih/merah,
  grup 2/2/3, brief (MD5), absensi/jurnal/penugasan.
- **Uji PATCH parsial di produksi** (`~/alat/uji-patch-parsial-20261110.sh` + `.log`, API admin): baris #1 (2 Nov) `{catatan}` → `{statusId:2}` →
  `{usulan:false}`: catatan tetap; dikembalikan `{statusId:1, catatan:null}` → semua kolom isi = awal (efek samping: `updatedAt` &
  `diubahOlehId` baris #1 kini akun admin). Konsep #1 `{referensi: sama}` (jalur panel brief) → warna tetap pink. Pembina aman menyunting sel
  & menyimpan Catatan & Brief.
- Skrip pemulihan TIDAK dijalankan (tidak ada data hilang).

## Jadwal konten multi-platform & responsif (feat/magang-konten-platform — terdeploy ke Voliko 10 Nov 20.35)

Satu tim magang membuat konten untuk beberapa akun/brand (Voliko Print, Exindo, Xposer, Epic Jogja, Voliko Sport). Tiap baris
jadwal kini milik SATU **platform**; tiap platform punya jadwal, brief, dan giliran sendiri.

- **Model** (migrasi `20261113000000_magang_konten_platform`, ditulis tangan): `MagangKontenPlatform` (`nama` ≤80, unik tanpa peduli huruf
  besar — dicek di service; `kunci` slug unik TETAP (tidak ikut ganti nama); `warna` kunci palet seperti konsep; `ikon` opsional dari set SVG
  kecil `IKON_PLATFORM` (instagram/tiktok/youtube/facebook/toko/web/kamera — hiasan, nama selalu tertulis); `brief` Json; `urutan`; `aktif` +
  `diarsipkanAt`). `MagangKonten.platformId` Int NOT NULL, FK RESTRICT, indeks `(platformId, tanggal)`.
- **Migrasi**: CREATE TABLE → `INSERT IGNORE` platform **Voliko Print** (`voliko-print`, urutan 1, aktif) → brief Setting `magang_konten_brief`
  DISALIN ke brief Voliko Print (`UPDATE … WHERE brief IS NULL AND JSON_VALID`) → kolom `platformId` NULL → `UPDATE … SET platformId = Voliko
  Print WHERE platformId IS NULL` → NOT NULL → indeks + FK. Tanpa DELETE/DROP. **Setting `magang_konten_brief` TIDAK dihapus** (cadangan; aplikasi
  tidak membacanya lagi). Di instalasi non-Voliko platform pertama tetap bernama "Voliko Print" — ganti nama lewat Kelola platform (kunci tetap).
- **Bukti** (MariaDB 10.4 lokal, DB sekali pakai, dihapus sesudahnya): (a) DB kosong + semua migrasi → `prisma migrate diff --from-url …
  --to-schema-datamodel` = *No difference*; (b) DB di migrasi `20261112000000` diisi seperti produksi (24 baris, 4 konsep, 3 grup + 7 anggota,
  brief dengan caption/hashtag/emoji/kutip) → migrasi → 24/24 baris `platformId` = Voliko Print, 0 tanpa platform, brief Voliko Print **identik
  byte** dengan Setting (MD5 sama), checksum MD5 semua kolom lain MagangKonten (termasuk `updatedAt`) sebelum = sesudah, Setting tetap ada, diff
  skema kosong; langkah data diulang manual → 0 baris berubah. (MySQL 8 menormalkan spasi JSON — isi sama, MD5 bisa beda.)
- **Yang tetap GLOBAL** (paling sederhana; satu tim anak yang sama): konsep, status, grup + anggota, kode anak, pola hari. Referensi konsep:
  `MagangKontenKonsep.referensi` = **bawaan semua platform**; brief platform boleh berisi `referensi: {"<konsepId>": [{label,url}]}` — daftar
  TIDAK kosong menggantikan bawaan untuk platform itu (`referensiEfektif`), kosong = pakai bawaan. Bawaan diubah di Setelan → Konsep, khusus
  platform di panel Catatan & brief.
- **Generator per platform** (`susunRencana()` murni di `konten.ts`; `rencanaBulan(db, bulan, ganti, platformId)` hanya memuat baris platform
  itu): *Buat jadwal bulan berikut* selalu untuk SATU platform. Tanggal terisi, kode anak terakhir sebelum bulan itu, dan EMPATHY terakhir
  (giliran grup + irama 14 hari) dihitung **hanya dari baris platform itu** — platform lain tidak memengaruhi. Akibatnya anak yang sama bisa
  mendapat jadwal di dua platform pada hari yang sama (memang diinginkan: tiap akun butuh konten harian). Platform baru tanpa riwayat: mulai
  kode terkecil, hari grup Sabtu kedua grup pertama. *Ganti* hanya menghapus baris platform itu yang belum dikerjakan. Platform diarsipkan → 409.
- **API** (`requireManager`): `GET/POST /api/magang/konten/platform` (POST: nama unik, kunci slug, urutan terakhir+1), `PATCH/DELETE
  …/platform/[id]` (PATCH sebagian `ubahPlatformSchema` .strict() tanpa `.default()`, hanya nama/warna/ikon/urutan, route menulis
  `tanpaUndefined`; DELETE → 409 `{message, dipakai}` bila punya baris), `PUT …/platform/urutan` `{urutan:[semua id]}`, `POST …/[id]/arsip`
  (aktif=false + diarsipkanAt) & `…/[id]/buka-arsip`, `GET/PUT …/platform/[id]/brief` (dokumen utuh `briefPlatformSchema`; referensi hanya id
  konsep yang ada, daftar kosong dibuang). `GET /api/magang/konten?bulan=&platform=<id|semua>` (tanpa `platform` → platform aktif pertama;
  `semua` → brief null). `POST /api/magang/konten` & `/buat` wajib `platformId`; `PATCH [id]` boleh `platformId` (pindah platform);
  `/setujui` boleh `platformId`. Rute lama `/api/magang/konten/brief` DIHAPUS (satu-satunya pemakai = panel brief, sudah pindah).
- **Dasbor** `/magang/konten?bulan=&platform=`: tab platform (titik warna + ikon + nama; arsip disembunyikan kecuali *Tampilkan arsip*; tab
  bergulir di HP, membungkus di ≥768) + **Semua platform** (kolom/lencana PLATFORM yang bisa diganti, *Buat jadwal* & tambah baris nonaktif
  dengan keterangan). **Kelola platform**: tambah, ubah nama/warna/ikon (hanya kolom yang berubah dikirim), naik/turun, arsipkan/buka arsip,
  hapus dua langkah → bila 409 ditawarkan **Arsipkan saja**. Panel Catatan & brief per platform terpilih.
- **Responsif**: <768 px **kartu per hari** (`KartuKonten`: kepala tanggal + pemisah kuning tiap Minggu, kartu berisi konsep, status, CODE/grup
  + nama, platform (di Semua), judul, referensi, footage, ekspor, caption, catatan, lencana Usulan + *Setujui*, *Tambah*, *Hapus* — penyunting
  yang sama dengan tabel, sasaran ≥44 px, isian 16 px); 768–1279 tabel bergulir ke samping dengan NO+TANGGAL lengket, brief di **laci**
  kanan (`Laci`: Esc/tirai/Tutup, fokus kembali); ≥1280 tata letak lama (brief di samping, bawaan tampil ≥1536). Saringan membungkus.
- **HP anak**: tiap kartu/daftar berlabel platform; brief (catatan, font, preset, drive, caption+hashtag) diambil dari platform baris itu;
  referensi konsep = khusus platform bila ada. Rute GET mengirim `brief` per id platform (tanpa referensi mentah).
- **Pantau guru**: tetap hitungan saja — total + `perPlatform [{platform, terjadwal, selesai}]` (`serialKontenGuru`, tanpa judul/tautan/
  catatan); tes kunci terlarang tetap lulus.
- **Skrip**: `tools/magang/voliko-platform-konten.ts` (`TZ=Asia/Jakarta npx tsx …` = dry-run; `--jalankan` = cadangan JSON
  `~/cadangan/magang-platform-<waktu>` lalu satu transaksi): batal bila migrasi belum ada / `voliko-print` tidak ada; buat Exindo, Xposer,
  Epic Jogja, Voliko Sport (urutan 2–5, aktif, brief kosong, warna netral) dengan upsert per kunci (yang sudah ada TIDAK ditimpa; nama sama
  beda kunci → dilewati); cetak jumlah baris Voliko Print (peringatan bila ≠ 24 / ada baris tanpa platform). Diuji: dry-run → jalankan (4 dibuat)
  → ulang = 0. `tools/magang/voliko-jadwal-konten.ts` kini menulis baris & brief ke Voliko Print (cek dua migrasi; duplikat dicek per platform);
  diuji di DB kosong: 24 baris + brief ke Voliko Print, ulang → 0 baris, tanpa peringatan brief.
- **Deploy** `tools/magang/deploy-konten-platform-voliko.sh <SHA>` (ff-only dari `3d74d30`; satu-satunya berkas migrasi baru yang boleh =
  `20261113000000_magang_konten_platform`; cadangan DB+.env+storage; potret kolom teks sebelum/sesudah (exit 2 bila ada yang kosong); **build
  dulu, lalu migrasi, lalu restart** `ratemystaff` saja (jendela kode lama vs NOT NULL hanya detik); sesudahnya semua baris wajib punya platform
  sah (exit 3) + hitungan per platform + MD5 brief). Skrip data platform = langkah terpisah sesudahnya.
- **Tes** `tests/magang-konten-platform.test.ts`: bentuk SQL migrasi (INSERT IGNORE Voliko Print, UPDATE platformId WHERE NULL berurutan sebelum
  NOT NULL/FK, salin brief bila NULL, tanpa DELETE/DROP), hapus 409 + arsip/buka arsip, urutan, nama unik, PATCH sebagian platform tidak
  mengembalikan warna/ikon/urutan, `platformId` wajib, brief per platform (Setting lama & Json terbaca sama, referensi), generator per platform
  (baris platform lain tidak mengubah giliran kode/grup/tanggal terisi; platform lain pakai riwayatnya; ganti per platform), label platform di
  HP anak & ringkasan guru (tanpa bocor), rencana skrip data idempoten.
- **Tangkapan** (data fiktif, `.tangkapan/platform-*.png`): 1366 tab & Semua platform, Kelola platform (hapus → tawaran arsip), 768 (tabel
  bergulir, NO/TANGGAL lengket), 360 kartu / sunting judul di kartu / laci brief, HP anak berlabel platform.

### Deploy Voliko 10 Nov 2026 20.34–20.35 + platform kosong (izin Faisal)

- `~/web/rate-my-staff` `3d74d30` → **`5231969`** (ff-only, `setsid nohup` `~/alat/deploy-rms-konten-platform-20261110.sh` + `.log`; cadangan
  `~/cadangan/deploy-rms-20261110-203415` 61 tabel + .env + storage + jepret teks konten). Lockfile sama; build lalu migrasi
  `20261113000000_magang_konten_platform`; restart `ratemystaff` saja; galat baru 0. Semua 24 baris → Voliko Print; tidak ada baris tanpa platform.
- Jepretan sebelum = sesudah (`~/alat/jepret-konten-platform-20261110.sh`): konten (checksum semua kolom), warna konsep, grup 2/2/3, kode 1–7,
  absensi/jurnal/penugasan. Brief Voliko Print = isi Setting lama (dibandingkan sebagai JSON); Setting lama dibiarkan sebagai cadangan.
- `tools/magang/voliko-platform-konten.ts`: dry-run → `--jalankan` (cadangan `~/cadangan/magang-platform-20261110-203520/`): **Exindo, Xposer,
  Epic Jogja, Voliko Sport** (urutan 2–5, kosong); ulang → 0 dibuat.
- Uji parsial produksi (`~/alat/uji-patch-parsial-platform-20261110.log`): baris #1 catatan tetap saat ubah status/usulan, dikembalikan = awal;
  konsep #1 warna tetap; platform #1 PATCH {nama} → warna/ikon/urutan/aktif tetap. API: 5 platform, Voliko Print 24 baris; `/magang/konten`
  (login) 200 dengan sidebar baru (nav `overflow-y-auto`, `h-dvh`). /login /me /absen /pantau normal. Fingerspot terakhir 20.25 (pra-deploy),
  webhook hidup.

## Jadwal harian berpasangan (feat/magang-jadwal-harian — terdeploy ke Voliko 10 Nov 21.27)

Sengaja SEDERHANA: anak cukup tahu "hari ini KONTEN / PRODUKSI bersama siapa"; detailnya dijelaskan pembina.

- **Aturan** (`lib/services/magang/harian.ts`, murni): pasangan 2 anak (atau 1 = "sendiri") mengerjakan KONTEN atau PRODUKSI,
  **bergantian tiap hari kerja** (Senin–Sabtu; Minggu & tanggal di tabel Holiday dilewati dan TIDAK membalik giliran). Patokan =
  tanggal + tugas pada tanggal itu; tugas hari D = tugas patokan bila selisih hari kerja patokan→D genap, selain itu tugas satunya
  (berlaku mundur juga; `selisihHariKerja` dihitung aritmetis − libur). Hanya dalam masa magang tiap anak (mulai..selesai) dan bila
  peserta & karyawan aktif; di luar itu tidak ada tugas. Pasangan yang anggotanya tinggal satu (rekan belum ada / nonaktif / di luar
  masa / libur sendiri / dipinjam pasangan lain) → anak tersisa tetap bertugas, ditandai **sendiri**. Satu anak paling banyak di
  SATU pasangan aktif (`bentrokPasangan`, dicek di POST/PATCH pada gabungan data lama + kiriman → 422).
- **Pengecualian per tanggal** (pembina): tingkat pasangan — ganti tugas hari itu / libur (+ catatan); tingkat anak — ganti pasangan
  hari itu (`jenis "pasangan"`, rekan pengganti + tugas opsional; berlaku DUA ARAH, rekan lama masing-masing jadi sendiri; tugas =
  tugas pengecualian → pola pasangan si anak → pola pasangan rekan), atau libur anak itu saja. Pengecualian **tidak menggeser giliran
  hari-hari berikutnya** (giliran selalu dihitung dari patokan; diuji). POST mengganti pengecualian lama untuk sasaran yang sama di
  tanggal itu (untuk ganti pasangan: juga milik rekan pengganti), satu transaksi tanpa DDL; bila tetap ada dua, id terbesar menang.
- **Model** (migrasi `20261114000000_magang_jadwal_harian`, ditulis tangan, hanya MENAMBAH 2 tabel, tanpa data): `MagangPasangan`
  (nama ≤80 opsional, pesertaAId, pesertaBId nullable = sendiri, patokanTanggal DateTime tengah malam WIB, patokanTugas
  'konten'|'produksi', aktif, urutan) dan `MagangHarianPengecualian` (tanggal, pasanganId? / pesertaId?, jenis 'tugas'|'libur'|'pasangan',
  tugas?, pasanganPesertaId?, catatan ≤200, dibuatOlehId User?; indeks tanggal). Bukti: DB kosong + semua migrasi → `prisma migrate diff
  --from-url … --to-schema-datamodel` = *No difference*.
- **API pembina** (`requireManager`): `GET /api/magang/harian?minggu=YYYY-MM-DD` (grid Senin–Sabtu × pasangan, pasangan, pengecualian,
  libur, anak, teks WA), `GET …/harian/teks?minggu=`, `GET/POST …/harian/pasangan`, `PATCH/DELETE …/pasangan/[id]` (PATCH sebagian
  `.strict()` tanpa `.default()`, route menulis `tanpaUndefined`), `POST …/harian/pengecualian`, `PATCH/DELETE …/pengecualian/[id]`
  (PATCH hanya tugas/rekan/catatan).
- **Dasbor** Magang → **Jadwal Harian** (`/magang/harian?minggu=`): tabel tanggal × pasangan dengan lencana besar KONTEN (ungu, ikon
  kamera) / PRODUKSI (oranye, ikon kardus) / LIBUR — selalu teks + ikon, token `--konten`/`--produksi` (gelap, terang, cetak); minggu
  sebelumnya/berikutnya/minggu ini, hari ini disorot, tanggal merah tertulis, pensil = diubah pembina, penyimpangan per anak di bawah
  lencana ("X: bersama Y", "sendiri", "libur"). Klik kotak → dialog: KONTEN/PRODUKSI/LIBUR hari ini + catatan, *Kembalikan ke pola*, ubah
  satu anak (kerja bersama anak lain + tugas, atau libur sendiri), hapus perubahan anak. **Kelola pasangan**: pilih 2 anak (anak 2 boleh
  kosong = sendiri), nama opsional, tanggal patokan + tugasnya, urutan, aktif; peringatan bila anak sudah di pasangan aktif lain; ubah =
  hanya kolom yang berubah; hapus dua langkah (saran: hilangkan centang Aktif). **Salin untuk WA** ("Senin 16 Nov — Konten: A & B, C & D ·
  Produksi: E & F, G & H"; tanggal merah "— Libur (nama)"; "· Libur: X"; "(sendiri)") + *Lihat teks*; **Cetak** = tabel (terang). <768 px
  kartu per hari.
- **HP anak** (`/me/<token>` tab Magang): kartu PALING ATAS "Hari ini · Selasa 10 Nov — KONTEN bersama <rekan>" (atau PRODUKSI, LIBUR,
  "Hari Minggu — libur", "Tanggal merah — libur", "Di luar masa magang", "Belum ada jadwal — tanya pembina") + baris hari kerja berikutnya
  ("Besok (Rabu 11 Nov): …", atau nama hari bila bukan besok). Tidak ada isi lain; catatan pembina TIDAK dikirim. Rute `GET
  /api/public/portal/<token>/magang/harian` (sesi portal; mode owner `?owner=1` boleh melihat, rute ini baca saja) — hanya jadwal anak
  sendiri: tanggal, keadaan, tugas, nama panggilan rekan, sendiri.
- **Yang disembunyikan / dilipat dari anak** (data tetap untuk pembina): bagian terlipat **Detail lainnya** (bawaan TERTUTUP, isi baru
  dipasang saat dibuka) berisi kartu *Pos kamu minggu ini* (pos, target, pos berikutnya) dan kartu *Jadwal rotasi kamu*. Kartu *Jadwal Konten*
  (konten hari ini, brief, platform, daftar berikutnya/sebelumnya, isian judul/link/status; mode owner baca saja) **dikeluarkan dari
  lipatan** (10 Nov malam: anak tidak menemukannya) dan tampil tepat di bawah jadwal harian. Tetap terbuka seperti biasa: Jurnal harian,
  Side quest, Tugas mengingat (form & info "dibuka hari …"), Nilai dari pembimbing.
- **Pantau guru**: bagian lipat **Tugas harian** di detail anak (rentang terpilih ∩ masa magang): per tanggal KONTEN/PRODUKSI + "bersama
  <panggilan>" / sendiri, LIBUR, TANGGAL MERAH (Minggu tidak ditampilkan). `serialHarianGuru` (tanpa catatan); tes kunci terlarang lulus.
- **Skrip data** `tools/magang/voliko-jadwal-harian.ts` (data `tools/magang/data/voliko-pasangan.ts`: 4 pasangan, patokan Selasa 10 Nov
  2026, dua KONTEN + dua PRODUKSI): `TZ=Asia/Jakarta npx tsx …` = DRY RUN (cek peserta, rencana, grid 10–30 Nov); `--jalankan` = cadangan
  JSON (`~/cadangan/magang-harian-<waktu>`) lalu satu transaksi tanpa DDL. Batal bila migrasi belum ada / id peserta tidak ada / panggilan
  tidak cocok (tanpa peduli huruf besar) / anak sudah di pasangan aktif lain. Idempoten per anggota: pasangan yang sudah ada TIDAK ditimpa
  (beda patokan dilaporkan). Diuji di DB lokal: dry-run → jalankan (4 dibuat) → ulang = 0; DB tanpa migrasi → BATAL.
- **Deploy** `tools/magang/deploy-jadwal-harian-voliko.sh <SHA>` (ff-only dari `5231969`, satu-satunya migrasi baru yang boleh =
  `20261114000000_magang_jadwal_harian`, cadangan DB+.env+storage, penjaga konten tetap (potret teks exit 2, platform exit 3, hitungan per
  platform sebelum = sesudah), build → migrasi → restart `ratemystaff` saja; tabel baru harus kosong (exit 4); curl halaman & API). Skrip
  data pasangan = langkah terpisah sesudahnya.
- **Tes** `tests/magang-harian.test.ts`: selisih hari kerja (vs hitung manual), bergantian lewat Minggu, libur tidak membalik, mundur dari
  patokan, pengecualian tidak menggeser, libur pasangan/anak, ganti pasangan dua arah + rekan lama sendiri, terbaru menang, pasangan
  sendiri, di luar masa / nonaktif, satu-pasangan-aktif, validasi (PATCH tanpa kunci tambahan), grid + teks WA, data Voliko 10–16 Nov,
  rencana skrip idempoten, nama asli hanya di berkas data, bentuk migrasi, serializer anak/guru tanpa catatan. Tangkapan (data fiktif):
  `.tangkapan/harian-*.png`.

### Deploy Voliko 10 Nov 2026 21.26–21.27 + pasangan (izin Faisal)

- Sebelumnya 20.44: absen HP **Wafiq** (peserta #8, employee 40; disetujui 10 Nov 09.20, mulai 9 Nov — tetap, keputusan Faisal) dinyalakan lewat
  `PATCH /api/absen-hp/karyawan/40` (`~/alat/nyalakan-absen-hp-wafiq-20261110.sh` + `.log`, cadangan `~/cadangan/absen-hp-wafiq-20261110-204434/`).
- `~/web/rate-my-staff` `5231969` → **`527372b`** (ff-only, `setsid nohup` `~/alat/deploy-rms-jadwal-harian-20261110.sh` + `.log`; cadangan
  `~/cadangan/deploy-rms-20261110-212636` 62 tabel + .env + storage + jepret teks konten). Lockfile sama; migrasi `20261114000000_magang_jadwal_harian`;
  restart `ratemystaff` saja; galat baru 0. Tabel Holiday Nov–Des kosong → pola tidak bergeser.
- `tools/magang/voliko-jadwal-harian.ts` dry-run → `--jalankan` (cadangan `~/cadangan/magang-harian-20261110-212754/`): Aqila & Putra (KONTEN),
  Rizki & Marisa (KONTEN), Cerry & WAFIQ (PRODUKSI), Yufita & Alif (PRODUKSI), patokan 10 Nov; ulang → 0.
- Verifikasi (`~/alat/verifikasi-jadwal-harian-20261110.sh` + `.log`): kartu /me 8 anak benar untuk 10 & 11 Nov; `/magang/harian` 200; teks WA
  minggu 16 Nov benar; jepretan konten 5 platform/konsep/grup/kode/absensi/jurnal/rotasi sama; /login /absen /pantau normal; Fingerspot 20 scan.
- Catatan: Wafiq belum punya absensi sama sekali (9 & 10 Nov) → hari itu terhitung tidak hadir; koreksi lewat dasbor **Absensi → input
  manual** (`/api/attendance/manual`) atau pengajuan izin — tidak dibuat otomatis.

## Jam kerja khusus magang (feat/magang-jam-kerja — KODE terdeploy ke Voliko 10 Nov 22.10; data jam BELUM)

Anak dari sekolah berbeda punya jam berbeda (mis. SMK N 4 09.00–17.00, SMK Negeri 2 Sewon 08.00–16.00). Fitur **Jadwal Kerja**
(WorkSchedule/roster) tidak cukup: di mode shift otomatis — yang selalu dipakai laporan, simpan status, input manual & impor —
telat/lembur dihitung dari jam toko global (buka 08:00, akhir pagi 16:00, `shift_late_tolerance`) dan jadwal per-karyawan
DIABAIKAN (disengaja, `tests/attendance-shift.test.ts`). Mengubah jam toko akan mengubah semua karyawan, jadi jam magang
dibuat terpisah dan hanya berlaku untuk anak magang.

- **Data** (migrasi `20261115000000_magang_jam_kerja`, ditulis tangan, hanya MENAMBAH): tabel `MagangJamSekolah`
  (sekolahKunci = `kunciSekolah()` unik, sekolahLabel, jamMasuk/jamPulang "HH:MM", toleransiMenit null = umum) + 3 kolom NULL di
  `MagangPeserta` (jamMasuk, jamPulang, toleransiMenit; null = ikut sekolah). Hari kerja tetap Senin–Sabtu (libur dari Holiday /
  Minggu otomatis seperti biasa) — tidak ada kolom hari kerja. Tidak ada tanggal berlaku: perubahan jam berlaku untuk SEMUA hari
  yang dihitung ulang.
- **Urutan** (`lib/services/magang/jam-kerja.ts`, murni): kolom anak → jam sekolahnya (kunci tanpa peduli huruf besar/spasi) →
  tidak ada (jam toko). Per kolom: jam masuk anak boleh diisi sendiri, jam pulang ikut sekolah. Toleransi anak → sekolah → umum.
  Masuk ≥ pulang = diabaikan. Berlaku hanya untuk peserta `aktif` + karyawan aktif, pada tanggal di dalam masa magang
  (mulai..selesai); di luar itu jam toko seperti karyawan biasa.
- **Hitungan** (`lib/services/attendance/jam-magang.ts` → cabang `jamMagang` di `computeAttendanceRow`, menang atas shift otomatis
  & jadwal per-karyawan; izin/tanpa scan tetap seperti biasa): telat = menit lewat jam masuk bila masuk SETELAH jam masuk +
  toleransi (dihitung dari jam masuk, sama dengan aturan toko: 09:20 dengan 09:00/15 = telat 20; 09:05 = tepat waktu); **pulang
  awal** = menit sebelum jam pulang (info saja, status tetap); **lembur** = menit lewat jam PULANG MAGANG (bukan lewat 16:00 — kalau
  tidak, anak 09–17 selalu "lembur" 60 menit; struk/poin yang membaca lembur ikut angka ini). Tidak ada shift siang/longshift untuk
  anak magang (shift dilaporkan "pagi"). Baris karyawan biasa tidak membawa kunci tambahan apa pun (`jamKerja`, `pulangAwalMinutes`
  hanya ada di baris anak berjam khusus).
- **Disambung di semua jalur** lewat `muatPetaJamMagang()` (`lib/services/magang/jam-kerja-db.ts`, dimuat SEKALI per permintaan,
  Map karyawan → jam): `aggregateAttendance` (laporan & ekspor dasbor, portal /me Ringkasan/Absensi, pantau guru, struk, poin,
  timesheet, ringkasan HR), `recomputeStoredStatus` (Fingerspot sync, absen HP, absen tim, jadwal shift, device-sync), input
  manual, impor scanlog (status + saran jam yang hilang), daftar absensi tidak komplit (saran jam).
- **Hitung ulang**: `recompute.ts` kini = inti murni `perubahanStatus()` + `rencanaStatusTersimpan()` (tanpa menulis) +
  `terapkanPerubahan()`. Sesudah jam sekolah/anak disimpan, absensi tersimpan anak yang TERDAMPAK saja (anak sekolah itu / anak itu)
  dihitung ulang dari tanggal mulai magangnya tapi paling jauh **62 hari** ke belakang (`hitungUlangPeserta`). Mengubah sekolah/
  masa/aktif di form peserta juga menghitung ulang anak itu bila ia punya jam magang sebelum atau sesudah. Tanpa transaksi, tanpa DDL.
  Baris lebih tua dari 62 hari tetap nilai lama sampai Fingerspot sync menghitung ulang (sync menghitung semua baris mesin).
- **API** (`requireManager`): `GET /api/magang/jam` (sekolah + jamnya, peserta + jam efektif, toleransi umum, jam toko);
  `PUT /api/magang/jam/sekolah` {sekolahKunci, jamMasuk, jamPulang, toleransiMenit?} (toleransi tidak dikirim = tetap; 404 bila
  sekolah tidak ada di data peserta); `DELETE /api/magang/jam/sekolah?kunci=` (kembali ke jam toko); `PATCH /api/magang/jam/peserta/<id>`
  (sebagian `.strict()`, hanya kunci yang dikirim ditulis, null = ikut sekolah; 422 bila jam gabungan tidak lengkap/terbalik). Semua
  menerima `?pratinjau=1` → hanya menghitung dampak (baris berubah + hari terlambat sebelum → sesudah per anak), tidak menulis.
- **Dasbor**: Magang → **Sekolah** tiap kartu punya bagian *Jam kerja anak magang* (jam masuk, jam pulang, toleransi opsional
  "kosongkan = toleransi umum", *Simpan jam kerja*, *Cek dampak dulu*, *Hapus (kembali ke jam toko)*). Magang → **Peserta**: daftar
  menulis "Jam kerja: 09.00–17.00 (jam sekolah / khusus anak ini / jam toko)"; form ubah punya *Jam khusus anak ini (opsional)*
  (kosong = ikut sekolah, tombol *Kosongkan — ikut sekolah*; hanya kolom yang berubah dikirim). Laporan Absensi: baris anak magang
  memuat "Jam magang 09.00–17.00 · pulang Xm lebih awal" di bawah status. Rapor: baris "Jam kerja: 09.00–17.00" di kop.
- **Anak & guru**: /me Ringkasan + Absensi menampilkan kotak "Jam kerja magang 09.00–17.00 — Dihitung terlambat bila masuk lewat
  09.15" dan "Pulang awal Xm" per hari; pantau guru: "Jam kerja …" di kartu Kehadiran + kotak yang sama di bagian Absensi +
  "pulang X mnt lebih awal" per hari (`serialHariAbsen.pulangAwalMenit`, `detail.jamKerja`).
- **Skrip data** `tools/magang/voliko-jam-kerja.ts` (data `tools/magang/data/voliko-jam-kerja.ts`: SMK N 4 Yogyakarta 09:00–17:00 →
  peserta 5–8; SMK Negeri 2 Sewon 08:00–16:00 → peserta 1–4; toleransi umum): `TZ=Asia/Jakarta npx tsx …` = DRY RUN (rencana +
  pratinjau per anak: baris berubah, hari terlambat sebelum → sesudah, dihitung di memori); `--jalankan` = cadangan JSON
  (`~/cadangan/magang-jam-<waktu>`: MagangJamSekolah, kolom jam peserta, absensi anak) lalu buat jam sekolah + hitung ulang. Batal bila
  migrasi belum ada / sekolah tidak ditemukan / id atau panggilan tidak cocok / anak tercatat di sekolah lain. Jam sekolah yang sudah
  ada & beda dibiarkan (dilaporkan). Diuji di DB lokal (nama lengkap fiktif): dry-run → jalankan (2 dibuat, 64 baris anak SMK N 4
  berubah, hari terlambat per anak 8 → 3; Sewon 0 berubah karena sama dengan jam toko) → ulang = 0; checksum absensi karyawan biasa
  sama; DB tanpa migrasi / tanpa sekolah → BATAL.
- **Deploy** `tools/magang/deploy-jam-kerja-voliko.sh <SHA>` (ff-only dari `527372b`, satu-satunya migrasi baru =
  `20261115000000_magang_jam_kerja`, penjaga konten/platform seperti sebelumnya, jam baru harus kosong (exit 4), dan **jepretan absensi
  karyawan biasa** (jumlah + checksum id/employeeId/scanDate/lateMinutes, scanDate < hari ini, bukan peserta) sebelum = sesudah, beda →
  exit 5; `--jepret` untuk mengulang jepretan sesudah skrip data).
- **Tes** `tests/magang-jam-kerja.test.ts`: 09:05/09:20/16:30/17:30, karyawan biasa identik (grid jam masuk × pulang, objek utuh, sama
  dengan `computeShift`; jadwal per-karyawan & flexible tetap), urutan anak → sekolah → umum per kolom, toleransi, nonaktif/di luar masa,
  kunci sekolah tanpa peduli huruf besar, batas 62 hari, PATCH sebagian, hitung ulang hanya baris anak, impor, rencana skrip idempoten,
  nama asli hanya di berkas data, bentuk migrasi. Tangkapan (data fiktif): `.tangkapan/jam-*.png`.

### Deploy Voliko 10 Nov 2026 22.09–22.10 (izin Faisal) — data jam DITAHAN

- `~/web/rate-my-staff` `527372b` → **`d47000c`** (ff-only, `setsid nohup` `~/alat/deploy-rms-jam-kerja-20261111.sh` + `.log`; cadangan
  `~/cadangan/deploy-rms-20261110-220906` 64 tabel + .env + storage). Lockfile sama; migrasi `20261115000000_magang_jam_kerja`; restart
  `ratemystaff` saja; galat baru 0. Absensi karyawan biasa sebelum = sesudah (3625 baris, checksum sama); konten/jadwal harian/rotasi/jurnal utuh.
- `tools/magang/voliko-jam-kerja.ts` **dry-run saja** (`~/alat/voliko-jam-kerja-dryrun-20261111.log`): SMK N 4 09:00–17:00 → Aqila/Cerry/Putra
  terlambat 1 → 0 hari; SMK Negeri 2 Sewon 08:00–16:00 → Rizki/Yufita/Alif/Marisa 0 → 1 hari. Sebab: Senin 9 Nov absen HP baru menyala ±11.00,
  mereka masuk 11.10–11.20; aturan lama membaca absen siang sebagai shift siang (tidak terlambat), aturan magang selalu shift pagi → terlambat
  ±3 jam di hari pertama. **`--jalankan` ditahan menunggu keputusan Faisal.** Selama jam kosong, hitungan sama persis dengan sebelumnya.
- Tempat mengubah jam: Magang → **Sekolah** (kartu sekolah → "Jam kerja anak magang", tombol "Cek dampak dulu") dan Magang → **Peserta** (ubah →
  "Jam khusus anak ini").
