/**
 * Penegak lisensi di server: fitur per jalur, hanya-baca, dan batas angka.
 *
 * Dipanggil dari `route()` di lib/http.ts, jadi SEMUA rute API yang dibungkus `route()` ikut —
 * tidak ada rute yang harus ingat memanggilnya sendiri. Yang sengaja tidak dibungkus `route()`
 * (penerimaan scan dari mesin: /iclock, /api/fingerspot/*) tidak pernah dijaga lisensi.
 *
 * Bentuk 403-nya sama dengan POS & Event, dan TIDAK menyebut nama paket: rute publik (portal,
 * rating tamu) lewat sini tanpa login, dan nama paket di jawaban galat membocorkan tingkat
 * langganan klien ke siapa pun yang tahu alamatnya.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { batasLisensi, bolehFitur } from "./keadaan-lisensi";
import { keadaanLisensi } from "./layanan";
import { ATURAN_API, METODE_BACA, bebasHanyaBaca, fiturUntuk } from "./aturan-jalur";
import { KODE_BATAS_DITEGAKKAN, putusanBatas, type PutusanBatas } from "./aturan-batas";

/** Sebabnya disebut apa adanya: kunci yang salah alamat BUKAN langganan yang habis. */
export function pesanHanyaBaca(alasan: string | null): string {
  const sebab =
    alasan === "masa_berlaku_habis"
      ? "Lisensi Qaloka sudah habis masa berlakunya"
      : "Kunci lisensi Qaloka tidak cocok dengan instalasi ini";
  const jalan =
    alasan === "masa_berlaku_habis"
      ? "Perbarui langganan di qaloka.com, lalu segarkan lisensinya dari Pengaturan → Langganan."
      : "Hubungi tim Qaloka supaya kuncinya diterbitkan ulang.";
  return (
    `${sebab}, jadi aplikasi sedang HANYA-BACA: data lama tetap bisa dibuka, dicari, dan ` +
    `diekspor, dan absensi dari mesin tetap masuk — tapi data baru belum bisa disimpan dari layar. ${jalan}`
  );
}

