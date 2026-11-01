# Rate-My-Staff

Sistem HR & Absensi — penilaian karyawan, absensi, lembur, laporan, dan form publik.
Dibangun ulang penuh dengan **Next.js 16 (App Router) + Prisma + MySQL + Auth.js**.

> Repo ini dulu berisi versi lama (Laravel + Vue). Semua kode lama sudah dihapus dan
> diganti versi Next.js ini. Riwayat lama masih tersimpan di git (tag `pre-flatten-laravel`).

> 📡 **Integrasi mesin absensi Fingerspot (cloud/LAN, multi‑cabang, diagram alur):**
> lihat **[docs/fingerspot-integration.md](docs/fingerspot-integration.md)** — panduan
> pemasangan mesin, arsitektur, protokol, dan troubleshooting.

> 👤 **Portal karyawan, persetujuan izin & KPI PosPro:** lihat
> **[docs/employee-portal.md](docs/employee-portal.md)** — halaman pribadi `/me/[token]`,
> kunci PIN, alur approval owner, dan integrasi KPI dari aplikasi kasir PosPro.

## Menjalankan di lokal

**Prasyarat:**
- Node.js 20+
- MySQL berjalan (mis. lewat XAMPP). Database `ratemystaff` sudah dibuat.

**Langkah:**
```bash
# 1. (khusus laptop ini) override prefix npm yang bermasalah
export NPM_CONFIG_PREFIX="$HOME/.npm-global"

# 2. install dependencies (sekali)
npm install

# 3. siapkan database (sekali) — migrasi skema + isi data awal
npm run db:migrate
npm run db:seed

# 4. jalankan
npm run dev
```

Buka **http://localhost:3000**

**Login default:** `admin@ratemystaff.local` / `admin123`

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode development (hot reload) |
| `npm run build` && `npm start` | Mode produksi |
| `npm run db:studio` | Prisma Studio (lihat/edit database) |
| `npm run db:seed` | Isi ulang data awal |
| `npm run test` | Unit test (vitest) |

## Konfigurasi

Salin `.env.example` → `.env`, lalu isi:
- `DATABASE_URL` — koneksi MySQL (contoh: `mysql://ratemystaff:pass@127.0.0.1:3306/ratemystaff`)
- `AUTH_SECRET` — generate: `npx auth secret`
- `NEXTAUTH_URL` / `APP_URL` — URL aplikasi

## Struktur

```
app/            Halaman & API (App Router)
  (auth)/       Halaman login
  (dashboard)/  Halaman terproteksi (dashboard, employees, attendance, dll)
  (public)/     Halaman publik token (rate, absence, me — portal karyawan)
  api/          Route handler backend
  iclock/       Penerima push mesin Fingerspot (protokol ADMS)
lib/            Logika bisnis (services, auth, prisma, validators)
components/     Komponen UI
prisma/         Skema database + seed
tests/          Unit test
```

## Import Scanlog Mesin (HTML)

Halaman **Absensi → Import Scanlog** menerima file HTML export mesin (`dbg_kartu_scanlog`,
kolom PIN / Nama / Tanggal / Scan 1–4). Alurnya: unggah → **Preview** (tanpa menyimpan) →
**Konfirmasi & Simpan**.

- **Pencocokan:** PIN mesin dicocokkan ke field **PIN Mesin Absensi** (`machinePin`) di data
  karyawan. Isi PIN ini dulu di **Karyawan → Edit** agar baris tidak "tak cocok". Field yang sama
  juga dipakai integrasi push Fingerspot.
- **Pairing scan:** jam masuk diambil dari scan dekat awal shift (08:00 / 13:00), jam pulang dari
  scan dekat akhir shift (16:00 / 21:00). Bila hanya ada satu scan, diklasifikasikan masuk/pulang
  berdasarkan kedekatannya ke awal vs akhir shift — mis. scan tunggal 13:00 = **masuk** (shift
  siang), scan tunggal 21:00 = **pulang** (masuk dikosongkan, bukan diisi jam yang sama).
  (Scan istirahat belum dipakai.)
- **Dobel-scan:** bila ada beberapa scan berdekatan di event yang sama (mis. absen jam 8 dua kali,
  atau jam 9 malam dua kali), digabung jadi satu dan diambil yang **paling terlambat**.
- **Absensi tidak komplit:** baris yang cuma punya masuk atau cuma pulang otomatis memunculkan
  modal *Lengkapi manual* (lintas tanggal) tepat setelah import — dan juga ditandai banner di
  halaman **Absensi**. Jam yang hilang **diisi otomatis sesuai shift** (mis. hanya pulang 16:00 →
  saran masuk 08:00; hanya pulang 21:00 → saran masuk 13:00; dan sebaliknya), tinggal diperiksa
  lalu Simpan.
