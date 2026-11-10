/**
 * Jadwal konten — akses DB (dipakai rute dasbor, rute portal anak, pantauan guru). Logika murni ada di
 * konten.ts; di sini hanya memuat/menyimpan dan menyusun objek JSON yang dikirim (medan yang diizinkan).
 */

import { NextResponse } from "next/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import {
  KUNCI_BRIEF,
  KUNCI_POLA,
  POLA_BAWAAN,
  bolehDiganti,
  geserBulan,
  labelKonsep,
  susunBulan,
  type AnakKonten,
  type BarisAda,
  type GrupKonten,
  type PolaHari,
  type PolaKonten,
} from "@/lib/services/magang/konten";
import { polaSchema, uraiBrief, type BriefKonten } from "@/lib/validators/magang-konten";

type Db = PrismaClient | Prisma.TransactionClient;

// ── Setelan ───────────────────────────────────────────────────────────────────────────────────

export async function muatBrief(db: Db): Promise<BriefKonten> {
  const row = await db.setting.findUnique({ where: { key: KUNCI_BRIEF }, select: { value: true } });
  return uraiBrief(row?.value);
}

export async function muatPola(db: Db): Promise<PolaKonten> {
  const row = await db.setting.findUnique({ where: { key: KUNCI_POLA }, select: { value: true } });
  if (!row?.value) return POLA_BAWAAN;
  try {
    const r = polaSchema.safeParse(JSON.parse(row.value));
    if (!r.success) return POLA_BAWAAN;
    const hari: PolaHari = {};
    for (const h of [1, 2, 3, 4, 5, 6] as const) if (r.data.hari[h]) hari[h] = r.data.hari[h]!;
    return { hari, empathy: r.data.empathy || null, selangHari: r.data.selangHari };
  } catch {
    return POLA_BAWAAN;
  }
}

// ── Master data ───────────────────────────────────────────────────────────────────────────────

export type TautanLabel = { label: string; url: string };
export function uraiReferensi(v: unknown): TautanLabel[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is { label?: unknown; url?: unknown } => !!x && typeof x === "object")
    .map((x) => ({ label: typeof x.label === "string" ? x.label : "", url: typeof x.url === "string" ? x.url : "" }))
    .filter((x) => x.url || x.label);
}

export async function muatKonsep(db: Db) {
  const rows = await db.magangKontenKonsep.findMany({ orderBy: [{ urutan: "asc" }, { id: "asc" }] });
  return rows.map((k) => ({
    id: k.id,
    kunci: k.kunci,
    nama: k.nama,
    sub: k.sub,
    label: labelKonsep(k),
    warna: k.warna,
    referensi: uraiReferensi(k.referensi),
    urutan: k.urutan,
    aktif: k.aktif,
  }));
}
export type KonsepJson = Awaited<ReturnType<typeof muatKonsep>>[number];

export async function muatStatus(db: Db) {
  const rows = await db.magangKontenStatus.findMany({ orderBy: [{ urutan: "asc" }, { id: "asc" }] });
  return rows.map((s) => ({ id: s.id, kunci: s.kunci, nama: s.nama, warna: s.warna, urutan: s.urutan, aktif: s.aktif, anakBoleh: s.anakBoleh, final: s.final }));
}
export type StatusJson = Awaited<ReturnType<typeof muatStatus>>[number];

export async function muatGrup(db: Db) {
  const rows = await db.magangKontenGrup.findMany({ orderBy: [{ urutan: "asc" }, { id: "asc" }], include: { anggota: { select: { pesertaId: true } } } });
  return rows.map((g) => ({ id: g.id, nama: g.nama, warna: g.warna, urutan: g.urutan, aktif: g.aktif, anggota: g.anggota.map((a) => a.pesertaId).sort((a, b) => a - b) }));
}
export type GrupJson = Awaited<ReturnType<typeof muatGrup>>[number];

export const panggilan = (e: { fullName: string; nickname: string | null }) => e.nickname?.trim() || e.fullName.trim().split(/\s+/)[0] || e.fullName;

