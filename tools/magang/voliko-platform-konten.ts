/**
 * Platform jadwal konten Voliko (13 Nov 2026): buat platform KOSONG Exindo, Xposer, Epic Jogja, Voliko Sport
 * (urutan 2–5, aktif, brief kosong) dan periksa "Voliko Print" (dibuat migrasi 20261113000000_magang_konten_platform)
 * memegang jadwal yang sudah ada (24 baris November).
 *
 * Jalankan DI SERVER, di dalam folder aplikasi (yang punya .env berisi DATABASE_URL):
 *
 *   TZ=Asia/Jakarta npx tsx tools/magang/voliko-platform-konten.ts               # DRY RUN (bawaan): cetak rencana
 *   TZ=Asia/Jakarta npx tsx tools/magang/voliko-platform-konten.ts --jalankan    # cadangan JSON lalu tulis ke DB
 *
 * Pilihan:
 *   --cadangan=<folder>   Folder cadangan JSON (bawaan ~/cadangan/magang-platform-<waktu WIB>). Gagal menulis = batal.
 *   --bantuan             Tampilkan teks ini.
 *
 * Aman diulang (idempoten), satu transaksi tanpa DDL:
 *   - Batal bila migrasi 20261113000000_magang_konten_platform belum terpasang, atau platform voliko-print tidak ada.
 *   - Platform dicari per kunci: belum ada → dibuat (upsert, update kosong); sudah ada → dibiarkan apa adanya
 *     (nama/warna/urutan/brief/arsip yang diubah pembina TIDAK ditimpa). Nama sama (beda huruf besar) dengan kunci
 *     lain → dilewati + peringatan.
 *   - Baris jadwal TIDAK disentuh. Jumlah baris Voliko Print ≠ 24 / ada baris tanpa platform → peringatan saja.
 *
 * Kode keluar ≠ 0 bila dibatalkan / gagal.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { namaPlatformBentrok } from "@/lib/services/magang/konten";
import { KUNCI_PLATFORM_VOLIKO, MIGRASI_PLATFORM } from "./data/voliko-konten-nov2026";

const WIB_MENIT = 7 * 60;
/** Jumlah baris jadwal Voliko Print yang diharapkan (impor November 10 Nov 2026). */
export const BARIS_VOLIKO_PRINT = 24;

/** Platform baru (kosong). Warna netral & tanpa ikon — pembina mengatur lewat Kelola platform. */
export const PLATFORM_VOLIKO = [
  { kunci: "exindo", nama: "Exindo", urutan: 2 },
  { kunci: "xposer", nama: "Xposer", urutan: 3 },
  { kunci: "epic-jogja", nama: "Epic Jogja", urutan: 4 },
  { kunci: "voliko-sport", nama: "Voliko Sport", urutan: 5 },
] as const;

export type PlatformAda = { id: number; kunci: string; nama: string };
export type AksiPlatform = { kunci: string; nama: string; urutan: number; aksi: "buat" | "ada" | "nama-bentrok"; keterangan?: string };

/**
 * Rencana murni (tanpa DB): platform mana yang dibuat. Idempoten — menjalankan ulang sesudah rencana diterapkan
 * menghasilkan 0 "buat". masalah = alasan batal (Voliko Print tidak ada).
 */
export function rencanaPlatformVoliko(ada: readonly PlatformAda[]): { aksi: AksiPlatform[]; masalah: string[] } {
  const masalah: string[] = [];
  if (!ada.some((p) => p.kunci === KUNCI_PLATFORM_VOLIKO)) masalah.push(`Platform "${KUNCI_PLATFORM_VOLIKO}" tidak ada — seharusnya dibuat migrasi ${MIGRASI_PLATFORM}.`);
  const aksi = PLATFORM_VOLIKO.map((p): AksiPlatform => {
    if (ada.some((x) => x.kunci === p.kunci)) return { ...p, aksi: "ada" };
    const bentrok = ada.find((x) => namaPlatformBentrok(p.nama, [x]));
    if (bentrok) return { ...p, aksi: "nama-bentrok", keterangan: `nama sama dengan platform id ${bentrok.id} (kunci ${bentrok.kunci})` };
    return { ...p, aksi: "buat" };
  });
  return { aksi, masalah };
}