/** Jawaban 403 kalau permintaan ini ditolak lisensi, atau null kalau boleh lewat. */
export async function tolakOlehLisensi(req: Request): Promise<Response | null> {
  let jalur: string;
  try {
    jalur = new URL(req.url).pathname;
  } catch {
    return null;
  }
  const keadaan = await keadaanLisensi().catch(() => null);
  if (!keadaan || !keadaan.ditegakkan) return null; // gagal-terbuka

  if (keadaan.hanyaBaca && !METODE_BACA.has(req.method.toUpperCase()) && !bebasHanyaBaca(jalur)) {
    return NextResponse.json(
      {
        statusCode: 403,
        error: "Forbidden",
        kode: "lisensi_hanya_baca",
        alasan: keadaan.alasan,
        // `message` yang dibaca lib/fetcher.ts untuk ditampilkan di layar.
        message: pesanHanyaBaca(keadaan.alasan),
      },
      { status: 403 },
    );
  }

  // Saat HANYA-BACA, penjaga fitur DIMATIKAN: semua penulisan sudah ditolak di atas, jadi
  // yang tersisa cuma membaca — dan janji mode ini "data lama tetap bisa dibuka". Tanpa ini,
  // kunci yang TIDAK SAH (alamat salah, tanda tangan rusak) membawa daftar fitur KOSONG dan
  // menolak membaca apa pun: GET /api/employees → 403. Ketahuan 11 Okt 2026 di aplikasi yang
  // benar-benar jalan, bukan dari tes. (POS kemungkinan punya cacat yang sama.)
  if (keadaan.hanyaBaca) return null;

  const fitur = fiturUntuk(jalur, ATURAN_API);
  if (fitur && !bolehFitur(keadaan, fitur)) {
    const pesan =
      `Fitur ini tidak termasuk paket langganan yang terpasang (kode: ${fitur}). ` +
      "Tambahkan lewat portal qaloka.com, lalu segarkan kunci lisensinya.";
    return NextResponse.json(
      { statusCode: 403, error: "Forbidden", kode: "lisensi_fitur_tidak_ada", fitur: [fitur], message: pesan },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Fitur mana yang TAMPIL di layar tanpa login (tab portal karyawan). Kosmetik — rute API-nya
 * sendiri yang menolak sungguhan. Aturannya sama dengan penegak di atas: tanpa kunci atau saat
 * hanya-baca semuanya tampil (gagal-terbuka; hanya-baca tetap boleh MEMBACA riwayat).
 */
export async function fiturTampil(kode: readonly string[]): Promise<Record<string, boolean>> {
  const keadaan = await keadaanLisensi().catch(() => null);
  if (!keadaan || !keadaan.ditegakkan || keadaan.hanyaBaca) {
    return Object.fromEntries(kode.map((k) => [k, true]));
  }
  return Object.fromEntries(kode.map((k) => [k, bolehFitur(keadaan, k)]));
}

/** Hitung pemakaian satu batas yang ditegakkan. null = kodenya tidak dikenal. */
export async function hitungPemakaian(kode: string): Promise<number | null> {
  switch (kode) {
    // Karyawan AKTIF yang belum dihapus — yang keluar (isActive:false) tidak dihitung, supaya
    // menonaktifkan karyawan yang sudah resign memang jalan keluarnya.
    case "limit.employees":
      return prisma.employee.count({ where: { isActive: true, deletedAt: null } });
    // Mesin tidak punya kolom aktif; menghapus mesin itu hapus permanen.
    case "limit.machines":
      return prisma.machine.count();
    case "limit.users":
      return prisma.user.count({ where: { isActive: true } });
    default:
      return null;
  }
}

/** Boleh menambah satu lagi? Gagal-terbuka di tiap langkah. */
export async function periksaBatas(kode: string, tambah = 1): Promise<PutusanBatas | null> {
  if (!KODE_BATAS_DITEGAKKAN.includes(kode)) return null;
  const keadaan = await keadaanLisensi().catch(() => null);
  if (!keadaan || !keadaan.ditegakkan) return null;
  const batas = batasLisensi(keadaan, kode);
  if (batas === null) return null;
  const pemakaian = await hitungPemakaian(kode).catch(() => null);
  if (pemakaian === null) return null;
  // `tambah` > 1 dipakai impor massal: menambah N sekaligus = pemakaian + N - 1 harus < batas.
  return putusanBatas({ kode, batas, pemakaian: pemakaian + Math.max(0, tambah - 1) });
}

/**
 * Lempar 403 kalau batasnya penuh. Panggil TEPAT SEBELUM membuat baris baru (atau mengaktifkan
 * kembali), sesudah pemeriksaan login & peran. JANGAN dipanggil saat mengubah atau menghapus.
 */
export async function wajibBolehMenambah(kode: string): Promise<void> {
  const putusan = await periksaBatas(kode);
  if (!putusan || putusan.boleh) return;
  throw NextResponse.json(
    {
      statusCode: 403,
      error: "Forbidden",
      kode: "lisensi_batas_penuh",
      batas: { kode, nilai: putusan.batas, pemakaian: putusan.pemakaian },
      message: putusan.pesan,
    },
    { status: 403 },
  );
}

/** Versi yang tidak melempar — untuk jalur otomatis (mesin) yang tidak boleh gagal. */
export async function bolehMenambah(kode: string): Promise<boolean> {
  const putusan = await periksaBatas(kode);
  return !putusan || putusan.boleh;
}

/** Pemakaian semua batas yang ditegakkan dan punya nilai di kunci — untuk halaman Langganan. */
export async function ringkasanPemakaian(): Promise<Record<string, number>> {
  const keadaan = await keadaanLisensi().catch(() => null);
  if (!keadaan || !keadaan.ditegakkan) return {};
  const hasil: Record<string, number> = {};
  for (const kode of KODE_BATAS_DITEGAKKAN) {
    if (batasLisensi(keadaan, kode) === null) continue;
    const n = await hitungPemakaian(kode).catch(() => null);
    if (n !== null) hasil[kode] = n;
  }
  return hasil;
}
