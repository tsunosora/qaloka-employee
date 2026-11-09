import type { Prisma, PrismaClient } from "@prisma/client";
import { daftarFoto } from "./jurnal";
import { progresMisi, uraiBukti, labelKategori, labelLevel, petaKategori, KATEGORI_AWAL, type PetaKategori, type ProgresMisi } from "./misi";
import { namaPengurus } from "./pembimbing";

type Db = PrismaClient | Prisma.TransactionClient;

/** Semua kategori side quest (termasuk nonaktif), urut tampilan. */
export async function daftarKategori(db: Db) {
  return db.magangMisiKategori.findMany({ orderBy: [{ urutan: "asc" }, { nama: "asc" }, { id: "asc" }] });
}

/** Daftar kategori + petanya sekaligus (untuk label). */
export async function kategoriDanPeta(db: Db) {
  const kategori = await daftarKategori(db);
  return { kategori, peta: petaKategori(kategori) };
}

type KategoriBaris = { id: number; kunci: string; nama: string; ringkas: string | null; prioritas: string | null; urutan: number; aktif: boolean };

/** Bentuk kategori untuk dasbor admin. jumlahMisi = misi belum dihapus; dipakai = semua rujukan (penghalang hapus). */
export function serialisasiKategori(k: KategoriBaris, hitung: { jumlahMisi: number; dipakai: number }) {
  return {
    id: k.id,
    kunci: k.kunci,
    nama: k.nama,
    ringkas: k.ringkas,
    prioritas: k.prioritas,
    urutan: k.urutan,
    aktif: k.aktif,
    jumlahMisi: hitung.jumlahMisi,
    dipakai: hitung.dipakai,
  };
}

/** Jumlah misi satu kategori: yang belum dihapus & semua (termasuk terhapus). */
export async function hitungPemakaianKategori(db: Db, kunci: string) {
  const [jumlahMisi, dipakai] = await Promise.all([
    db.magangMisi.count({ where: { kategori: kunci, deletedAt: null } }),
    db.magangMisi.count({ where: { kategori: kunci } }),
  ]);
  return { jumlahMisi, dipakai };
}

