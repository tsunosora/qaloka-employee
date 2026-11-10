/**
 * Jadwal harian berpasangan — akses DB (rute dasbor pembina, rute HP anak, pantau guru, skrip data). Logika murni
 * di harian.ts. Tanggal disimpan DateTime tengah malam WIB (atMidnight/toYmd), bukan @db.Date.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { panggilan } from "@/lib/services/magang/konten-db";
import {
  bentrokPasangan,
  hariKerja,
  jadwalAnak,
  jadwalMinggu,
  seninH,
  tambahHariH,
  teksWA,
  urutAnakPasangan,
  type AnakH,
  type CalonPasangan,
  type HasilAnak,
  type JenisPengecualian,
  type PasanganH,
  type PengecualianH,
  type TugasHarian,
} from "@/lib/services/magang/harian";

type Db = PrismaClient | Prisma.TransactionClient;

const tugasSah = (v: string | null): TugasHarian | null => (v === "konten" || v === "produksi" ? v : null);

export function pasanganDariDb(p: {
  id: number;
  nama: string | null;
  pesertaAId: number;
  pesertaBId: number | null;
  patokanTanggal: Date;
  patokanTugas: string;
  aktif: boolean;
  urutan: number;
}): PasanganH {
  return { id: p.id, nama: p.nama, pesertaAId: p.pesertaAId, pesertaBId: p.pesertaBId, patokanTanggal: toYmd(p.patokanTanggal), patokanTugas: tugasSah(p.patokanTugas) ?? "konten", aktif: p.aktif, urutan: p.urutan };
}

export function pengecualianDariDb(e: {
  id: number;
  tanggal: Date;
  pasanganId: number | null;
  pesertaId: number | null;
  jenis: string;
  tugas: string | null;
  pasanganPesertaId: number | null;
  catatan: string | null;
}): PengecualianH {
  return {
    id: e.id,
    tanggal: toYmd(e.tanggal),
    pasanganId: e.pasanganId,
    pesertaId: e.pesertaId,
    jenis: (["tugas", "libur", "pasangan"].includes(e.jenis) ? e.jenis : "tugas") as JenisPengecualian,
    tugas: tugasSah(e.tugas),
    pasanganPesertaId: e.pasanganPesertaId,
    catatan: e.catatan,
  };
}

/** Semua peserta (karyawan belum dihapus) + masa magang; aktif = peserta aktif DAN karyawan aktif. */
export async function muatAnakHarian(db: Db): Promise<Map<number, AnakH>> {
  const rows = await db.magangPeserta.findMany({
    where: { employee: { deletedAt: null } },
    orderBy: { id: "asc" },
    select: { id: true, mulai: true, selesai: true, aktif: true, employee: { select: { fullName: true, nickname: true, isActive: true } } },
  });
  return new Map(
    rows.map((p) => [p.id, { pesertaId: p.id, panggilan: panggilan(p.employee), mulai: toYmd(p.mulai), selesai: p.selesai ? toYmd(p.selesai) : null, aktif: p.aktif && p.employee.isActive }])
  );
}

export async function muatPasangan(db: Db): Promise<PasanganH[]> {
  const rows = await db.magangPasangan.findMany({ orderBy: [{ urutan: "asc" }, { id: "asc" }] });
  return rows.map(pasanganDariDb);
}

export async function muatPengecualian(db: Db, dari: string, sampai: string): Promise<PengecualianH[]> {
  const rows = await db.magangHarianPengecualian.findMany({ where: { tanggal: { gte: atMidnight(dari), lte: atMidnight(sampai) } }, orderBy: { id: "asc" } });
  return rows.map(pengecualianDariDb);
}

/** Holiday dalam rentang → peta tanggal → nama. */
export async function muatLibur(db: Db, dari: string, sampai: string): Promise<Map<string, string>> {
  const rows = await db.holiday.findMany({ where: { date: { gte: atMidnight(dari), lte: atMidnight(sampai) } }, select: { date: true, name: true } });
  return new Map(rows.map((h) => [toYmd(h.date), h.name]));
}

/**
 * Holiday yang dibutuhkan untuk menghitung giliran di [dari, sampai]: dari patokan paling awal / akhir pasangan sampai
 * rentang (giliran dihitung dari patokan, jadi libur di antaranya ikut menentukan).
 */
