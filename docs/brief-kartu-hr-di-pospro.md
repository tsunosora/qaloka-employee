# Brief — Kartu Sekilas HR di PosPro

> **Catatan sejarah.** Kunci bersama `HR_API_KEY` di brief ini sudah DIGANTI tiket integrasi `qi1`
> (11 Okt 2026) dan pintunya dimatikan secara bawaan sejak 17 Okt 2026 — lihat
> `lib/lisensi/kunci-lama.ts`. Bagian kunci di bawah tidak berlaku lagi.

Untuk dikerjakan di repo **PosPro**. Sisi RateMyStaff (endpoint + kunci) sudah siap dan
berjalan; brief ini hanya mendeskripsikan apa yang perlu dibangun di PosPro.

---

## 1. Tujuan

Satu kartu di PosPro yang menjawab **"bagaimana tim hari ini?"** dalam sekali lihat, tanpa
perlu membuka RateMyStaff. Sengaja **dangkal**: tak ada tabel, tak ada detail per hari,
tak ada aksi. Kalau mau mendalam, orangnya klik tautan ke RateMyStaff.

**Bukan** bagian dari brief ini: menyetujui izin, mengedit absensi, melihat rincian poin.
Semua itu tetap di RateMyStaff.

---

## 2. Isi kartu

Empat blok, satu baris pandang:

| Blok | Isi | Dari field |
|---|---|---|
| **Kehadiran hari ini** | `12/16 hadir` + persentase | `attendance.present` / `attendance.employees` / `attendance.rate` |
| **Terlambat** | jumlah + maksimal 3 nama teratas | `attendance.late`, `lateToday[]` |
| **Belum absen / izin** | dua angka kecil | `attendance.notYetIn`, `attendance.leave` |
| **Poin bulan ini** | 3 nama teratas + poinnya | `points.top[]`, `points.periodLabel` |

Lencana kecil bila `pendingLeave > 0`: **"N izin menunggu persetujuan"** — ini satu-satunya
hal yang menuntut tindakan owner, jadi layak menonjol.

---

## 3. Sumber data

### Endpoint

```
GET http://127.0.0.1:3007/api/integrations/hr-summary
Header: x-api-key: <HR_API_KEY>
```

### Contoh respons (nyata, 19 Sep 2026)

```json
{
  "date": "2026-09-19",
  "generatedAt": "2026-09-19T09:46:02.501Z",
  "attendance": {
    "employees": 16,
    "present": 12,
    "onTime": 6,
    "late": 6,
    "leave": 0,
    "notYetIn": 4,
    "rate": 75
  },
  "lateToday": [
    { "name": "Jono", "clockIn": "09:44", "lateMinutes": 104 },
    { "name": "anastasy", "clockIn": "08:41", "lateMinutes": 41 }
  ],
  "onLeaveToday": [],
  "pendingLeave": 0,
  "points": {
    "enabled": true,
    "periodLabel": "September 2026",
    "top": [
      { "name": "Gugun Kurniawa", "points": 4856 },
      { "name": "rangga", "points": 4280 }
    ]
  }
}
```

Catatan bentuk data:
- `lateToday` & `onLeaveToday` **maksimal 5 entri**, sudah urut dari yang paling terlambat.
- `points.enabled` bisa `false` bila owner mematikan sistem poin — sembunyikan blok poinnya.
- `attendance.rate` sudah bulat 0–100, tak perlu dihitung ulang.
- Semua tanggal/jam memakai kalender lokal kantor (WIB), bukan UTC.

---

## 4. Aturan keamanan (wajib diikuti)

**Frontend PosPro TIDAK BOLEH memanggil endpoint ini langsung.** Alasannya dua: kunci API
akan bocor ke browser, dan endpoint ini hanya menerima pemanggil loopback.

Jalurnya harus:

```
Browser  →  backend PosPro (:3001)  →  RateMyStaff (:3007)
             menyimpan kunci           memverifikasi kunci + asal lokal
```

Guard di sisi RateMyStaff menolak dengan **401** bila:
- header `x-api-key` tidak ada / salah,
- request membawa header Cloudflare (`cf-ray`, `cf-connecting-ip`, `cf-ipcountry`),
- `x-forwarded-for` / `x-real-ip` menunjuk IP non-loopback.

Sudah diuji: dari `127.0.0.1` dengan kunci benar → 200; kunci salah, `cf-ray` palsu, dan
`x-forwarded-for: 8.8.8.8` semuanya → 401.

### Kunci

Kunci acak sudah dibuat dan tersimpan di `.env` RateMyStaff sebagai `HR_API_KEY`.
Salin nilai yang sama ke `.env` backend PosPro, mis. `HR_API_KEY=...`, lalu baca dari sana —
jangan ditulis di kode.

---

## 5. Saran implementasi di PosPro

**Backend** (`backend/src/`) — satu modul kecil, mencontoh pola `integrations` yang sudah ada
di sana:

- `GET /hr/summary` di balik `JwtAuthGuard` + `RolesGuard` (OWNER/ADMIN saja — isinya nama
  karyawan dan keterlambatan, bukan konsumsi umum).
- Service memanggil RateMyStaff dengan `fetch`, **timeout 5 detik**, dan **cache 60 detik**
  di memori. Kartu sekilas tak perlu real-time, dan cache melindungi dari polling berlebihan.
- Bila RateMyStaff mati / timeout: **jangan lempar error**. Balas `{ available: false }` agar
  dashboard PosPro tetap tampil utuh. Ini penting — kartu tambahan tidak boleh bisa
  menjatuhkan halaman utama.

**Frontend** (`frontend/src/`) — satu komponen kartu di dashboard:

- Keadaan **memuat**: kerangka (skeleton) seukuran kartu, jangan spinner di tengah layar.
- Keadaan **tak tersedia** (`available: false`): teks samar "Data HR tak bisa dihubungi",
  tanpa warna merah — ini bukan kesalahan pengguna.
- Angka besar untuk kehadiran, angka kecil untuk sisanya. Nama-nama cukup teks kecil.
- Satu tautan di pojok: **"Buka RateMyStaff"** → `https://absensi.volikoprint.com`.
- Auto-refresh tiap 5 menit sudah lebih dari cukup.

---

## 6. Uji terima

Kartu dianggap selesai bila:

1. Menampilkan angka yang sama dengan halaman Absensi RateMyStaff pada hari yang sama.
2. Tetap tampil rapi saat RateMyStaff dimatikan (`pm2 stop ratemystaff`) — tanpa error di
   konsol, dashboard PosPro tidak rusak.
3. Kunci API tidak terlihat di Network tab browser.
4. Owner yang login di PosPro bisa melihatnya; kasir biasa tidak.

---

## 7. Berkas terkait di RateMyStaff

| Berkas | Isi |
|---|---|
| `app/api/integrations/hr-summary/route.ts` | Endpoint ringkasan |
| `lib/services/integrations/guard.ts` | Verifikasi kunci + asal lokal |
| `.env` (`HR_API_KEY`) | Kunci bersama; salin ke PosPro |