/** Semua peserta (karyawan belum dihapus) — aktif ditandai; baris lama anak nonaktif tetap bernama. */
export async function muatAnak(db: Db) {
  const rows = await db.magangPeserta.findMany({
    where: { employee: { deletedAt: null } },
    orderBy: [{ kodeKonten: "asc" }, { id: "asc" }],
    select: { id: true, kodeKonten: true, aktif: true, employee: { select: { fullName: true, nickname: true, isActive: true } } },
  });
  return rows.map((p) => ({
    pesertaId: p.id,
    kode: p.kodeKonten,
    panggilan: panggilan(p.employee),
    namaLengkap: p.employee.fullName,
    aktif: p.aktif && p.employee.isActive,
  }));
}
export type AnakJson = Awaited<ReturnType<typeof muatAnak>>[number];

/** Status awal baris baru: "belum-take" bila aktif, selain itu status aktif bukan-final pertama. */
export function statusAwal(status: readonly StatusJson[]): StatusJson | null {
  return status.find((s) => s.kunci === "belum-take" && s.aktif) ?? status.find((s) => s.aktif && !s.final) ?? null;
}

// ── Baris ─────────────────────────────────────────────────────────────────────────────────────

export const includeBaris = {
  diubahOleh: { select: { name: true } },
  diubahOlehKaryawan: { select: { fullName: true, nickname: true } },
} satisfies Prisma.MagangKontenInclude;
type BarisDb = Prisma.MagangKontenGetPayload<{ include: typeof includeBaris }>;

export function serialisasiBaris(b: BarisDb) {
  return {
    id: b.id,
    tanggal: toYmd(b.tanggal),
    konsepId: b.konsepId,
    pesertaId: b.pesertaId,
    grupId: b.grupId,
    statusId: b.statusId,
    judul: b.judul,
    ref: b.ref,
    caption: b.caption,
    linkFootage: b.linkFootage,
    linkEkspor: b.linkEkspor,
    catatan: b.catatan,
    usulan: b.usulan,
    urutan: b.urutan,
    selesaiAt: b.selesaiAt?.toISOString() ?? null,
    diubahOleh: b.diubahOlehKaryawan ? panggilan(b.diubahOlehKaryawan) : (b.diubahOleh?.name ?? null),
    updatedAt: b.updatedAt.toISOString(),
  };
}
export type BarisJson = ReturnType<typeof serialisasiBaris>;

export function rentangBulan(bulan: string) {
  return { gte: atMidnight(`${bulan}-01`), lt: atMidnight(`${geserBulan(bulan, 1)}-01`) };
}

export async function liburBulan(db: Db, bulan: string) {
  const rows = await db.holiday.findMany({ where: { date: rentangBulan(bulan) }, select: { date: true, name: true } });
  return rows.map((h) => ({ tanggal: toYmd(h.date), nama: h.name }));
}

/** Semua yang dibutuhkan tabel pembina untuk satu bulan. */
export async function dataBulan(db: Db, bulan: string) {
  const [baris, konsep, status, grup, anak, brief, pola, libur] = await Promise.all([
    db.magangKonten.findMany({ where: { tanggal: rentangBulan(bulan) }, orderBy: [{ tanggal: "asc" }, { urutan: "asc" }, { id: "asc" }], include: includeBaris }),
    muatKonsep(db),
    muatStatus(db),
    muatGrup(db),
    muatAnak(db),
    muatBrief(db),
    muatPola(db),
    liburBulan(db, bulan),
  ]);
  return { bulan, baris: baris.map(serialisasiBaris), konsep, status, grup, anak, brief, pola, libur };
}

// ── Generator (rencana + simpan) ──────────────────────────────────────────────────────────────

export type BarisRencana = { tanggal: string; konsepId: number; pesertaId: number | null; grupId: number | null; kode: number | null };
export type Rencana = {
  bulan: string;
  baris: BarisRencana[];
  /** Baris lama yang akan dihapus (mode ganti, hanya yang belum dikerjakan). */
  hapus: number[];
  dipertahankan: number;
  dilewati: { tanggal: string; alasan: string }[];
  masalah: string[];
  statusAwalId: number | null;
};