- **Edit absen:** tiap baris di halaman **Absensi** dan **Laporan Absensi** punya tombol *Edit* untuk
  mengoreksi jam masuk/pulang (mis. salah isi, atau ternyata longshift) — status/telat/lembur/shift
  dihitung ulang otomatis.
- **Hari libur:** tanggal Minggu (bila setting *Minggu otomatis libur* aktif) & tanggal libur
  custom di **Pengaturan → Hari Libur** ditandai otomatis.
- **Menimpa:** import menimpa data hari yang sama (`machineName=import-html`). Jika hari itu sudah
  punya absensi dari sumber lain (mesin push/manual), baris ditandai **bentrok** dan hanya
  ditimpa bila kotak konfirmasi dicentang; jika tidak, hari bentrok dilewati.

## Shift otomatis & longshift

Status kehadiran (telat/lembur/longshift) dihitung **otomatis dari jam scan** memakai jam toko &
shift di **Pengaturan → Jam Toko & Shift** — bukan jadwal per-karyawan. Default: toko 08:00–21:00,
shift pagi 08:00–16:00, shift siang 13:00–21:00.

- **Deteksi shift:** ditentukan dari jam masuk (dekat jam buka = pagi, dekat jam mulai siang = siang).
- **Longshift:** masuk pagi lalu pulang saat toko tutup (≥ ambang, default 20:00) = bekerja buka
  sampai tutup.
- **Lembur:** menit kerja melebihi jam pulang shift (pagi lewat 16:00; siang/longshift lewat 21:00).
- **Telat:** menit lewat jam mulai shift di atas toleransi (default 15 menit).

Logika ini dipakai konsisten di import scanlog, input manual, laporan absensi, **dan status
yang tersimpan pada tiap scan mesin**. Scan dari mesin dulu disimpan dengan status `on_time`
bawaan tanpa pernah dihitung, sehingga halaman **Absensi → Log Absensi** menampilkan semua
orang "Tepat waktu" walau datang jam 09.44 (laporan absensi sudah benar karena menghitung
sendiri saat ditampilkan). Sekarang status dihitung ulang tepat setelah label masuk/pulang
final, memakai fungsi yang sama dengan laporan.

## Halaman karyawan (`/me/[token]`)

Tiap karyawan punya halaman pribadi berisi **absensi**, **penilaian kinerja** (skor per
indikator + catatan penilai), **masukan tamu dari QR rating**, **estimasi lembur**, dan
**pengajuan izin**. Tautan + QR-nya diambil dari **Direktori → tombol QR → tab "Portal
Karyawan"**.

Halaman dikunci **PIN 4–8 angka** yang dibuat karyawan sendiri saat pertama membuka tautan
(admin bisa membuatkan PIN acak atau menghapusnya bila karyawan lupa). Sesi bertahan 8 jam
lewat cookie httpOnly bertanda tangan — tanpa akun login.

## Izin & cuti (dengan persetujuan owner)

Pengajuan izin/sakit/cuti — dari portal karyawan maupun form tautan `/absence/[token]` —
masuk sebagai **`pending`** dan **tidak mengubah absensi**. Owner/HR/Admin memutuskan di
**Absensi → Izin & Cuti**:

- **Setujui** → ketidakhadiran ditulis ke absensi, satu baris per hari. Tanggal yang sudah
  punya scan mesin **dilewati** (bukti kehadiran asli tidak pernah ditimpa) dan dilaporkan.
- **Tolak** → absensi tidak disentuh; alasan penolakan terlihat oleh karyawan.
- **Batalkan persetujuan** → hanya baris absensi hasil persetujuan (`machineName =
  leave-approval`) yang ditarik kembali.

Aturan lain: satu hari tidak boleh punya dua pengajuan aktif, maksimal 31 hari per
pengajuan, mundur maksimal 30 hari, maju maksimal 1 tahun. Pengajuan baru memunculkan
notifikasi untuk OWNER/ADMIN/HR.

Detail lengkap: **[docs/employee-portal.md](docs/employee-portal.md)**.

## KPI dari PosPro (aplikasi kasir)

Bila diaktifkan, halaman karyawan ikut menampilkan **kinerja operasional** dari PosPro:
rating pelanggan, ketuntasan tugas/piket, dan penjualan. Datanya diambil dari endpoint
`/integrations/staff-kpi` di PosPro memakai tiket integrasi `qi1` dari qendali.com.

