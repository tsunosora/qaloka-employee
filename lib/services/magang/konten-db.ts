/**
 * Jadwal konten — akses DB (dipakai rute dasbor, rute portal anak, pantauan guru). Logika murni ada di
 * konten.ts; di sini hanya memuat/menyimpan dan menyusun objek JSON yang dikirim (medan yang diizinkan).
 */

import { NextResponse } from "next/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import {
  KUNCI_POLA,
  POLA_BAWAAN,
  bolehDiganti,
  geserBulan,
  labelKonsep,
  pilihStatusAwal,
  putusanHapusPlatform,
  referensiEfektif,
  susunRencana,
  type AnakKonten,
  type GrupKonten,
  type PolaHari,
  type PolaKonten,
  type RencanaMurni,
} from "@/lib/services/magang/konten";
import { polaSchema, uraiBrief, type BriefKonten } from "@/lib/validators/magang-konten";

type Db = PrismaClient | Prisma.TransactionClient;

// ── Setelan ───────────────────────────────────────────────────────────────────────────────────

/** Brief satu platform (null bila platform tidak ada). Setting `magang_konten_brief` lama TIDAK dibaca lagi. */
export async function muatBrief(db: Db, platformId: number): Promise<BriefKonten | null> {
  const row = await db.magangKontenPlatform.findUnique({ where: { id: platformId }, select: { brief: true } });
  return row ? uraiBrief(row.brief) : null;
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

// ── Platform ──────────────────────────────────────────────────────────────────────────────────

/** Semua platform (termasuk arsip) urut tampil + jumlah baris jadwalnya. */
export async function muatPlatform(db: Db) {
  const rows = await db.magangKontenPlatform.findMany({
    orderBy: [{ urutan: "asc" }, { id: "asc" }],
    select: { id: true, nama: true, kunci: true, warna: true, ikon: true, urutan: true, aktif: true, diarsipkanAt: true, _count: { select: { konten: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    nama: p.nama,
    kunci: p.kunci,
    warna: p.warna,
    ikon: p.ikon,
    urutan: p.urutan,
    aktif: p.aktif,
    diarsipkanAt: p.diarsipkanAt?.toISOString() ?? null,
    dipakai: p._count.konten,
  }));
}
export type PlatformJson = Awaited<ReturnType<typeof muatPlatform>>[number];

/** Hapus platform — hanya bila belum dipakai baris jadwal (409 {dipakai} → UI menawarkan Arsipkan). */
export async function hapusPlatform(db: PrismaClient, id: number): Promise<Response | null> {
  const dipakai = await db.magangKonten.count({ where: { platformId: id } });
  const p = putusanHapusPlatform(dipakai);
  if (!p.boleh) return NextResponse.json(p.body, { status: p.status });
  try {
    const r = await db.magangKontenPlatform.deleteMany({ where: { id } });
    if (r.count === 0) return NextResponse.json({ message: "Platform tidak ditemukan." }, { status: 404 });
  } catch (e) {
    // Baris baru masuk di antara hitung & hapus → FOREIGN KEY (RESTRICT) menolak.
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2003" || e.code === "P2014")) {
      const q = putusanHapusPlatform(Math.max(1, await db.magangKonten.count({ where: { platformId: id } })));
      if (!q.boleh) return NextResponse.json(q.body, { status: q.status });
    }
    throw e;
  }
  return null;
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
  return pilihStatusAwal(status);
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
    platformId: b.platformId,
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

/**
 * Semua yang dibutuhkan tabel pembina untuk satu bulan. platform = id → baris & brief platform itu;
 * "semua" → baris semua platform, brief null (UI meminta memilih platform dulu).
 */
export async function dataBulan(db: Db, bulan: string, platform: number | "semua") {
  const satu = platform !== "semua";
  const [baris, konsep, status, grup, anak, daftarPlatform, brief, pola, libur] = await Promise.all([
    db.magangKonten.findMany({
      where: { tanggal: rentangBulan(bulan), ...(satu ? { platformId: platform } : {}) },
      orderBy: [{ tanggal: "asc" }, { urutan: "asc" }, { id: "asc" }],
      include: includeBaris,
    }),
    muatKonsep(db),
    muatStatus(db),
    muatGrup(db),
    muatAnak(db),
    muatPlatform(db),
    satu ? muatBrief(db, platform) : null,
    muatPola(db),
    liburBulan(db, bulan),
  ]);
  return { bulan, platformId: satu ? platform : null, baris: baris.map(serialisasiBaris), konsep, status, grup, anak, platform: daftarPlatform, brief, pola, libur };
}

// ── Generator (rencana + simpan) ──────────────────────────────────────────────────────────────

export type BarisRencana = RencanaMurni["baris"][number];
export type Rencana = RencanaMurni;

/** Riwayat sebelum bulan yang dibaca untuk melanjutkan giliran kode anak (per platform). */
const RIWAYAT_KODE = 60;

/**
 * Muat data rencana SATU platform lalu susun dengan susunRencana() (murni). ganti=false → hanya tanggal yang
 * belum punya baris di platform ini; ganti=true → baris platform ini yang BELUM dikerjakan dihapus & disusun ulang.
 * Riwayat giliran (kode anak terakhir, EMPATHY terakhir) juga hanya dari platform ini.
 */
export async function rencanaBulan(db: Db, bulan: string, ganti: boolean, platformId: number): Promise<Rencana> {
  const mulai = atMidnight(`${bulan}-01`);
  const [konsep, status, grup, anak, pola, libur, ada, sebelum] = await Promise.all([
    muatKonsep(db),
    muatStatus(db),
    muatGrup(db),
    muatAnak(db),
    muatPola(db),
    liburBulan(db, bulan),
    db.magangKonten.findMany({ where: { platformId, tanggal: rentangBulan(bulan) }, orderBy: [{ tanggal: "asc" }, { urutan: "asc" }, { id: "asc" }] }),
    db.magangKonten.findMany({
      where: { platformId, tanggal: { lt: mulai }, pesertaId: { not: null } },
      orderBy: [{ tanggal: "desc" }, { urutan: "desc" }, { id: "desc" }],
      take: RIWAYAT_KODE,
    }),
  ]);
  const konsepGrup = pola.empathy ? konsep.find((k) => k.kunci === pola.empathy && k.aktif) : undefined;
  const empathyLalu = konsepGrup
    ? await db.magangKonten.findMany({
        where: { platformId, tanggal: { lt: mulai }, konsepId: konsepGrup.id, grupId: { not: null } },
        orderBy: [{ tanggal: "desc" }, { id: "desc" }],
        take: 1,
      })
    : [];
  return susunRencana({
    bulan,
    ganti,
    platformId,
    konsep,
    status,
    grup,
    anak,
    pola,
    libur: libur.map((l) => l.tanggal),
    baris: [...ada, ...sebelum, ...empathyLalu].map((b) => ({ ...b, tanggal: toYmd(b.tanggal) })),
  });
}

/** Tulis rencana dalam SATU transaksi (tanpa DDL). Baris yang dihapus diperiksa ulang di dalamnya. */
export async function simpanRencana(db: PrismaClient, r: Rencana, oleh: { userId: number | null }) {
  if (!r.statusAwalId) throw new Error("Status awal belum ada.");
  const statusAwalId = r.statusAwalId;
  return db.$transaction(async (tx) => {
    let dihapus = 0;
    if (r.hapus.length) {
      const calon = await tx.magangKonten.findMany({ where: { id: { in: r.hapus }, platformId: r.platformId } });
      const aman = calon.filter((b) => bolehDiganti(b, statusAwalId)).map((b) => b.id);
      dihapus = (await tx.magangKonten.deleteMany({ where: { id: { in: aman } } })).count;
    }
    // Tanggal yang (sejak pratinjau) sudah terisi orang lain DI PLATFORM INI tidak diisi dua kali.
    const terisi = new Set(
      (await tx.magangKonten.findMany({ where: { platformId: r.platformId, tanggal: rentangBulan(r.bulan) }, select: { tanggal: true } })).map((b) =>
        toYmd(b.tanggal)
      )
    );
    const data = r.baris
      .filter((b) => !terisi.has(b.tanggal))
      .map((b) => ({
        platformId: r.platformId,
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
  r: { platformId?: number; konsepId?: number; pesertaId?: number | null; grupId?: number | null; statusId?: number }
): Promise<{ galat: string } | { status: { id: number; final: boolean } | null }> {
  const [platform, konsep, peserta, grup, status] = await Promise.all([
    r.platformId ? db.magangKontenPlatform.findUnique({ where: { id: r.platformId }, select: { id: true } }) : true,
    r.konsepId ? db.magangKontenKonsep.findUnique({ where: { id: r.konsepId }, select: { id: true } }) : true,
    r.pesertaId ? db.magangPeserta.findFirst({ where: { id: r.pesertaId, employee: { deletedAt: null } }, select: { id: true } }) : true,
    r.grupId ? db.magangKontenGrup.findUnique({ where: { id: r.grupId }, select: { id: true } }) : true,
    r.statusId ? db.magangKontenStatus.findUnique({ where: { id: r.statusId }, select: { id: true, final: true } }) : null,
  ]);
  if (!platform) return { galat: "Platform tidak ditemukan." };
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

/** Platform untuk HP anak: nama/warna/ikon + brief (referensi khusus platform dipakai lewat referensiEfektif). */
export type PlatformAnak = { id: number; nama: string; warna: string; ikon: string | null; brief: BriefKonten };

/** Platform (+ brief) untuk daftar id — dipakai rute HP anak. */
export async function muatPlatformAnak(db: Db, ids: readonly number[]): Promise<Map<number, PlatformAnak>> {
  if (ids.length === 0) return new Map();
  const rows = await db.magangKontenPlatform.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, nama: true, warna: true, ikon: true, brief: true } });
  return new Map(rows.map((p) => [p.id, { id: p.id, nama: p.nama, warna: p.warna, ikon: p.ikon, brief: uraiBrief(p.brief) }]));
}

type PlatformRingkas = { id: number; nama: string; warna: string; ikon: string | null; brief?: Pick<BriefKonten, "referensi"> | null };

/**
 * Baris untuk HP anak — objek baru dari medan yang diizinkan (tanpa id peserta lain / pengubah).
 * milik = "kamu" atau nama grup. platform = label platform baris itu; referensi konsep = khusus platform bila ada.
 */
export function serialisasiBarisAnak(
  b: { id: number; platformId: number; tanggal: Date; konsepId: number; pesertaId: number | null; grupId: number | null; statusId: number; judul: string | null; ref: string | null; caption: string | null; linkFootage: string | null; linkEkspor: string | null; catatan: string | null; usulan: boolean; selesaiAt: Date | null },
  konsep: ReadonlyMap<number, KonsepJson>,
  status: ReadonlyMap<number, StatusJson>,
  grup: ReadonlyMap<number, string>,
  platform: ReadonlyMap<number, PlatformRingkas>
) {
  const k = konsep.get(b.konsepId);
  const s = status.get(b.statusId);
  const p = platform.get(b.platformId);
  return {
    id: b.id,
    tanggal: toYmd(b.tanggal),
    platform: p ? { id: p.id, nama: p.nama, warna: p.warna, ikon: p.ikon } : { id: b.platformId, nama: "(platform dihapus)", warna: "putih", ikon: null },
    konsep: k
      ? { label: k.label, warna: k.warna, referensi: referensiEfektif(k.referensi, p?.brief?.referensi, k.id).referensi }
      : { label: "(konsep dihapus)", warna: "putih", referensi: [] },
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
