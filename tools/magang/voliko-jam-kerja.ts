/**
 * Jam kerja magang Voliko per sekolah (15 Nov 2026; data: tools/magang/data/voliko-jam-kerja.ts), lalu hitung ulang
 * absensi tersimpan anak-anak sekolah itu.
 *
 * Jalankan DI SERVER, di dalam folder aplikasi (yang punya .env berisi DATABASE_URL):
 *
 *   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jam-kerja.ts               # DRY RUN (bawaan): rencana + pratinjau telat per anak
 *   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jam-kerja.ts --jalankan    # cadangan JSON lalu tulis ke DB + hitung ulang
 *
 * Pilihan:
 *   --cadangan=<folder>   Folder cadangan JSON (bawaan ~/cadangan/magang-jam-<waktu WIB>). Gagal menulis = batal.
 *   --bantuan             Tampilkan teks ini.
 *
 * Aman diulang (idempoten), tanpa transaksi & tanpa DDL:
 *   - Batal bila migrasi 20261115000000_magang_jam_kerja belum terpasang, bila sekolah tidak ditemukan di data peserta,
 *     bila id peserta tidak ada / nama panggilannya tidak cocok, atau bila anak tercatat di sekolah lain.
 *   - Jam sekolah yang sudah ada & sama → dilewati; sudah ada tapi BEDA (diubah pembina) → dibiarkan & dilaporkan.
 *   - Hitung ulang hanya absensi anak sekolah-sekolah itu (mulai magang, maks. 62 hari ke belakang); karyawan biasa
 *     tidak disentuh. Jam khusus per anak (MagangPeserta.jam*) tidak disentuh.
 * Dry-run mencetak per anak: baris yang akan berubah + hari terlambat sebelum → sesudah (dihitung di memori).
 *
 * Kode keluar ≠ 0 bila dibatalkan / gagal.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { kunciSekolah } from "@/lib/services/magang/sekolah";
import { pesertaSekolahIni, type JamSekolahBaris } from "@/lib/services/magang/jam-kerja";
import { muatBarisJam } from "@/lib/services/magang/jam-kerja-db";
import { hitungUlangPeserta, petaDari, type HasilHitungUlang } from "@/lib/services/magang/jam-kerja-simpan";
import { JAM_SEKOLAH_VOLIKO, MIGRASI_JAM } from "./data/voliko-jam-kerja";

const WIB_MENIT = 7 * 60;

type DataJam = {
  sekolah: string;
  jamMasuk: string;
  jamPulang: string;
  toleransiMenit: number | null;
  anak: readonly { pesertaId: number; panggilan: string }[];
};
type PesertaRingkas = { id: number; employeeId: number; panggilan: string; sekolah: string | null };
export type AksiJam = { kunci: string; label: string; data: DataJam; aksi: "buat" | "sama" | "beda"; ada?: JamSekolahBaris; lain: PesertaRingkas[] };

const samaNama = (a: string, b: string) => a.trim().toLocaleLowerCase("id") === b.trim().toLocaleLowerCase("id");

/** Rencana murni (tanpa DB). masalah = alasan batal. Sesudah diterapkan, rencana ulang = semua "sama". */
export function rencanaJamVoliko(
  peserta: readonly PesertaRingkas[],
  jamAda: readonly JamSekolahBaris[],
  data: readonly DataJam[] = JAM_SEKOLAH_VOLIKO
): { aksi: AksiJam[]; masalah: string[] } {
  const masalah: string[] = [];
  const aksi: AksiJam[] = [];
  for (const d of data) {
    const kunci = kunciSekolah(d.sekolah);
    const anakSekolah = pesertaSekolahIni(peserta, kunci);
    if (anakSekolah.length === 0) {
      masalah.push(`Sekolah "${d.sekolah}" tidak ditemukan di data peserta (sekolah yang ada: ${[...new Set(peserta.map((p) => p.sekolah ?? "-"))].join(" | ")}).`);
      continue;
    }
    for (const x of d.anak) {
      const p = peserta.find((y) => y.id === x.pesertaId);
      if (!p) masalah.push(`Peserta id ${x.pesertaId} (${x.panggilan}) tidak ada.`);
      else if (!samaNama(p.panggilan, x.panggilan)) masalah.push(`Peserta id ${x.pesertaId}: panggilan di DB "${p.panggilan}", data "${x.panggilan}".`);
      else if (kunciSekolah(p.sekolah) !== kunci) masalah.push(`Peserta id ${x.pesertaId} (${x.panggilan}) tercatat di sekolah "${p.sekolah ?? "-"}", bukan "${d.sekolah}".`);
    }
    const ada = jamAda.find((j) => kunciSekolah(j.sekolahKunci) === kunci);
    const sama = ada && ada.jamMasuk === d.jamMasuk && ada.jamPulang === d.jamPulang && ada.toleransiMenit === d.toleransiMenit;
    const lain = anakSekolah.filter((p) => !d.anak.some((x) => x.pesertaId === p.id));
    aksi.push({ kunci, label: anakSekolah[0].sekolah?.trim().replace(/\s+/g, " ") ?? d.sekolah, data: d, aksi: !ada ? "buat" : sama ? "sama" : "beda", ada, lain });
  }
  return { aksi, masalah };
}