class Batal extends Error {}
type Opsi = { jalankan: boolean; bantuan: boolean; cadangan: string };

function capWaktuWib(): string {
  return new Date(Date.now() + WIB_MENIT * 60_000).toISOString().slice(0, 19).replace(/-|:/g, "").replace("T", "-");
}

function bacaArgumen(argv: readonly string[]): Opsi {
  const opsi: Opsi = { jalankan: false, bantuan: false, cadangan: join(homedir(), "cadangan", `magang-platform-${capWaktuWib()}`) };
  for (const arg of argv) {
    const i = arg.indexOf("=");
    const [kunci, nilai] = i > 0 ? [arg.slice(0, i), arg.slice(i + 1)] : [arg, ""];
    if (kunci === "--jalankan") opsi.jalankan = true;
    else if (kunci === "--bantuan" || kunci === "-h" || kunci === "--help") opsi.bantuan = true;
    else if (kunci === "--cadangan" && nilai) opsi.cadangan = resolve(nilai.replace(/^~(?=$|\/)/, homedir()));
    else throw new Batal(`Pilihan tidak dikenal: ${arg} (lihat --bantuan).`);
  }
  return opsi;
}

async function cekMigrasi(db: PrismaClient) {
  let catatan: { finished_at: Date | null; rolled_back_at: Date | null }[] = [];
  try {
    catatan = await db.$queryRaw`SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ${MIGRASI_PLATFORM}`;
  } catch {
    throw new Batal("Tabel _prisma_migrations tidak terbaca — basis data ini tidak dikelola Prisma Migrate?");
  }
  if (!catatan.some((c) => c.finished_at && !c.rolled_back_at)) throw new Batal(`Migrasi ${MIGRASI_PLATFORM} belum terpasang — jalankan dulu npx prisma migrate deploy.`);
  console.log(`✓ Migrasi ${MIGRASI_PLATFORM} terpasang.`);
}