/** Semua kategori + jumlah pemakaiannya (dua kueri groupBy, bukan per kategori). */
export async function daftarKategoriAdmin(db: Db) {
  const [kategori, semua, hidup] = await Promise.all([
    daftarKategori(db),
    db.magangMisi.groupBy({ by: ["kategori"], _count: { _all: true } }),
    db.magangMisi.groupBy({ by: ["kategori"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const n = (g: typeof semua, kunci: string) => g.find((x) => x.kategori === kunci)?._count._all ?? 0;
  return kategori.map((k) => serialisasiKategori(k, { jumlahMisi: n(hidup, k.kunci), dipakai: n(semua, k.kunci) }));
}

/**
 * Pastikan kategori bawaan (KATEGORI_AWAL) ada — dipakai "Pakai bank misi awal" sebelum memasukkan misi
 * contoh. createMany + skipDuplicates = INSERT IGNORE: kategori yang sudah ada (mungkin sudah diganti
 * nama/dinonaktifkan admin) TIDAK diubah, dan dua klik bersamaan tidak saling bentrok. Bukan DDL.
 */
export async function pastikanKategoriAwal(db: Db) {
  await db.magangMisiKategori.createMany({
    data: KATEGORI_AWAL.map((k) => ({ kunci: k.kunci, nama: k.nama, ringkas: k.ringkas, prioritas: k.prioritas, urutan: k.urutan })),
    skipDuplicates: true,
  });
}

/**
 * Misi yang sedang diberikan ke semua peserta: misi aktif, tidak dihapus, DAN kategorinya aktif
 * (menonaktifkan kategori = menonaktifkan semua misinya tanpa mengubah baris misi).
 */
export async function misiAktif(db: Db) {
  return db.magangMisi.findMany({
    where: { aktif: true, deletedAt: null, kategoriRef: { aktif: true } },
    orderBy: [{ kategoriRef: { urutan: "asc" } }, { kategori: "asc" }, { urutan: "asc" }, { id: "asc" }],
  });
}

export function serialisasiMisi(
  m: {
    id: number;
    kategori: string;
    level: string;
    judul: string;
    deskripsi: string | null;
    bukti: string;
    poin: number;
    urutan: number;
    aktif: boolean;
  },
  peta: PetaKategori
) {
  return {
    id: m.id,
    kategori: m.kategori,
    kategoriLabel: labelKategori(m.kategori, peta),
    level: m.level,
    levelLabel: labelLevel(m.level),
    judul: m.judul,
    deskripsi: m.deskripsi,
    bukti: uraiBukti(m.bukti),
    poin: m.poin,
    urutan: m.urutan,
    aktif: m.aktif,
  };
}

/** Progres side quest beberapa peserta sekaligus (tiga kueri). */
export async function progresPeserta(db: Db, pesertaIds: readonly number[]): Promise<Map<number, ProgresMisi>> {
  const [misi, kategori, kiriman] = await Promise.all([
    misiAktif(db),
    daftarKategori(db),
    pesertaIds.length
      ? db.magangMisiKiriman.findMany({ where: { pesertaId: { in: [...pesertaIds] } }, select: { pesertaId: true, misiId: true, status: true } })
      : Promise.resolve([] as { pesertaId: number; misiId: number; status: string }[]),
  ]);
  const hasil = new Map<number, ProgresMisi>();
  for (const id of pesertaIds) hasil.set(id, progresMisi(misi, kiriman.filter((k) => k.pesertaId === id), kategori));
  return hasil;
}

type KirimanBaris = {
  id: number;
  misiId: number;
  pesertaId: number;
  teks: string | null;
  tautan: string | null;
  foto: Prisma.JsonValue;
  status: string;
  catatan: string | null;
  kirimKe: number;
  dikirimAt: Date;
  diputusAt: Date | null;
  diputusOleh?: { name: string | null } | null;
  diputusOlehKaryawan?: { fullName: string; nickname: string | null } | null;
};

/** Bentuk kiriman untuk klien. Foto dikirim sebagai JUMLAH (tersaji lewat rute ber-login/ber-PIN). */
export function serialisasiKiriman(k: KirimanBaris) {
  return {
    id: k.id,
    misiId: k.misiId,
    pesertaId: k.pesertaId,
    teks: k.teks,
    tautan: k.tautan,
    jumlahFoto: daftarFoto(k.foto).length,
    status: k.status,
    catatan: k.catatan,
    kirimKe: k.kirimKe,
    dikirimAt: k.dikirimAt.toISOString(),
    diputusAt: k.diputusAt ? k.diputusAt.toISOString() : null,
    diputusOleh: namaPengurus(k.diputusOleh, k.diputusOlehKaryawan),
  };
}

export const includePengurus = {
  diputusOleh: { select: { name: true } },
  diputusOlehKaryawan: { select: { fullName: true, nickname: true } },
} as const;

/**
 * Setujui/tolak satu kiriman yang MENUNGGU. oleh = akun dasbor (userId) ATAU karyawan pembimbing
 * (lewat halaman pribadinya). Kembalikan false bila kiriman tidak ada / sudah diputus.
 */
export async function putusKiriman(
  db: Db,
  id: number,
  aksi: "setujui" | "tolak",
  catatan: string | null,
  oleh: { userId: number | null } | { karyawanId: number }
): Promise<"ok" | "tidak-ada" | "sudah-diputus"> {
  // updateMany dengan syarat status → dua pembimbing yang menekan bersamaan tidak saling menimpa.
  const r = await db.magangMisiKiriman.updateMany({
    where: { id, status: "menunggu" },
    data: {
      status: aksi === "setujui" ? "disetujui" : "ditolak",
      catatan,
      diputusAt: new Date(),
      diputusOlehId: "userId" in oleh ? oleh.userId : null,
      diputusOlehKaryawanId: "karyawanId" in oleh ? oleh.karyawanId : null,
    },
  });
  if (r.count === 0) return (await db.magangMisiKiriman.count({ where: { id } })) ? "sudah-diputus" : "tidak-ada";
  return "ok";
}

/** Daftar kiriman untuk pengurus (dasbor / Bimbingan) — paling lama menunggu di atas. */
export async function daftarKiriman(
  db: Db,
  filter: { status?: string; pesertaId?: number; sekolah?: string | null; hanyaAktif?: boolean }
) {
  const { peta } = await kategoriDanPeta(db);
  const baris = await db.magangMisiKiriman.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.pesertaId ? { pesertaId: filter.pesertaId } : {}),
      misi: { deletedAt: null },
      peserta: {
        employee: { deletedAt: null },
        ...(filter.hanyaAktif ? { aktif: true } : {}),
        ...(filter.sekolah ? { sekolah: filter.sekolah } : {}),
      },
    },
    orderBy: { dikirimAt: "asc" },
    take: 300,
    include: {
      ...includePengurus,
      misi: true,
      peserta: { select: { id: true, sekolah: true, employee: { select: { fullName: true, nickname: true } } } },
    },
  });
  return baris.map((k) => ({
    ...serialisasiKiriman(k),
    misi: serialisasiMisi(k.misi, peta),
    peserta: { id: k.peserta.id, nama: k.peserta.employee.nickname || k.peserta.employee.fullName, sekolah: k.peserta.sekolah },
  }));
}