async function liburUntuk(db: Db, pasangan: readonly PasanganH[], dari: string, sampai: string) {
  const tgl = [dari, sampai, ...pasangan.map((p) => p.patokanTanggal)].sort();
  return muatLibur(db, tgl[0], tgl[tgl.length - 1]);
}

/** Data satu minggu (Senin–Sabtu) untuk dasbor pembina. */
export async function dataMinggu(db: Db, tanggal: string, hariIni: string) {
  const senin = seninH(tanggal);
  const sabtu = tambahHariH(senin, 5);
  const [anak, pasangan, pengecualian] = await Promise.all([muatAnakHarian(db), muatPasangan(db), muatPengecualian(db, senin, sabtu)]);
  const libur = await liburUntuk(db, pasangan, senin, sabtu);
  const setLibur = new Set(libur.keys());
  const hari = jadwalMinggu({ senin, pasangan, libur: setLibur, pengecualian, anak });
  const diPasangan = new Map<number, number>();
  for (const p of pasangan) if (p.aktif) for (const x of [p.pesertaAId, p.pesertaBId]) if (x != null) diPasangan.set(x, p.id);
  return {
    senin,
    sabtu,
    hariIni,
    hari: hari.map((h) => ({ tanggal: h.tanggal, hariKerja: h.hariKerja, libur: libur.get(h.tanggal) ?? null, sel: h.sel })),
    pasangan: pasangan.map((p) => ({ ...p, namaA: anak.get(p.pesertaAId)?.panggilan ?? `#${p.pesertaAId}`, namaB: p.pesertaBId != null ? anak.get(p.pesertaBId)?.panggilan ?? `#${p.pesertaBId}` : null })),
    pengecualian,
    anak: [...anak.values()].map((a) => ({ ...a, pasanganId: diPasangan.get(a.pesertaId) ?? null })),
    teks: teksWA(hari, anak, urutAnakPasangan(pasangan), libur),
  };
}
export type DataMinggu = Awaited<ReturnType<typeof dataMinggu>>;

/** Jadwal satu anak dalam rentang (dipakai HP anak & pantau guru). */
export async function jadwalSatuAnak(db: Db, pesertaId: number, dari: string, sampai: string): Promise<HasilAnak[]> {
  const [anak, pasangan, pengecualian] = await Promise.all([muatAnakHarian(db), muatPasangan(db), muatPengecualian(db, dari, sampai)]);
  const libur = new Set((await liburUntuk(db, pasangan, dari, sampai)).keys());
  return jadwalAnak({ pesertaId, dari, sampai, pasangan, libur, pengecualian, anak });
}

/** Hari kerja berikutnya sesudah `hari` (maks 14 hari ke depan) — untuk "Besok" di HP anak. */
export async function hariKerjaBerikut(db: Db, hari: string): Promise<string> {
  const libur = new Set((await muatLibur(db, tambahHariH(hari, 1), tambahHariH(hari, 14))).keys());
  for (let i = 1; i <= 14; i++) {
    const t = tambahHariH(hari, i);
    if (hariKerja(t, libur)) return t;
  }
  return tambahHariH(hari, 1);
}

/** Cek aturan satu anak = satu pasangan aktif terhadap DB. Mengembalikan pesan galat atau null. */
export async function cekBentrok(db: Db, calon: CalonPasangan): Promise<string | null> {
  const ada = await db.magangPasangan.findMany({ where: { aktif: true }, select: { id: true, pesertaAId: true, pesertaBId: true, aktif: true } });
  const b = bentrokPasangan(ada, calon);
  if (b.length === 0) return null;
  const anak = await muatAnakHarian(db);
  return `${b.map((x) => anak.get(x.pesertaId)?.panggilan ?? `#${x.pesertaId}`).join(" & ")} sudah ada di pasangan aktif lain. Nonaktifkan / ubah pasangan itu dulu.`;
}

/** Semua anak yang dirujuk harus peserta yang ada (karyawan tidak dihapus). */
export async function pesertaAda(db: Db, ids: readonly (number | null | undefined)[]): Promise<boolean> {
  const daftar = [...new Set(ids.filter((x): x is number => x != null))];
  if (daftar.length === 0) return true;
  const n = await db.magangPeserta.count({ where: { id: { in: daftar }, employee: { deletedAt: null } } });
  return n === daftar.length;
}