async function utama() {
  const opsi = bacaArgumen(process.argv.slice(2));
  if (opsi.bantuan) {
    const teks = readFileSync(process.argv[1], "utf8");
    console.log(teks.slice(teks.indexOf("/**") + 3, teks.indexOf("*/")).replace(/^ \* ?/gm, ""));
    return;
  }
  console.log(`Mode: ${opsi.jalankan ? "JALANKAN (menulis ke DB)" : "DRY RUN (tidak menulis apa pun)"}`);
  const db = new PrismaClient();
  try {
    await cekMigrasi(db);
    const ada = await db.magangKontenPlatform.findMany({ orderBy: [{ urutan: "asc" }, { id: "asc" }], include: { _count: { select: { konten: true } } } });
    const tanpaPlatform = await db.$queryRaw<{ n: bigint | number }[]>`SELECT COUNT(*) AS n FROM MagangKonten WHERE platformId IS NULL`;
    const { aksi, masalah } = rencanaPlatformVoliko(ada);
    if (masalah.length) throw new Batal(masalah.join("\n  "));

    const vp = ada.find((p) => p.kunci === KUNCI_PLATFORM_VOLIKO)!;
    console.log(`\n== Platform sekarang ==`);
    for (const p of ada) console.log(`  #${p.id} ${p.nama.padEnd(14)} kunci ${p.kunci.padEnd(13)} urutan ${p.urutan} ${p.aktif ? "aktif" : "ARSIP"} · ${p._count.konten} baris · brief ${p.brief == null ? "kosong" : "ada"}`);
    console.log(`\n== Rencana ==`);
    for (const a of aksi) console.log(`  ${a.aksi === "buat" ? "+ BUAT " : a.aksi === "ada" ? "= ADA  " : "! LEWAT"} ${a.nama.padEnd(14)} kunci ${a.kunci.padEnd(13)} urutan ${a.urutan}${a.keterangan ? ` (${a.keterangan})` : ""}`);
    for (const a of aksi.filter((x) => x.aksi === "nama-bentrok")) console.log(`PERINGATAN: ${a.nama} dilewati — ${a.keterangan}.`);

    console.log(`\n== Pemeriksaan Voliko Print ==`);
    console.log(`  ${vp.nama} (id ${vp.id}): ${vp._count.konten} baris jadwal (diharapkan ${BARIS_VOLIKO_PRINT}) · brief ${vp.brief == null ? "KOSONG" : "ada"}`);
    if (vp._count.konten !== BARIS_VOLIKO_PRINT) console.log(`PERINGATAN: jumlah baris Voliko Print ${vp._count.konten} ≠ ${BARIS_VOLIKO_PRINT} (pembina mungkin sudah menambah/menghapus baris).`);
    if (Number(tanpaPlatform[0]?.n ?? 0) > 0) console.log(`PERINGATAN: ${tanpaPlatform[0].n} baris jadwal tanpa platform!`);
    if (vp.brief == null) console.log("PERINGATAN: brief Voliko Print kosong (migrasi menyalin dari Setting magang_konten_brief bila ada).");

    const buat = aksi.filter((a) => a.aksi === "buat");
    console.log(`\n  Akan dibuat: ${buat.length} platform · sudah ada: ${aksi.filter((a) => a.aksi === "ada").length}`);
    if (!opsi.jalankan) {
      console.log(`\nDRY RUN selesai — tidak ada yang ditulis. Cadangan akan ditulis ke: ${opsi.cadangan}`);
      console.log("Ulangi dengan --jalankan untuk menerapkan.");
      return;
    }

    try {
      mkdirSync(opsi.cadangan, { recursive: true });
      const isi: Record<string, unknown> = {
        MagangKontenPlatform: await db.magangKontenPlatform.findMany({ orderBy: { id: "asc" } }),
        MagangKonten_platform: await db.magangKonten.findMany({ select: { id: true, platformId: true }, orderBy: { id: "asc" } }),
      };
      for (const [nama, data] of Object.entries(isi)) {
        const berkas = join(opsi.cadangan, `${nama}.json`);
        writeFileSync(berkas, JSON.stringify(data, null, 2), { encoding: "utf8", flag: "wx" });
        JSON.parse(readFileSync(berkas, "utf8"));
      }
    } catch (e) {
      throw new Batal(`Gagal menulis cadangan ke ${opsi.cadangan}: ${(e as Error).message}. Tidak ada yang diubah di DB.`);
    }
    console.log(`✓ Cadangan ditulis: ${opsi.cadangan}`);

    const dibuat = await db.$transaction(async (tx) => {
      let n = 0;
      for (const a of buat) {
        const sebelum = await tx.magangKontenPlatform.findUnique({ where: { kunci: a.kunci }, select: { id: true } });
        await tx.magangKontenPlatform.upsert({ where: { kunci: a.kunci }, update: {}, create: { kunci: a.kunci, nama: a.nama, urutan: a.urutan, warna: "putih", aktif: true } });
        if (!sebelum) n++;
      }
      return n;
    });
    const akhir = await db.magangKontenPlatform.findMany({ orderBy: [{ urutan: "asc" }, { id: "asc" }], include: { _count: { select: { konten: true } } } });
    console.log("\n== SELESAI ==");
    console.log(`  Platform dibuat: ${dibuat}`);
    for (const p of akhir) console.log(`  #${p.id} ${p.nama.padEnd(14)} urutan ${p.urutan} ${p.aktif ? "aktif" : "ARSIP"} · ${p._count.konten} baris`);
    console.log(`  Cadangan: ${opsi.cadangan}`);
  } finally {
    await db.$disconnect();
  }
}

// Diimpor tes (rencanaPlatformVoliko) → jangan jalan otomatis.
if (process.argv[1] && /voliko-platform-konten\.ts$/.test(process.argv[1])) {
  utama().catch((e: unknown) => {
    if (e instanceof Batal) console.error(`\nBATAL: ${e.message}`);
    else console.error("\nGAGAL:", e);
    process.exitCode = 1;
  });
}