Aktifkan dengan mengisi `POSPRO_API_URL` dan `QENDALI_LISENSI_TOKEN` di `.env` (usahanya harus
berlangganan Qendali POS juga; tidak ada kunci bersama — `POSPRO_API_KEY` lama diabaikan kecuali
jalan mundur `QENDALI_INTEGRASI_KUNCI_LAMA=true`), lalu petakan tiap karyawan ke akun PosPro-nya di
**Direktori → Edit → Akun PosPro**. Tanpa konfigurasi itu integrasi mati dan halaman
karyawan tetap jalan seperti biasa.

> Penjualan dicocokkan lewat **nama kasir** pada nota — tabel transaksi PosPro tidak
> menyimpan id user. Rating pelanggan & tugas dipetakan lewat id, jadi andal.

## Poin & hadiah karyawan

Karyawan mengumpulkan poin otomatis dari **omzet, pekerjaan yang diselesaikan, task tepat
waktu, dan kehadiran** — lalu bisa menukarnya dengan uang, produk, atau voucher yang
disiapkan owner di **Penilaian → Poin & Hadiah**.

Tarifnya diatur di **Pengaturan → Poin Karyawan** (bawaan: Rp1 juta = 100 poin, task tepat
waktu 20 poin, hadir tepat waktu 10 poin/hari). Sengaja seimbang supaya kasir beromzet besar
tidak otomatis mengalahkan operator dan orang yang rajin mengerjakan task.

Alur penukaran: karyawan mengajukan dari halamannya → owner menyetujui → poin terpotong dan
stok hadiah berkurang. Poin pada pengajuan yang belum diputus ditahan agar tak bisa
diajukan berkali-kali melebihi poin yang dimiliki. Detail: **[docs/employee-portal.md](docs/employee-portal.md)**.

## Deploy

Produksi berjalan di homelab via PM2 + Cloudflare Tunnel (`absensi.volikoprint.com`).
Update: `git pull && npm ci && npx prisma migrate deploy && npm run build && pm2 restart ratemystaff`

## Tarik absensi saat aplikasi online (mode Web / push mesin)

Kalau RateMyStaff dihosting online (VPS), server **tidak bisa** menjangkau IP privat
mesin di LAN kantor, jadi "Tarik dari Mesin" (mode Ethernet, port 5005) tak berlaku.
Gunakan **mode Web**: mesin yang menelepon keluar & mendorong (push) data scan ke server.
Mesin memulai koneksi dari kantor ke internet, jadi tak butuh akses masuk ke LAN.

**Penerima push** sudah tersedia: `POST /iclock/cdata` (protokol ADMS Fingerspot/ZK),
publik (di-whitelist proxy, mesin tak perlu login). Scan dipetakan via **`machinePin`**,
di-dedup, lalu in/out ditentukan per hari berdasarkan urutan waktu (sama seperti jalur
direct-IP; benar untuk shift sore).

**Langkah:**
1. **Sinkron karyawan dulu** (atau isi `machinePin` tiap karyawan) agar PIN mesin cocok.
2. **VPS:** arahkan domain (mis. `absensi.domainku.com`) ke app (`next start -p 3007`)
   lewat reverse-proxy (Nginx/Caddy). Path `/iclock/*` harus bisa dijangkau publik.
3. **Mesin (menu Koneksi → Web/Server):** isi alamat server = domain kamu, port sesuai
   reverse-proxy, dan SN mesin. Firmware otomatis memakai path `/iclock/`.

> **Penting soal HTTPS:** banyak firmware Revo/ZK mode ADMS hanya bicara **HTTP polos**
> (bukan TLS). Jadi walau UI RateMyStaff pakai HTTPS, sediakan juga jalur **HTTP** untuk
> `/iclock/*` (mis. Nginx dengarkan `:80` untuk path `/iclock` dan teruskan ke app), atau
> arahkan mesin ke `http://domain:port`. Uji dulu apakah firmware mesinmu mendukung HTTPS.

**Verifikasi tanpa mesin** (simulasi push):
```bash
curl "https://absensi.domainku.com/iclock/cdata?SN=SN01&options=all"   # handshake
printf '6\t2026-09-17 13:10:00\t0\t1\n' | \
  curl -X POST "https://absensi.domainku.com/iclock/cdata?SN=SN01&table=ATTLOG" --data-binary @-
```
Scan akan muncul di **Laporan Absensi** untuk karyawan ber-`machinePin` 6.
