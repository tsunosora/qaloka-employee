# Portal Karyawan & Persetujuan Izin

Dua fitur yang saling terkait:

1. **Portal karyawan** `/me/[token]` — halaman pribadi tiap karyawan (absensi, penilaian,
   estimasi lembur, masukan tamu).
2. **Pengajuan izin dengan persetujuan owner** — izin/sakit/cuti tidak lagi langsung
   mengubah absensi; owner memutuskan dulu di **Absensi → Izin & Cuti**.

---

## 1. Portal karyawan

### Cara karyawan membukanya

Tautan & QR-nya ada di **Direktori → tombol QR → tab "Portal Karyawan"**. Tautannya memakai
`publicToken` yang sudah dimiliki tiap karyawan (token yang sama dipakai QR rating tamu,
tapi jalurnya berbeda: `/me/...` vs `/rate/...`).

Kirim tautan itu ke karyawan yang bersangkutan saja — mis. lewat WhatsApp, atau cetak QR-nya.

### PIN

Tautan saja tidak cukup untuk membuka data. Halaman dikunci **PIN**, dan ada **dua PIN
yang diterima**:

| PIN | Asal | Dipakai siapa |
|---|---|---|
| **PIN portal** | dibuat sendiri di halaman ini, 4–8 angka | semua karyawan |
| **PIN PosPro** | `Designer.pin` di PosPro (PIN piket/desainer) | karyawan yang sudah dipetakan ke akun PosPro **dan** punya PIN di sana |

Saat masuk, PIN portal dicoba lebih dulu; bila tak cocok, baru ditanyakan ke PosPro
(`POST /integrations/staff-pin/verify`, hanya menjawab benar/salah — nilai PIN tak pernah
keluar dari PosPro). Kalau PosPro sedang mati, PIN portal tetap jalan.

Layar yang muncul: **"Masuk"** bila karyawan punya salah satu PIN; **"Buat PIN"** hanya bila
belum punya keduanya.

- **Kali pertama dibuka** (tanpa PIN PosPro), karyawan membuat PIN-nya sendiri (isi + ulangi).
- PIN disimpan sebagai **hash bcrypt**; tak pernah dikirim balik ke browser, dan kolom
  `portalPin` di-`omit` dari semua endpoint karyawan.
- PIN yang mudah ditebak **tidak ditolak**, hanya diberi peringatan: meter kekuatan
  (lemah/sedang/kuat) tampil saat mengetik, beserta alasannya (angka sama semua,
  berurutan, pola berulang, mirip tahun, hanya dua angka berbeda). Karyawan tetap
  boleh memakainya.
- **Lupa PIN** → admin/owner menekan *Buatkan PIN acak* (PIN tampil **sekali**, catat &
  kirim ke karyawan) atau *Hapus PIN* (karyawan membuat PIN baru saat membuka tautan lagi).
- Karyawan bisa mengganti PIN sendiri dari dalam portal (wajib menyebut PIN lama).
- Salah PIN dibatasi **5 kali per 15 menit** per IP+tautan (`lib/rate-limit.ts`) — berlaku
  untuk kedua jenis PIN.

> ⚠️ **Aturan kekuatan PIN tidak berlaku untuk PIN PosPro.** PIN portal menolak angka
> berurutan/sama semua, tapi PIN PosPro dibuat di PosPro sehingga lolos apa adanya. Kalau
> PIN PosPro seseorang lemah (mis. 4 angka berurutan), kelemahan itu ikut terbawa ke sini.
> Perkuat dari **PosPro → Pengaturan → Desainer**; sekali ubah, berlaku di kedua aplikasi.

### Owner melihat tanpa PIN

Pengguna dashboard ber-role **OWNER / ADMIN / HR** bisa membuka halaman karyawan tanpa PIN,
**tapi harus memintanya secara tegas** lewat `?owner=1` — tombol *"Buka sebagai owner"* di
**Direktori → QR → tab Portal Karyawan** sudah menambahkannya.

