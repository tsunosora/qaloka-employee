/**
 * Aturan absen lewat HP — MURNI (tanpa basis data), supaya tiap keputusan bisa diuji.
 *
 * Tiga pengaman, dipilih Faisal 13 Okt 2026, dan masing-masing menahan hal yang berbeda:
 *  - LOKASI: HP harus di dalam radius lokasi kerja → menahan absen dari rumah. Bisa diakali
 *    aplikasi lokasi palsu, karena itu tidak berdiri sendiri.
 *  - FOTO: bukti yang dilihat owner → menahan titip absen. Pencegah, bukan pemeriksa otomatis.
 *  - SATU HP PER KARYAWAN: HP pertama terkunci → menahan absen pakai HP teman.
 *  - QR BERGANTI (per lokasi, opsional): kode di layar toko berganti tiap SLOT_DETIK → harus
 *    benar-benar berdiri di depan layarnya. Satu-satunya yang tidak bisa diakali dari rumah.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** GPS yang lebih kabur dari ini ditolak — titiknya bisa saja di luar radius. */
export const AKURASI_MAKS_M = 150;
/** Absen kedua dalam jeda ini dianggap ketukan ganda, bukan absen pulang. */
export const JEDA_MENIT = 2;
/** QR berganti tiap sekian detik; kode slot sebelumnya masih diterima (waktu memindai). */
export const SLOT_DETIK = 20;
/** Awalan isi QR — memastikan yang dipindai memang QR absen, bukan QR lain di toko. */
export const AWALAN_QR = "QE1";

export type Lokasi = { id: number; nama: string; lat: number; lng: number; radiusM: number; wajibQr: boolean; qrRahasia: string };

/** Jarak dua titik di permukaan bumi, meter (haversine). */
/** Jarak yang enak dibaca: 850 m, 3,2 km — satu bentuk untuk HP karyawan dan halaman owner. */
export function teksJarak(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}