/**
 * Susun rencana satu bulan dari DB. ganti=false → hanya tanggal yang belum punya baris. ganti=true →
 * baris bulan itu yang BELUM dikerjakan (bolehDiganti) dihapus dulu lalu disusun ulang; baris yang
 * sudah dikerjakan dipertahankan dan gilirannya ikut dihitung.
 */
export async function rencanaBulan(db: Db, bulan: string, ganti: boolean): Promise<Rencana> {
  const [konsep, status, grup, anak, pola, libur, ada] = await Promise.all([
    muatKonsep(db),
    muatStatus(db),
    muatGrup(db),
    muatAnak(db),
    muatPola(db),
    liburBulan(db, bulan),
    db.magangKonten.findMany({ where: { tanggal: rentangBulan(bulan) }, orderBy: [{ tanggal: "asc" }, { urutan: "asc" }, { id: "asc" }] }),
  ]);
  const masalah: string[] = [];
  const awal = statusAwal(status);
  if (!awal) masalah.push("Belum ada status aktif yang bukan final (mis. \"Belum take\") — tambahkan di Setelan → Status.");

  const konsepAktif = new Map(konsep.filter((k) => k.aktif).map((k) => [k.kunci, k]));
  const polaHari: PolaHari = {};
  for (const h of [1, 2, 3, 4, 5, 6] as const) {
    const kunci = pola.hari[h];
    if (!kunci) continue;
    if (konsepAktif.has(kunci)) polaHari[h] = kunci;
    else masalah.push(`Pola hari ke-${h} memakai konsep "${kunci}" yang tidak ada / nonaktif — hari itu dilewati.`);
  }
  const empathy = pola.empathy && konsepAktif.has(pola.empathy) ? konsepAktif.get(pola.empathy)! : null;
  if (pola.empathy && !empathy) masalah.push(`Konsep grup "${pola.empathy}" tidak ada / nonaktif — tidak ada hari grup.`);

  const anakAktif = anak.filter((a) => a.aktif && a.kode != null);
  const pesertaDariKode = new Map(anakAktif.map((a) => [a.kode!, a.pesertaId]));
  const kodePeserta = new Map(anak.map((a) => [a.pesertaId, a.kode]));
  const grupAktif = grup.filter((g) => g.aktif);
  if (anakAktif.length === 0) masalah.push("Belum ada anak aktif yang punya kode — baris dibuat tanpa anak. Atur di Setelan → Kode anak.");

  const hapus = ganti && awal ? ada.filter((b) => bolehDiganti(b, awal.id)).map((b) => b.id) : [];
  const tetap = ada.filter((b) => !hapus.includes(b.id));

  const mulai = atMidnight(`${bulan}-01`);
  const [sebelum, empathyLalu] = await Promise.all([
    db.magangKonten.findMany({
      where: { tanggal: { lt: mulai }, pesertaId: { not: null } },
      orderBy: [{ tanggal: "desc" }, { urutan: "desc" }, { id: "desc" }],
      take: 60,
      select: { pesertaId: true },
    }),
    empathy
      ? db.magangKonten.findFirst({
          where: { tanggal: { lt: mulai }, konsepId: empathy.id, grupId: { not: null } },
          orderBy: [{ tanggal: "desc" }, { id: "desc" }],
          select: { tanggal: true, grupId: true },
        })
      : null,
  ]);
  const kodeLalu = sebelum.map((b) => kodePeserta.get(b.pesertaId!)).find((k) => k != null) ?? null;

  const petaAda = new Map<string, BarisAda[]>();
  for (const b of tetap) {
    const t = toYmd(b.tanggal);
    const l = petaAda.get(t) ?? [];
    l.push({ kode: b.pesertaId != null ? (kodePeserta.get(b.pesertaId) ?? null) : null, grupId: b.grupId, empathy: !!empathy && b.konsepId === empathy.id });
    petaAda.set(t, l);
  }

  const hasil = susunBulan({
    bulan,
    kode: [...pesertaDariKode.keys()],
    grupUrut: grupAktif.map((g) => g.id),
    polaHari,
    empathyKonsep: empathy?.kunci ?? null,
    selangEmpathy: pola.selangHari,
    mulaiKodeSetelah: kodeLalu,
    empathyTerakhir: empathyLalu ? { tanggal: toYmd(empathyLalu.tanggal), grupId: empathyLalu.grupId } : null,
    libur: new Set(libur.map((l) => l.tanggal)),
    ada: petaAda,
  });

  return {
    bulan,
    baris: hasil.baris.map((b) => ({
      tanggal: b.tanggal,
      konsepId: konsepAktif.get(b.konsep)!.id,
      pesertaId: b.kode != null ? (pesertaDariKode.get(b.kode) ?? null) : null,
      grupId: b.grupId,
      kode: b.kode,
    })),
    hapus,
    dipertahankan: tetap.length,
    dilewati: hasil.dilewati,
    masalah,
    statusAwalId: awal?.id ?? null,
  };
}

