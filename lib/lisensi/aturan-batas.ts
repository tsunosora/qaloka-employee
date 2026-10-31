/**
 * Batas angka dari kunci lisensi Qaloka Employee — MURNI (tanpa DB), supaya bisa diuji.
 *
 * Aturannya sama dengan Qaloka POS (backend/src/lisensi/aturan-batas.ts), dan tiga keputusan
 * pemiliknya dipertahankan:
 * 1. Klien yang SUDAH lewat batas DIBIARKAN. Tidak ada karyawan dinonaktifkan, tidak ada mesin
 *    dilepas — yang ditolak cuma PENAMBAHAN baru selama jumlahnya masih di atas batas.
 * 2. `null` (atau kode yang tidak ada di kunci) = tanpa batas. `0` punya arti sendiri: tidak
 *    termasuk paket.
 * 3. Gagal-terbuka: tanpa kunci, atau penghitungan gagal, berarti boleh.
 *
 * SATU beda dari POS, disengaja: pesannya TIDAK menyebut nama paket. Rute publik (portal, rating
 * tamu) ikut lewat penjaga yang sama, dan nama paket di jawaban galat membuat siapa pun bisa
 * memetakan klien Qaloka mana membayar tingkat apa. Kejadian yang sama sudah ditutup di POS &
 * Event 7 Okt 2026 untuk 403 fitur.
 */

export interface JenisBatas {
  /** Kode persis seperti di `data/paket.json` repo qendali. Jangan karang nama baru. */
  kode: string;
  nama: string;
  /** Bentuk yang enak disambung di tengah kalimat: "30 karyawan". */
  satuan: string;
  /** Jalan keluar yang TIDAK menuntut naik paket. */
  saran: string;
}

/**
 * Batas yang benar-benar MENOLAK penambahan. Menambah baris di sini belum cukup: `batas.ts`
 * harus tahu cara menghitungnya, dan tempat penambahannya harus memanggil pemeriksa.
 */
export const BATAS_DITEGAKKAN: readonly JenisBatas[] = [
  {
    kode: "limit.employees",
    nama: "Karyawan",
    satuan: "karyawan",
    saran: "nonaktifkan karyawan yang sudah keluar dulu",
  },
  {
    kode: "limit.machines",
    nama: "Mesin absensi",
    satuan: "mesin absensi",
    saran: "hapus mesin yang sudah tidak dipakai dulu",
  },
  {
    kode: "limit.users",
    nama: "Pengguna",
    satuan: "akun pengguna",
    saran: "nonaktifkan akun yang tidak dipakai dulu",
  },
];

export const KODE_BATAS_DITEGAKKAN: readonly string[] = BATAS_DITEGAKKAN.map((j) => j.kode);

export const jenisBatas = (kode: string): JenisBatas | undefined =>
  BATAS_DITEGAKKAN.find((j) => j.kode === kode);

export interface PutusanBatas {
  kode: string;
  batas: number | null;
  pemakaian: number;
  sisa: number | null;
  boleh: boolean;
  penuh: boolean;
  lewat: boolean;
  pesan: string | null;
}

const KEMANA = "Naikkan paket lewat portal qaloka.com";

export function putusanBatas({
  kode,
  batas,
  pemakaian,
}: {
  kode: string;
  batas: number | null | undefined;
  pemakaian: number;
}): PutusanBatas {
  const jenis = jenisBatas(kode);
  const satuan = jenis?.satuan ?? kode;
  const saran = jenis?.saran ?? "kurangi yang sudah ada dulu";
  const jumlah = Number.isFinite(pemakaian) && pemakaian > 0 ? Math.trunc(pemakaian) : 0;

  // `null` = tanpa batas. JANGAN ditulis `!batas` — 0 punya arti sendiri.
  if (batas === null || batas === undefined) {
    return { kode, batas: null, pemakaian: jumlah, sisa: null, boleh: true, penuh: false, lewat: false, pesan: null };
  }

  const sisa = batas - jumlah;
  const boleh = jumlah < batas;
  const dasar = { kode, batas, pemakaian: jumlah, sisa, boleh };
  if (boleh) return { ...dasar, penuh: false, lewat: false, pesan: null };

  if (batas === 0) {
    return {
      ...dasar,
      penuh: true,
      lewat: jumlah > 0,
      pesan: `Langganan ini tidak memasukkan ${satuan} sama sekali, jadi menambah ${satuan} baru belum bisa. ${KEMANA} kalau memang butuh.`,
    };
  }
  if (jumlah > batas) {
    return {
      ...dasar,
      penuh: true,
      lewat: true,
      pesan:
        `Langganan ini membatasi ${batas} ${satuan}, dan sekarang sudah ada ${jumlah}. ` +
        `Yang ${jumlah} itu tetap jalan seperti biasa — yang belum bisa cuma menambah yang baru. ` +
        `${KEMANA}, atau ${saran}.`,
    };
  }
  return {
    ...dasar,
    penuh: true,
    lewat: false,
    pesan: `Langganan ini membatasi ${batas} ${satuan}, dan sekarang sudah ada ${jumlah}. ${KEMANA}, atau ${saran}.`,
  };
}