export function jarakMeter(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function lokasiTerdekat(daftar: readonly Lokasi[], lat: number, lng: number): { lokasi: Lokasi; jarakM: number } | null {
  let hasil: { lokasi: Lokasi; jarakM: number } | null = null;
  for (const l of daftar) {
    const j = jarakMeter(lat, lng, l.lat, l.lng);
    if (!hasil || j < hasil.jarakM) hasil = { lokasi: l, jarakM: j };
  }
  return hasil;
}

export function slotSaatIni(nowMs: number): number {
  return Math.floor(nowMs / 1000 / SLOT_DETIK);
}

export function kodeQr(rahasia: string, slot: number): string {
  return createHmac("sha256", rahasia).update(`qr:${slot}`).digest("hex").slice(0, 12);
}

/** Isi QR yang ditampilkan layar lokasi: "QE1.<idLokasi>.<kode>". */
export function isiQr(lokasi: Pick<Lokasi, "id" | "qrRahasia">, nowMs: number): string {
  return `${AWALAN_QR}.${lokasi.id}.${kodeQr(lokasi.qrRahasia, slotSaatIni(nowMs))}`;
}

function samaPersis(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** QR sah untuk lokasi INI pada slot sekarang atau satu slot sebelumnya. */
export function qrSah(lokasi: Pick<Lokasi, "id" | "qrRahasia">, teks: string | null | undefined, nowMs: number): boolean {
  const m = String(teks ?? "").trim().match(/^QE1\.(\d+)\.([0-9a-f]{12})$/);
  if (!m || Number(m[1]) !== lokasi.id) return false;
  const slot = slotSaatIni(nowMs);
  return [slot, slot - 1].some((s) => samaPersis(m[2], kodeQr(lokasi.qrRahasia, s)));
}

/** Sidik perangkat: yang disimpan cuma ini, bukan id aslinya. */
export function sidikPerangkat(idPerangkat: string): string {
  return createHash("sha256").update(`absen-hp:${idPerangkat}`).digest("hex");
}

export type Masukan = {
  aktif: boolean; // owner menyalakan absen HP untuk karyawan ini
  perangkatTerdaftar: string | null; // sidik yang sudah terkunci, atau null
  idPerangkat: string;
  lokasi: readonly Lokasi[];
  lat: number;
  lng: number;
  akurasiM: number;
  qr: string | null;
  absenTerakhir: Date | null;
  nowMs: number;
};

export type Keputusan =
  | { ok: true; lokasi: Lokasi; jarakM: number; sidik: string; kunciPerangkat: boolean; qr: boolean }
  | { ok: false; alasan: string; kode: string; perluQr?: boolean; jarakM?: number; lokasi?: string };

/** Satu tempat yang memutuskan absen diterima atau tidak — urutan pemeriksaannya disengaja. */
export function putuskanAbsen(m: Masukan): Keputusan {
  if (!m.aktif) return { ok: false, kode: "tidak_aktif", alasan: "Absen lewat HP belum dinyalakan untuk Anda. Hubungi owner." };

  const id = String(m.idPerangkat ?? "").trim();
  if (id.length < 16 || id.length > 128) return { ok: false, kode: "perangkat", alasan: "HP ini tidak dikenali. Muat ulang halaman lalu coba lagi." };
  const sidik = sidikPerangkat(id);
  if (m.perangkatTerdaftar && m.perangkatTerdaftar !== sidik) {
    return { ok: false, kode: "hp_lain", alasan: "Akun Anda terkunci ke HP lain. Minta owner melepas kunci HP kalau Anda ganti HP." };
  }

  if (m.absenTerakhir && m.nowMs - m.absenTerakhir.getTime() < JEDA_MENIT * 60 * 1000) {
    return { ok: false, kode: "baru_saja", alasan: `Anda baru saja absen. Tunggu ${JEDA_MENIT} menit kalau memang mau absen lagi.` };
  }

  if (![m.lat, m.lng, m.akurasiM].every(Number.isFinite) || Math.abs(m.lat) > 90 || Math.abs(m.lng) > 180) {
    return { ok: false, kode: "lokasi_kosong", alasan: "Lokasi HP tidak terbaca. Nyalakan GPS dan izinkan akses lokasi." };
  }
  if (m.akurasiM > AKURASI_MAKS_M) {
    return { ok: false, kode: "kabur", alasan: `Sinyal lokasi kurang akurat (±${Math.round(m.akurasiM)} m). Coba dekat jendela atau di luar ruangan.` };
  }

  const aktif = m.lokasi;
  if (aktif.length === 0) return { ok: false, kode: "tanpa_lokasi", alasan: "Owner belum menentukan lokasi absen." };
  const t = lokasiTerdekat(aktif, m.lat, m.lng)!;
  const jarak = Math.round(t.jarakM);
  if (t.jarakM > t.lokasi.radiusM) {
    return { ok: false, kode: "di_luar", jarakM: jarak, lokasi: t.lokasi.nama, alasan: `Anda ${teksJarak(jarak)} dari ${t.lokasi.nama}. Absen hanya bisa dalam ${t.lokasi.radiusM} m.` };
  }

  let qr = false;
  if (t.lokasi.wajibQr) {
    if (!m.qr) return { ok: false, kode: "perlu_qr", perluQr: true, lokasi: t.lokasi.nama, alasan: `Pindai QR di layar ${t.lokasi.nama}.` };
    if (!qrSah(t.lokasi, m.qr, m.nowMs)) {
      return { ok: false, kode: "qr_salah", perluQr: true, lokasi: t.lokasi.nama, alasan: "QR tidak cocok atau sudah kedaluwarsa. Pindai ulang QR yang sedang tampil." };
    }
    qr = true;
  }

  return { ok: true, lokasi: t.lokasi, jarakM: jarak, sidik, kunciPerangkat: !m.perangkatTerdaftar, qr };
}

/** Tanda tangan berkas gambar yang diterima: JPEG, PNG, WebP. Selain itu ditolak. */
export function jenisGambar(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

// ── Absen DI LUAR lokasi (butuh persetujuan owner) ────────────────────────────────────────────
//
// Untuk karyawan lapangan / dinas luar. Yang DIGANTI persetujuan cuma syarat radius & QR; semua
// pengaman lain tetap: harus dinyalakan owner, HP yang terkunci, GPS akurat, foto, jeda ketukan
// ganda. Hasilnya bukan absen, tapi PENGAJUAN — Attendance baru lahir saat owner menyetujui.

/** Setting owner: "false" mematikan pengajuan di luar lokasi. Bawaan (kosong) = boleh. */
export const SETELAN_LUAR = "absen_hp_luar_lokasi";
/** Pengajuan di luar lokasi per karyawan per hari — menahan pengajuan beruntun yang membanjiri owner. */
export const MAKS_LUAR_PER_HARI = 6;
export const ALASAN_MIN = 5;
export const ALASAN_MAKS = 500;
/** Kode tolakan putuskanAbsen() yang boleh diganti dengan pengajuan. */
export const KODE_BOLEH_LUAR: readonly string[] = ["di_luar", "tanpa_lokasi"];

export function luarDiizinkan(nilaiSetelan: string | null | undefined): boolean {
  return String(nilaiSetelan ?? "").trim().toLowerCase() !== "false";
}

export type MasukanLuar = Masukan & {
  izinkan: boolean; // setelan owner
  alasan: string;
  pengajuanHariIni: number; // pengajuan di luar lokasi milik karyawan ini sejak tengah malam
};

export type KeputusanLuar =
  | { ok: true; lokasi: Lokasi | null; jarakM: number | null; sidik: string; kunciPerangkat: boolean; alasan: string }
  | { ok: false; alasan: string; kode: string };

/**
 * Putuskan pengajuan absen di luar lokasi. Pemeriksaan dasarnya MEMAKAI putuskanAbsen() supaya
 * tidak ada dua salinan aturan pengaman: pengajuan cuma diterima kalau satu-satunya alasan
 * putuskanAbsen() menolak adalah radius (`di_luar`) atau belum ada lokasi (`tanpa_lokasi`).
 * Di dalam radius tidak boleh mengajukan — termasuk lokasi ber-QR wajib: QR-nya harus dipindai.
 */
export function putuskanAbsenLuar(m: MasukanLuar): KeputusanLuar {
  if (!m.izinkan) return { ok: false, kode: "luar_mati", alasan: "Owner tidak mengizinkan absen di luar lokasi." };

  const dasar = putuskanAbsen({ ...m, qr: null });
  if (dasar.ok || dasar.kode === "perlu_qr" || dasar.kode === "qr_salah") {
    return { ok: false, kode: "di_dalam", alasan: "Anda berada di lokasi absen — pakai tombol absen biasa." };
  }
  if (!KODE_BOLEH_LUAR.includes(dasar.kode)) return { ok: false, kode: dasar.kode, alasan: dasar.alasan };

  const alasan = String(m.alasan ?? "").trim();
  if (alasan.length < ALASAN_MIN) return { ok: false, kode: "alasan_pendek", alasan: `Tulis alasannya (minimal ${ALASAN_MIN} huruf), mis. "kunjungan ke pelanggan".` };
  if (alasan.length > ALASAN_MAKS) return { ok: false, kode: "alasan_panjang", alasan: `Alasan terlalu panjang (maksimal ${ALASAN_MAKS} huruf).` };

  if (m.pengajuanHariIni >= MAKS_LUAR_PER_HARI) {
    return { ok: false, kode: "batas_harian", alasan: `Sudah ${MAKS_LUAR_PER_HARI} pengajuan di luar lokasi hari ini. Hubungi owner.` };
  }

  const sidik = sidikPerangkat(String(m.idPerangkat).trim());
  const t = lokasiTerdekat(m.lokasi, m.lat, m.lng);
  return {
    ok: true,
    lokasi: t?.lokasi ?? null,
    jarakM: t ? Math.round(t.jarakM) : null,
    sidik,
    kunciPerangkat: !m.perangkatTerdaftar,
    alasan,
  };
}

export type StatusBukti = "diterima" | "menunggu" | "ditolak";

/** Keputusan owner atas satu pengajuan. Yang sudah diputus tidak bisa diputus ulang. */
export function bolehDiputus(status: string, attendanceId: number | null): { ok: true } | { ok: false; alasan: string } {
  if (status !== "menunggu") return { ok: false, alasan: "Pengajuan ini sudah diputuskan." };
  if (attendanceId !== null) return { ok: false, alasan: "Pengajuan ini sudah tercatat di absensi." };
  return { ok: true };
}

/**
 * Satu baris log untuk absen HP yang DITOLAK (pm2 out log). Penolakan tidak menyimpan apa pun di basis
 * data, jadi tanpa ini owner tidak punya bukti apa-apa saat karyawan bilang "absen saya ditolak"
 * (9 Nov 2026). Sengaja TANPA koordinat, token, atau id perangkat — cukup jarak & akurasi.
 */
export function barisLogTolak(a: {
  employeeId: number; kode: string; jarakM?: number | null; akurasiM?: number; lokasi?: string | null;
  fotoBita?: number | null; fotoTipe?: string | null; nowMs?: number;
}): string {
  const bagian = [`[absen-hp] TOLAK karyawan=${a.employeeId}`, `kode=${a.kode}`];
  if (a.lokasi) bagian.push(`lokasi="${a.lokasi.replace(/"/g, "'")}"`);
  if (Number.isFinite(a.jarakM ?? NaN)) bagian.push(`jarak=${Math.round(a.jarakM as number)}m`);
  if (Number.isFinite(a.akurasiM ?? NaN)) bagian.push(`akurasi=${Math.round(a.akurasiM as number)}m`);
  if (a.fotoBita != null) bagian.push(`foto=${a.fotoBita}B`);
  if (a.fotoTipe) bagian.push(`tipe=${a.fotoTipe}`);
  bagian.push(new Date(a.nowMs ?? Date.now()).toISOString());
  return bagian.join(" ");
}