/** Tulis rencana dalam SATU transaksi (tanpa DDL). Baris yang dihapus diperiksa ulang di dalamnya. */
export async function simpanRencana(db: PrismaClient, r: Rencana, oleh: { userId: number | null }) {
  if (!r.statusAwalId) throw new Error("Status awal belum ada.");
  const statusAwalId = r.statusAwalId;
  return db.$transaction(async (tx) => {
    let dihapus = 0;
    if (r.hapus.length) {
      const calon = await tx.magangKonten.findMany({ where: { id: { in: r.hapus } } });
      const aman = calon.filter((b) => bolehDiganti(b, statusAwalId)).map((b) => b.id);
      dihapus = (await tx.magangKonten.deleteMany({ where: { id: { in: aman } } })).count;
    }
    // Tanggal yang (sejak pratinjau) sudah terisi orang lain tidak diisi dua kali.
    const terisi = new Set(
      (await tx.magangKonten.findMany({ where: { tanggal: rentangBulan(r.bulan) }, select: { tanggal: true } })).map((b) => toYmd(b.tanggal))
    );
    const data = r.baris
      .filter((b) => !terisi.has(b.tanggal))
      .map((b) => ({
        tanggal: atMidnight(b.tanggal),
        konsepId: b.konsepId,
        pesertaId: b.pesertaId,
        grupId: b.grupId,
        statusId: statusAwalId,
        usulan: true,
        urutan: 0,
        diubahOlehId: oleh.userId,
      }));
    const dibuat = data.length ? (await tx.magangKonten.createMany({ data })).count : 0;
    return { dihapus, dibuat };
  });
}

/**
 * Periksa id rujukan dari pembina (konsep/anak/grup/status ada). Mengembalikan pesan galat, atau status
 * yang dipilih (untuk selesaiAt). Konsep/grup/status nonaktif masih boleh dipakai baris lama.
 */
export async function periksaRujukan(
  db: Db,
  r: { konsepId?: number; pesertaId?: number | null; grupId?: number | null; statusId?: number }
): Promise<{ galat: string } | { status: { id: number; final: boolean } | null }> {
  const [konsep, peserta, grup, status] = await Promise.all([
    r.konsepId ? db.magangKontenKonsep.findUnique({ where: { id: r.konsepId }, select: { id: true } }) : true,
    r.pesertaId ? db.magangPeserta.findFirst({ where: { id: r.pesertaId, employee: { deletedAt: null } }, select: { id: true } }) : true,
    r.grupId ? db.magangKontenGrup.findUnique({ where: { id: r.grupId }, select: { id: true } }) : true,
    r.statusId ? db.magangKontenStatus.findUnique({ where: { id: r.statusId }, select: { id: true, final: true } }) : null,
  ]);
  if (!konsep) return { galat: "Konsep tidak ditemukan." };
  if (!peserta) return { galat: "Anak tidak ditemukan." };
  if (!grup) return { galat: "Grup tidak ditemukan." };
  if (r.statusId && !status) return { galat: "Status tidak ditemukan." };
  return { status };
}

const LABEL_MASTER = { konsep: "Konsep", status: "Status", grup: "Grup" } as const;
/**
 * Hapus konsep/status/grup — hanya bila belum dipakai baris jadwal. Mengembalikan Response 404/409
 * (pesan untuk pembina: nonaktifkan saja), atau null bila terhapus.
 */