> **Kenapa harus tegas?** Versi pertama memberlakukan bypass diam-diam begitu ada cookie
> login di browser. Akibatnya tautan yang sama terbuka langsung bagi owner tapi meminta PIN
> bagi karyawan — owner jadi tak bisa memeriksa apa yang sebenarnya dilihat karyawannya, dan
> mudah menyangka PIN-nya jebol. Sekarang **tautan polos selalu meminta PIN untuk siapa pun**,
> termasuk owner yang sedang login.

Ini tidak menambah hak akses apa pun: data yang sama (absensi, penilaian, struk) memang sudah
tersedia bagi manajemen lewat Direktori & Laporan. `?owner=1` hanya penanda niat — tanpa sesi
login ber-role manajemen, penanda itu diabaikan dan PIN tetap diminta.

Yang membedakan dari karyawannya sendiri:

- Ada spanduk **"Mode owner — Anda melihat halaman milik <nama>"** supaya tak tertukar.
- Tombol **Ganti PIN** dan **Keluar** disembunyikan (itu milik karyawannya).
- **Tidak bisa bertindak atas nama karyawan**: mengajukan izin, membatalkan pengajuan, dan
  menukar poin dijawab 403. Owner boleh melihat, bukan menyamar (`requirePortalOwner`).

### Sesi

Cookie `rms_portal`, httpOnly, **berlaku 8 jam**, ditandatangani HMAC dengan `AUTH_SECRET`
(`lib/services/portal/session.ts`). Isinya `employeeId.sidikJariToken.kedaluwarsa.tandaTangan`
— tanpa tabel sesi. Konsekuensinya:

- Cookie tak bisa dipalsukan atau diperpanjang sendiri dari sisi klien.
- Cookie karyawan A otomatis ditolak di tautan karyawan B.
- Mengganti `AUTH_SECRET` atau memutar `publicToken` karyawan langsung mematikan sesi lama.

### Isi halaman

| Tab | Isi |
|---|---|
| **Ringkasan** | % kehadiran, jumlah telat, total lembur, skor terakhir, donat kehadiran, estimasi lembur (struk) |
| **Absensi** | Rincian harian: jam masuk/pulang, telat, lembur, status, alasan ketidakhadiran |
| **Penilaian** | Skor + grade, rincian per indikator & bobot, catatan penilai / rencana pengembangan / rekomendasi, riwayat skor, masukan tamu dari QR rating |
| **Izin** | Form pengajuan + riwayat beserta statusnya |

Periode dipilih per bulan (tombol ◀ ▶ atau pemilih bulan). Nominal rupiah yang tampil
adalah **estimasi lembur dari data absensi**, bukan slip gaji — ada peringatannya di kartu.

### Grafik jam kerja & pembanding

Tab **Ringkasan** menampilkan:

- **Grafik jam kerja harian** — batang = lama kerja (hijau tepat waktu, kuning telat,
  biru longshift), garis merah = menit keterlambatan per hari.
- **Kartu kedisiplinan** — membandingkan periode berjalan dengan rentang **sama panjang
  tepat sebelumnya**: rata-rata telat, persentase tepat waktu, dan rata-rata jam kerja,
  lengkap dengan arah tren (semakin tertib / semakin sering telat). Selisih di bawah
  1 menit dianggap sama agar tidak terasa naik-turun tanpa makna.

Jam kerja dihitung dari jam masuk & pulang (`lib/services/portal/worktime.ts`). Lewat
tengah malam dihitung benar; di atas 16 jam dianggap data salah (lupa absen pulang) dan
tidak dihitung, bukan dikarang.

### Omzet & pekerjaan (dari PosPro)

Untuk karyawan yang dipetakan ke akun PosPro, tab Ringkasan menampilkan **omzet hari ini**,
omzet periode berjalan, dan pekerjaan yang diselesaikan:

| Peran | Omzet | Pekerjaan | Sumber di PosPro |
|---|---|---|---|
| Kasir / CS | nilai nota yang **dia tutup** | jumlah closing | `Transaction` PAID |
| Layout materi | nilai nota dari order yang dia siapkan | jumlah order + **jasa desain per jenjang** | `SalesOrder.designerName` |
| Operator | nilai item produksi × bobot | jumlah kartu | `ProductionJobActivity` |
| Semua | — | task selesai (tepat waktu / telat) | `TaskItem` (per `assigneeId`) |

**Istilah.** Nama field yang datang dari PosPro tidak seluruhnya sepadan dengan istilah di
toko: `designJobs` sebenarnya **layout materi** (sales order yang disiapkan untuk cetak),
sedangkan pekerjaan desain yang sesungguhnya ada di `designServices`. Nama field sengaja
dibiarkan apa adanya agar satu istilah dipakai konsisten di kedua aplikasi; yang diganti
hanya label yang dilihat pengguna.

**Jasa desain berjenjang.** Di PosPro, desain adalah **produk** (`Jasa Desain`) dengan varian
berdasarkan kesulitan: Easy A (Rp15rb), Easy B (Rp20rb), Standar (Rp35rb/Rp65rb), Medium
(Rp150rb), Hard (Rp200rb). Menghitung "jumlah order desain" saja menyamakan Easy A dengan
Hard padahal bedanya belasan kali lipat, jadi panel memisahkan keduanya:

- **Layout materi** — sales order yang dia siapkan untuk cetak. Ini pekerjaan menata materi,
  bukan mendesain; kebanyakan order cetak memang tidak memuat jasa desain.
- **Jasa desain** — jasa desain yang benar-benar terjual pada order itu, dipecah per jenjang
  beserta nilainya. Ditelusuri dari `SalesOrder.transactionId` → item nota yang produknya
  bernama "desain", dan ditempatkan pada tanggal sales order-nya (saat desain dikerjakan).

**Omzet ditampilkan satu angka per hari** (gabungan seluruh perannya). Rincian per peran hanya
muncul untuk orang yang benar-benar merangkap — kalau tidak, dua angka yang sama hanya membuat
seolah ada dua omzet berbeda.

Total dihitung dari **hari yang ada absensinya saja**, supaya cocok dengan tabelnya. Bila ada
omzet atas nama orang itu di tanggal tanpa absensi (biasanya lupa scan), selisihnya disebut
terpisah.

> **Alias nama.** Data operasional PosPro menyimpan nama, bukan id user — dan namanya bisa
> berbeda (user `Damara` memakai nama desainer `Damar`). Karena itu pencocokan memakai
> **semua alias**: `User.name` + seluruh `Designer.name` yang terhubung ke user itu. Tanpa
> ini, hasil kerja orang beralias tidak terhitung sama sekali.

### Poin & hadiah

Tab **Poin** di portal karyawan. Poin dikumpulkan otomatis dari kerja sehari-hari, lalu bisa
ditukar hadiah yang disiapkan owner.

**Tarif bawaan** (semuanya bisa diubah di **Pengaturan → Poin Karyawan**, tanpa menyentuh kode):

| Sumber | Poin |
|---|---|
| Omzet | 1 poin tiap Rp10.000 (Rp1 juta = 100 poin) |
| Nota / closing | 5 poin |
| Layout materi | 10 poin per order |
| Bobot kesulitan desain | 1 poin tiap Rp5.000 nilai jasa desain → Hard 40 poin, Medium 30, Easy A 3 |
| Kartu produksi | 10 poin (dikali bobot) |
| Task tepat waktu | 20 poin |
| Task terlambat | 5 poin |
| Hadir tepat waktu | 10 poin per hari |

Angkanya sengaja dibuat **seimbang antar peran**: sehari beromzet Rp1 juta + 20 nota + hadir
tepat waktu = 210 poin, sementara operator dengan 8 kartu + 5 task + hadir tepat waktu = 190
poin. Kasir beromzet besar tidak otomatis mengalahkan orang yang rajin.