class Batal extends Error {}
type Opsi = { jalankan: boolean; bantuan: boolean; cadangan: string };

function capWaktuWib(): string {
  return new Date(Date.now() + WIB_MENIT * 60_000).toISOString().slice(0, 19).replace(/-|:/g, "").replace("T", "-");
}

function bacaArgumen(argv: readonly string[]): Opsi {
  const opsi: Opsi = { jalankan: false, bantuan: false, cadangan: join(homedir(), "cadangan", `magang-jam-${capWaktuWib()}`) };
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
    catatan = await db.$queryRaw`SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ${MIGRASI_JAM}`;
  } catch {
    throw new Batal("Tabel _prisma_migrations tidak terbaca — basis data ini tidak dikelola Prisma Migrate?");
  }
  if (!catatan.some((c) => c.finished_at && !c.rolled_back_at)) throw new Batal(`Migrasi ${MIGRASI_JAM} belum terpasang — jalankan dulu npx prisma migrate deploy.`);
  console.log(`✓ Migrasi ${MIGRASI_JAM} terpasang.`);
}

function cetakHitung(h: HasilHitungUlang, nama: ReadonlyMap<number, string>) {
  for (const a of h.anak)
    console.log(
      `  #${a.pesertaId} ${(nama.get(a.pesertaId) ?? "?").padEnd(10)} sejak ${a.dari} · ${String(a.baris).padStart(3)} baris · ${String(a.berubah).padStart(3)} ${h.pratinjau ? "akan berubah" : "berubah"} · hari terlambat ${a.terlambatSebelum} → ${a.terlambatSesudah}`
    );
  console.log(`  Total baris ${h.pratinjau ? "akan berubah" : "berubah"}: ${h.barisBerubah}`);
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
    const [{ peserta, sekolah }, nama] = await Promise.all([
      muatBarisJam(db),
      db.magangPeserta.findMany({ where: { employee: { deletedAt: null } }, select: { id: true, employee: { select: { nickname: true, fullName: true } } } }),
    ]);
    const panggilan = new Map(nama.map((n) => [n.id, n.employee.nickname ?? n.employee.fullName]));
    const ringkas: PesertaRingkas[] = peserta.map((p) => ({ id: p.id, employeeId: p.employeeId, panggilan: panggilan.get(p.id) ?? "", sekolah: p.sekolah }));
    const { aksi, masalah } = rencanaJamVoliko(ringkas, sekolah);

    console.log("\n== Rencana ==");
    for (const a of aksi) {
      const jam = `${a.data.jamMasuk}–${a.data.jamPulang} toleransi ${a.data.toleransiMenit ?? "umum"}`;
      const tanda = a.aksi === "buat" ? "+ BUAT" : a.aksi === "sama" ? "= SAMA" : "! BEDA";
      console.log(`  ${tanda} ${a.label} (kunci "${a.kunci}") → ${jam}${a.ada && a.aksi === "beda" ? ` — di DB ${a.ada.jamMasuk}–${a.ada.jamPulang} toleransi ${a.ada.toleransiMenit ?? "umum"} (dibiarkan)` : ""}`);
      for (const x of a.data.anak) console.log(`      #${x.pesertaId} ${x.panggilan}`);
      for (const p of a.lain) console.log(`      #${p.id} ${p.panggilan} (tidak ada di data, IKUT sekolah ini)`);
    }
    if (masalah.length) throw new Batal(masalah.join("\n  "));

    const baru = aksi.filter((a) => a.aksi === "buat");
    const barisBaru: JamSekolahBaris[] = baru.map((a) => ({ sekolahKunci: a.kunci, sekolahLabel: a.label, jamMasuk: a.data.jamMasuk, jamPulang: a.data.jamPulang, toleransiMenit: a.data.toleransiMenit }));
    const terdampak = aksi.flatMap((a) => pesertaSekolahIni(peserta, a.kunci));

    console.log("\n== Pratinjau absensi tersimpan (dihitung di memori) ==");
    const peta = await petaDari(peserta, [...sekolah, ...barisBaru]);
    cetakHitung(await hitungUlangPeserta(db, terdampak, { peta }), panggilan);

    if (!opsi.jalankan) {
      console.log(`\n  Akan dibuat: ${baru.length} jam sekolah · sudah ada: ${aksi.length - baru.length}`);
      console.log(`\nDRY RUN selesai — tidak ada yang ditulis. Cadangan akan ditulis ke: ${opsi.cadangan}`);
      console.log("Ulangi dengan --jalankan untuk menerapkan.");
      return;
    }

    try {
      mkdirSync(opsi.cadangan, { recursive: true });
      const empIds = terdampak.map((p) => p.employeeId);
      const isi: Record<string, unknown> = {
        MagangJamSekolah: await db.magangJamSekolah.findMany({ orderBy: { id: "asc" } }),
        MagangPesertaJam: await db.magangPeserta.findMany({ select: { id: true, employeeId: true, sekolah: true, jamMasuk: true, jamPulang: true, toleransiMenit: true }, orderBy: { id: "asc" } }),
        AttendanceAnak: await db.attendance.findMany({
          where: { employeeId: { in: empIds } },
          select: { id: true, employeeId: true, scanDate: true, scanType: true, status: true, lateMinutes: true, overtimeMinutes: true },
          orderBy: { id: "asc" },
        }),
      };
      for (const [n, data] of Object.entries(isi)) {
        const berkas = join(opsi.cadangan, `${n}.json`);
        writeFileSync(berkas, JSON.stringify(data, null, 2), { encoding: "utf8", flag: "wx" });
        JSON.parse(readFileSync(berkas, "utf8"));
      }
    } catch (e) {
      throw new Batal(`Gagal menulis cadangan ke ${opsi.cadangan}: ${(e as Error).message}. Tidak ada yang diubah di DB.`);
    }
    console.log(`✓ Cadangan ditulis: ${opsi.cadangan}`);

    let dibuat = 0;
    for (const b of barisBaru) {
      // Ulang periksa (idempoten bila dua proses berjalan bersamaan); tanpa transaksi, tanpa DDL.
      if (await db.magangJamSekolah.findUnique({ where: { sekolahKunci: b.sekolahKunci } })) continue;
      await db.magangJamSekolah.create({ data: b });
      dibuat++;
    }
    console.log(`\n== Hitung ulang absensi tersimpan ==`);
    cetakHitung(await hitungUlangPeserta(db, terdampak), panggilan);
    console.log("\n== SELESAI ==");
    console.log(`  Jam sekolah dibuat: ${dibuat}`);
    for (const j of await db.magangJamSekolah.findMany({ orderBy: { id: "asc" } })) console.log(`  #${j.id} ${j.sekolahLabel} ${j.jamMasuk}–${j.jamPulang} toleransi ${j.toleransiMenit ?? "umum"}`);
    console.log(`  Cadangan: ${opsi.cadangan}`);
  } finally {
    await db.$disconnect();
  }
}

// Diimpor tes (rencanaJamVoliko) → jangan jalan otomatis.
if (process.argv[1] && /voliko-jam-kerja\.ts$/.test(process.argv[1])) {
  utama()
    .catch((e: unknown) => {
      if (e instanceof Batal) console.error(`\nBATAL: ${e.message}`);
      else console.error("\nGAGAL:", e);
      process.exitCode = 1;
    })
    .finally(async () => {
      // Klien prisma bersama (lib/prisma, dipakai pengaturan shift) ikut ditutup supaya proses selesai.
      const { prisma } = await import("@/lib/prisma");
      await prisma.$disconnect();
    });
}