export async function hapusMaster(db: PrismaClient, jenis: keyof typeof LABEL_MASTER, id: number): Promise<Response | null> {
  const kolom = { konsep: "konsepId", status: "statusId", grup: "grupId" }[jenis];
  const dipakai = await db.magangKonten.count({ where: { [kolom]: id } });
  const tolak = () =>
    NextResponse.json({ message: `${LABEL_MASTER[jenis]} ini dipakai ${dipakai || "beberapa"} baris jadwal. Nonaktifkan saja.`, dipakai }, { status: 409 });
  if (dipakai > 0) return tolak();
  try {
    const r =
      jenis === "konsep"
        ? await db.magangKontenKonsep.deleteMany({ where: { id } })
        : jenis === "status"
          ? await db.magangKontenStatus.deleteMany({ where: { id } })
          : await db.magangKontenGrup.deleteMany({ where: { id } });
    if (r.count === 0) return NextResponse.json({ message: `${LABEL_MASTER[jenis]} tidak ditemukan.` }, { status: 404 });
  } catch (e) {
    // Baris baru masuk di antara hitung & hapus → FOREIGN KEY (RESTRICT) menolak.
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2003" || e.code === "P2014")) return tolak();
    throw e;
  }
  return null;
}

// ── Anak (portal) ─────────────────────────────────────────────────────────────────────────────

/** Grup yang diikuti peserta (id). */
export async function grupAnak(db: Db, pesertaId: number): Promise<number[]> {
  const rows = await db.magangKontenGrupAnggota.findMany({ where: { pesertaId }, select: { grupId: true } });
  return rows.map((r) => r.grupId);
}

/** Peserta AKTIF untuk karyawan ini + kode + grup konten yang dia ikuti (null bila bukan peserta). */
export async function pesertaKonten(db: Db, employeeId: number) {
  const p = await db.magangPeserta.findFirst({
    where: { employeeId, aktif: true },
    select: { id: true, kodeKonten: true, kontenGrup: { select: { grup: { select: { id: true, nama: true } } } } },
  });
  if (!p) return null;
  const grup = p.kontenGrup.map((a) => a.grup);
  return { id: p.id, kode: p.kodeKonten, grup, grupIds: grup.map((g) => g.id) };
}

/**
 * Baris untuk HP anak — objek baru dari medan yang diizinkan (tanpa id peserta lain / pengubah).
 * milik = "kamu" atau nama grup.
 */
export function serialisasiBarisAnak(
  b: { id: number; tanggal: Date; konsepId: number; pesertaId: number | null; grupId: number | null; statusId: number; judul: string | null; ref: string | null; caption: string | null; linkFootage: string | null; linkEkspor: string | null; catatan: string | null; usulan: boolean; selesaiAt: Date | null },
  konsep: ReadonlyMap<number, KonsepJson>,
  status: ReadonlyMap<number, StatusJson>,
  grup: ReadonlyMap<number, string>
) {
  const k = konsep.get(b.konsepId);
  const s = status.get(b.statusId);
  return {
    id: b.id,
    tanggal: toYmd(b.tanggal),
    konsep: k ? { label: k.label, warna: k.warna, referensi: k.referensi } : { label: "(konsep dihapus)", warna: "putih", referensi: [] },
    milik: b.grupId != null ? (grup.get(b.grupId) ?? "Grup") : "kamu",
    status: s ? { id: s.id, nama: s.nama, warna: s.warna, final: s.final } : { id: b.statusId, nama: "-", warna: "abu", final: false },
    judul: b.judul,
    ref: b.ref,
    caption: b.caption,
    linkFootage: b.linkFootage,
    linkEkspor: b.linkEkspor,
    catatan: b.catatan,
    usulan: b.usulan,
    selesaiAt: b.selesaiAt?.toISOString() ?? null,
  };
}
export type BarisAnakJson = ReturnType<typeof serialisasiBarisAnak>;

/** Filter Prisma: baris milik anak = kodenya sendiri ATAU grup yang dia ikuti. */
export function whereMilikAnak(pesertaId: number, grupIds: readonly number[]): Prisma.MagangKontenWhereInput {
  return { OR: [{ pesertaId }, ...(grupIds.length ? [{ grupId: { in: [...grupIds] }, pesertaId: null }] : [])] };
}

export type { AnakKonten, GrupKonten };