**Cara mengumpulkan poin berbeda per peran.** Kartu penjelasan di portal dikelompokkan
menjadi Kasir/CS, Desainer, Operator produksi, dan "Berlaku untuk semua" (omzet, task,
kehadiran). Karyawan **hanya melihat kelompok yang berlaku baginya** — desainer tak perlu
melihat aturan poin kasir. Perannya ditentukan dari **aktivitas nyata pada periode itu**
(ada nota → kasir, ada layout/jasa desain → desainer, ada kartu produksi → operator), bukan
dari jabatan tertulis, sehingga yang merangkap otomatis melihat semua aturan yang relevan.

**Cara kerjanya**

- Poin dihitung per hari dan **disimpan** di `PointEntry` (bukan dihitung ulang tiap buka
  halaman), sehingga saldo murah dihitung dan riwayat tidak berubah walau tarif kelak diganti.
- Perhitungan **idempoten**: menghitung ulang rentang yang sama menimpa hasil lama, bukan
  menggandakan. Owner punya tombol *Hitung ulang* di halaman Poin & Hadiah.
- Poin omzet/pekerjaan/task mengikuti **kerja yang tercatat di PosPro**, sedangkan poin
  kehadiran hanya diberikan pada hari yang benar-benar absen tepat waktu.
- Saldo = seluruh poin terkumpul − yang sudah ditukar − yang tertahan di pengajuan. Poin
  tertahan mencegah satu orang mengajukan berkali-kali melebihi poinnya.

**Penukaran** (owner: **Penilaian → Poin & Hadiah**)

1. Owner mengisi katalog hadiah: uang, produk, atau voucher — lengkap dengan harga poin,
   nilai rupiah, dan stok (kosong = tak dibatasi).
2. Karyawan mengajukan dari tab Poin. Pengajuan masuk sebagai `pending` dan memunculkan
   notifikasi untuk owner/HR/admin.
3. Owner **menyetujui** (poin terpotong, stok berkurang), **menolak** (poin kembali), menandai
   **sudah diserahkan**, atau **membatalkan** persetujuan (poin & stok dikembalikan).

---

## 2. Alur pengajuan izin

```
Karyawan                         Sistem                        Owner / HR / Admin
   │                                │                                  │
   ├─ /me/[token] → tab Izin ──────►│                                  │
   │  (atau form tautan /absence)   │                                  │
   │                                ├─ LeaveRequest: pending           │
   │                                ├─ notifikasi ────────────────────►│
   │                                │            Absensi → Izin & Cuti │
   │                                │◄──── Setujui / Tolak ────────────┤
   │                                │                                  │
   │                    disetujui → tulis Attendance (per hari)        │
   │                    ditolak   → absensi tidak disentuh             │
   │◄─ status terlihat di portal ───┤                                  │
```

### Aturan yang dijaga

- **Absensi hanya berubah setelah disetujui.** Sebelum itu tabel `Attendance` tidak tersentuh
  sama sekali (perilaku lama yang langsung `deleteMany` sudah dihapus).
- **Scan mesin tidak pernah ditimpa.** Saat menyetujui, tanggal yang sudah punya scan
  masuk/pulang **dilewati** dan dilaporkan ke owner ("2 hari tercatat · 1 hari dilewati
  karena sudah ada absensi").
- **Baris hasil persetujuan ditandai** `machineName = "leave-approval"`. Bila owner
  membatalkan persetujuan, hanya baris bertanda itu yang ditarik kembali.
- **Satu hari satu pengajuan.** Pengajuan baru yang beririsan dengan pengajuan
  `pending`/`approved` milik karyawan yang sama ditolak (409).
- **Rentang tanggal** (`lib/services/leave/range.ts`): maksimal 31 hari per pengajuan,
  mundur paling jauh 30 hari (agar sakit kemarin tetap bisa dilaporkan), maju maksimal 1 tahun.
- Karyawan boleh **membatalkan sendiri** selama statusnya masih `pending`.

### Form tautan publik (`/absence/[token]`)

Masih ada dan tetap berlaku 24 jam, tapi sekarang **menghasilkan pengajuan `pending`**
(kolom `source = "link"`), bukan langsung mencatat ketidakhadiran. Berguna untuk karyawan
yang belum sempat memakai portal pribadinya.

---

## 3. Integrasi KPI dari PosPro

Penilaian kinerja kini punya dua sumber: penilaian manual di RateMyStaff (`Assessment`)
dan **KPI operasional dari PosPro** (aplikasi kasir, repo `/home/homelab/pos/pospro`).

### Jalur data

```
RateMyStaff                                   PosPro (NestJS, :3001)
  portal /me/[token]  ──┐
  Direktori → Edit     ─┤  GET /integrations/staff-list   ← daftar akun (dropdown pemetaan)
                        └► GET /integrations/staff-kpi    ← KPI per userId, rentang tanggal
                             header: x-api-key
```

Keduanya berjalan di mesin yang sama, jadi panggilannya lewat `127.0.0.1` — tidak keluar internet.

### Keamanan koneksi

Backend PosPro terbuka ke internet lewat Cloudflare Tunnel (`api.volikoprint.com`), jadi
endpoint `/integrations/*` dijaga **dua lapis** (`backend/src/auth/api-key.guard.ts`):

1. **Kunci API** wajib (`x-api-key`), dibandingkan dengan `timingSafeEqual`. Env kosong =
   semua request ditolak, bukan dibiarkan terbuka.
2. **Hanya pemanggil lokal.** Soket harus loopback **dan** request tak boleh membawa header
   proksi (`cf-ray`, `cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`). Request dari
   tunnel selalu membawa header Cloudflare walau soketnya tampak loopback, sehingga
   ikut tertolak. Set `STAFF_KPI_ALLOW_REMOTE=true` bila kelak aplikasi HR pindah server.

Artinya: walau seseorang menebak URL-nya dari internet, ia mentok di 401 — bahkan
seandainya kunci API bocor.

### Konfigurasi

| Sisi | Variabel | Isi |
|---|---|---|
| Kedua sisi | `QENDALI_LISENSI_TOKEN` | token instalasi dari qendali.com — dipakai meminta tiket integrasi `qi1` |
| RateMyStaff | `POSPRO_API_URL` | `http://127.0.0.1:3001` |

**Sejak 17 Okt 2026 tidak ada kunci bersama.** `STAFF_KPI_API_KEY` (POS) dan `POSPRO_API_KEY`
(di sini) diabaikan kecuali jalan mundur `QENDALI_INTEGRASI_KUNCI_LAMA=true` dinyalakan di kedua
aplikasi.

### Pemetaan karyawan ↔ akun PosPro

**Direktori → Edit karyawan → "Akun PosPro"**. Tanpa pemetaan ini, KPI tidak muncul untuk
karyawan tersebut. Tersimpan di `Employee.posproUserId` (unik — satu akun PosPro hanya
boleh dipetakan ke satu karyawan).

### KPI yang ditarik

| KPI | Sumber di PosPro | Cara mengenali orangnya |
|---|---|---|
| Rating pelanggan | `CsRatingResponse` | `assignedCsId` → FK `User` — **andal** |
| Tugas & piket | `TaskItem` (`assigneeId`, `status`, `dueDate`, `completedAt`) | FK `User` — **andal** |
| Penjualan | `Transaction` status `PAID` | **nama kasir** (`checkoutCashierName`, jatuh ke `cashierName`) — lihat catatan di bawah |

- **Penjualan dicocokkan lewat nama**, karena tabel transaksi PosPro tidak menyimpan id user.
  Pencocokan memakai nama yang dinormalisasi (huruf kecil, spasi dirapikan), dan kredit
  diberikan ke **penutup transaksi**, bukan pembuat nota.
  Nama kasir yang tak cocok dengan satu pun akun dikembalikan di `unmatchedCashierNames`
  supaya ketahuan ada penjualan yang belum terhitung.
- **Terlambat** pada tugas = selesai melewati tenggat, atau belum selesai padahal tenggat lewat.
  Tugas tanpa tenggat tidak pernah dihitung terlambat.
- **Puas** pada rating = jawaban "ya", atau bintang 4–5.

### Kalau PosPro mati

Portal karyawan **tetap tampil**; bagian KPI hilang begitu saja. Semua kegagalan
(integrasi belum diisi, PosPro tak bisa dihubungi, HTTP bukan 2xx, batas waktu 6 detik)
menghasilkan `null`, dicatat ke log server, dan tidak pernah menggagalkan halaman.

### Berkas di sisi PosPro

| Berkas | Isi |
|---|---|
| `backend/src/auth/api-key.guard.ts` | Guard `x-api-key`, banding waktu-konstan; env kosong = tolak |
| `backend/src/integrations/staff-kpi.controller.ts` | `GET /integrations/staff-list`, `GET /integrations/staff-kpi`, `GET /integrations/staff-pin`, `POST /integrations/staff-pin/verify` |
| `backend/src/integrations/staff-pin.service.ts` | Verifikasi PIN desainer (jawab benar/salah saja) |
| `backend/src/integrations/staff-daily.service.ts` | Angka harian per orang (omzet, desain, produksi) |
| `backend/src/integrations/staff-kpi.service.ts` | Query Prisma + penggabungan per user |
| `backend/src/integrations/staff-kpi.aggregate.ts` | Agregasi murni (tanpa Prisma) |
| `backend/src/integrations/staff-kpi.aggregate.spec.ts` | Unit test agregasi (jest) |

---

## Berkas terkait

| Berkas | Isi |
|---|---|
| `app/(public)/me/[token]/page.tsx` | Halaman portal |
| `components/portal/*` | Layar PIN, panel ringkasan/absensi/penilaian/izin |
| `app/api/public/portal/[token]/*` | API portal (state, sesi/PIN, overview, izin) |
| `app/(dashboard)/leave-requests/page.tsx` | Halaman persetujuan owner |
| `app/api/leave-requests/*` | Daftar & keputusan izin |
| `app/api/employees/[id]/portal-pin/route.ts` | Admin set/hapus PIN |
| `lib/services/portal/*` | Sesi HMAC, aturan PIN, guard, agregasi data portal |
| `lib/services/leave/*` | Aturan rentang tanggal, irisan, penerapan ke absensi |
| `lib/services/pospro/client.ts` | Klien integrasi PosPro (gagal = null, bukan error) |
| `app/api/pospro/staff-list/route.ts` | Proksi daftar akun PosPro untuk dropdown pemetaan |
| `components/portal/PosproPanel.tsx` | Kartu KPI operasional di tab Penilaian |
| `components/portal/WorkChart.tsx` | Grafik jam kerja & keterlambatan harian |
| `components/portal/DisciplineCard.tsx` | Pembanding kedisiplinan antar periode |
| `components/portal/DailyOutputPanel.tsx` | Omzet/output pada tiap hari absen |
| `lib/services/portal/worktime.ts` | Durasi kerja, ringkasan & tren (modul murni) |
| `lib/services/portal/pin-strength.ts` | Penilaian kekuatan PIN (dipakai server & browser) |
| `lib/services/points/rates.ts` | Tarif poin + pembacaan dari Pengaturan |
| `lib/services/points/compute.ts` | Hitungan poin harian (modul murni) |
| `lib/services/points/service.ts` | Simpan poin, saldo, papan peringkat |
| `components/portal/PointsPanel.tsx` | Tab Poin: saldo, cara dapat, katalog, riwayat |
| `app/(dashboard)/points/page.tsx` | Halaman owner: peringkat, hadiah, pengajuan |
| `tests/leave-range.test.ts`, `tests/portal-session.test.ts` | Unit test logika murni |
