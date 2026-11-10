/**
 * Pasangan jadwal harian Voliko (14 Nov 2026): 4 pasangan KONTEN / PRODUKSI bergantian, patokan Selasa 10 Nov 2026
 * (data: tools/magang/data/voliko-pasangan.ts).
 *
 * Jalankan DI SERVER, di dalam folder aplikasi (yang punya .env berisi DATABASE_URL):
 *
 *   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jadwal-harian.ts               # DRY RUN (bawaan): rencana + grid
 *   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jadwal-harian.ts --jalankan    # cadangan JSON lalu tulis ke DB
 *
 * Pilihan:
 *   --cadangan=<folder>   Folder cadangan JSON (bawaan ~/cadangan/magang-harian-<waktu WIB>). Gagal menulis = batal.
 *   --bantuan             Tampilkan teks ini.
 *
 * Aman diulang (idempoten), satu transaksi tanpa DDL:
 *   - Batal bila migrasi 20261114000000_magang_jadwal_harian belum terpasang, bila id peserta tidak ada / nama
 *     panggilannya tidak cocok, atau bila anak sudah ada di pasangan AKTIF lain (aturan satu anak = satu pasangan aktif).
 *   - Pasangan dicari per anggota (dua id peserta, urutan bebas): sudah ada → dibiarkan apa adanya (patokan/aktif/urutan
 *     yang diubah pembina TIDAK ditimpa; beda dengan data dilaporkan); belum ada → dibuat.
 *   - Pengecualian tidak disentuh.
 * Dry-run mencetak grid 10–16 Nov + 2 minggu sesudahnya (pasangan yang ada + yang akan dibuat; libur & pengecualian DB).
 *
 * Kode keluar ≠ 0 bila dibatalkan / gagal.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { bentrokPasangan, labelTanggal, tambahHariH, tugasPada, hariDalamMinggu, hariKerja, type AnakH, type PasanganH, type PengecualianH } from "@/lib/services/magang/harian";
import { muatAnakHarian, muatLibur, muatPasangan, muatPengecualian } from "@/lib/services/magang/harian-db";
import { MIGRASI_HARIAN, PASANGAN_VOLIKO } from "./data/voliko-pasangan";

const WIB_MENIT = 7 * 60;
export const GRID_DARI = "2026-11-10";
export const GRID_SAMPAI = "2026-11-30";

type DataPasangan = { urutan: number; a: { pesertaId: number; panggilan: string }; b: { pesertaId: number; panggilan: string }; patokanTanggal: string; patokanTugas: "konten" | "produksi" };
export type AksiPasangan = DataPasangan & { aksi: "buat" | "ada"; id?: number; beda?: string };

const samaNama = (a: string, b: string) => a.trim().toLocaleLowerCase("id") === b.trim().toLocaleLowerCase("id");

/**
 * Rencana murni (tanpa DB). masalah = alasan batal. Idempoten: sesudah diterapkan, rencana ulang = 0 "buat".
 */
export function rencanaPasanganVoliko(
  ada: readonly PasanganH[],
  anak: ReadonlyMap<number, Pick<AnakH, "pesertaId" | "panggilan">>,
  data: readonly DataPasangan[] = PASANGAN_VOLIKO
): { aksi: AksiPasangan[]; masalah: string[] } {
  const masalah: string[] = [];
  for (const d of data)
    for (const x of [d.a, d.b]) {
      const a = anak.get(x.pesertaId);
      if (!a) masalah.push(`Peserta id ${x.pesertaId} (${x.panggilan}) tidak ada.`);
      else if (!samaNama(a.panggilan, x.panggilan)) masalah.push(`Peserta id ${x.pesertaId}: panggilan di DB "${a.panggilan}", data "${x.panggilan}".`);
    }
  const terencana: { id?: number; pesertaAId: number; pesertaBId: number | null; aktif: boolean }[] = ada.map((p) => ({ ...p }));
  const aksi = data.map((d): AksiPasangan => {
    const ids = [d.a.pesertaId, d.b.pesertaId].sort((x, y) => x - y).join(",");
    const sama = ada.find((p) => [p.pesertaAId, p.pesertaBId ?? 0].sort((x, y) => x - y).join(",") === ids);
    if (sama) {
      const beda: string[] = [];
      if (sama.patokanTanggal !== d.patokanTanggal || sama.patokanTugas !== d.patokanTugas) beda.push(`patokan ${sama.patokanTanggal} ${sama.patokanTugas}`);
      if (!sama.aktif) beda.push("nonaktif");
      return { ...d, aksi: "ada", id: sama.id, beda: beda.length ? beda.join(", ") : undefined };
    }
    const calon = { pesertaAId: d.a.pesertaId, pesertaBId: d.b.pesertaId, aktif: true };
    for (const b of bentrokPasangan(terencana, calon)) masalah.push(`${anak.get(b.pesertaId)?.panggilan ?? b.pesertaId} sudah di pasangan aktif #${b.pasanganId}.`);
    terencana.push({ id: -terencana.length - 1, ...calon });
    return { ...d, aksi: "buat" };
  });
  return { aksi, masalah };
}

/** Grid teks: baris = tanggal, kolom = pasangan (KONTEN/PRODUKSI/LIBUR; "+" = pengecualian, "(s)" = sendiri). */
export function gridTeks(input: {
  pasangan: readonly PasanganH[];
  anak: ReadonlyMap<number, AnakH>;
  libur: ReadonlyMap<string, string>;
  pengecualian: readonly PengecualianH[];
  dari: string;
  sampai: string;
}): string {
  const aktif = input.pasangan.filter((p) => p.aktif).sort((a, b) => a.urutan - b.urutan || a.id - b.id);
  const nama = (id: number | null) => (id == null ? "-" : input.anak.get(id)?.panggilan ?? `#${id}`);
  const kolom = aktif.map((p) => `${nama(p.pesertaAId)} & ${nama(p.pesertaBId)}`);
  const lebar = Math.max(16, ...kolom.map((k) => k.length));
  const libur = new Set(input.libur.keys());
  const baris = [["Tanggal".padEnd(16), ...kolom.map((k) => k.padEnd(lebar))].join(" | ")];
  for (let t = input.dari; t <= input.sampai; t = tambahHariH(t, 1)) {
    if (hariDalamMinggu(t) === 0) {
      baris.push(`${labelTanggal(t).padEnd(16)} | (Minggu — libur)`);
      continue;
    }
    if (!hariKerja(t, libur)) {
      baris.push(`${labelTanggal(t).padEnd(16)} | (libur: ${input.libur.get(t) ?? "-"})`);
      continue;
    }
    const peta = tugasPada(input.pasangan, t, libur, input.pengecualian, input.anak);
    const sel = aktif.map((p) => {
      const h = peta.get(p.pesertaAId);
      if (!h) return "-";
      const isi = h.keadaan === "tugas" && h.tugas ? h.tugas.toUpperCase() : h.keadaan === "libur" ? "LIBUR" : h.keadaan === "di-luar-masa" ? "di luar masa" : "-";
      return `${isi}${h.sendiri ? " (s)" : ""}${h.sumber === "pengecualian" ? " +" : ""}`.padEnd(lebar);
    });
    baris.push([labelTanggal(t).padEnd(16), ...sel].join(" | "));
  }
  return baris.join("\n");
}

class Batal extends Error {}
type Opsi = { jalankan: boolean; bantuan: boolean; cadangan: string };

function capWaktuWib(): string {
  return new Date(Date.now() + WIB_MENIT * 60_000).toISOString().slice(0, 19).replace(/-|:/g, "").replace("T", "-");
}

function bacaArgumen(argv: readonly string[]): Opsi {
  const opsi: Opsi = { jalankan: false, bantuan: false, cadangan: join(homedir(), "cadangan", `magang-harian-${capWaktuWib()}`) };
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
    catatan = await db.$queryRaw`SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ${MIGRASI_HARIAN}`;
  } catch {
    throw new Batal("Tabel _prisma_migrations tidak terbaca — basis data ini tidak dikelola Prisma Migrate?");
  }
  if (!catatan.some((c) => c.finished_at && !c.rolled_back_at)) throw new Batal(`Migrasi ${MIGRASI_HARIAN} belum terpasang — jalankan dulu npx prisma migrate deploy.`);
  console.log(`✓ Migrasi ${MIGRASI_HARIAN} terpasang.`);
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
    const [anak, ada] = await Promise.all([muatAnakHarian(db), muatPasangan(db)]);
    const { aksi, masalah } = rencanaPasanganVoliko(ada, anak);
    console.log("\n== Peserta ==");
    for (const d of PASANGAN_VOLIKO)
      for (const x of [d.a, d.b]) {
        const a = anak.get(x.pesertaId);
        console.log(`  #${x.pesertaId} ${x.panggilan.padEnd(8)} → ${a ? `${a.panggilan} · ${a.mulai}..${a.selesai ?? "?"} · ${a.aktif ? "aktif" : "NONAKTIF"}` : "TIDAK ADA"}`);
      }
    console.log("\n== Pasangan sekarang ==");
    if (ada.length === 0) console.log("  (belum ada)");
    for (const p of ada) console.log(`  #${p.id} ${anak.get(p.pesertaAId)?.panggilan} & ${p.pesertaBId ? anak.get(p.pesertaBId)?.panggilan : "-"} · patokan ${p.patokanTanggal} ${p.patokanTugas} · ${p.aktif ? "aktif" : "nonaktif"} · urutan ${p.urutan}`);
    console.log("\n== Rencana ==");
    for (const a of aksi) console.log(`  ${a.aksi === "buat" ? "+ BUAT" : "= ADA "} ${a.a.panggilan} & ${a.b.panggilan} · patokan ${a.patokanTanggal} ${a.patokanTugas.toUpperCase()} · urutan ${a.urutan}${a.id ? ` (#${a.id})` : ""}${a.beda ? ` — BEDA dengan data: ${a.beda} (dibiarkan)` : ""}`);
    if (masalah.length) throw new Batal(masalah.join("\n  "));

    // Grid pratinjau: pasangan yang ada + yang akan dibuat.
    const rencana: PasanganH[] = [
      ...ada,
      ...aksi
        .filter((a) => a.aksi === "buat")
        .map((a, i): PasanganH => ({ id: -1 - i, nama: null, pesertaAId: a.a.pesertaId, pesertaBId: a.b.pesertaId, patokanTanggal: a.patokanTanggal, patokanTugas: a.patokanTugas, aktif: true, urutan: a.urutan })),
    ];
    const tgl = [GRID_DARI, ...rencana.map((p) => p.patokanTanggal)].sort();
    const [libur, pengecualian] = await Promise.all([muatLibur(db, tgl[0], GRID_SAMPAI), muatPengecualian(db, GRID_DARI, GRID_SAMPAI)]);
    console.log(`\n== Grid ${GRID_DARI} – ${GRID_SAMPAI} ==`);
    console.log(gridTeks({ pasangan: rencana, anak, libur, pengecualian, dari: GRID_DARI, sampai: GRID_SAMPAI }));

    const buat = aksi.filter((a) => a.aksi === "buat");
    console.log(`\n  Akan dibuat: ${buat.length} pasangan · sudah ada: ${aksi.length - buat.length}`);
    if (!opsi.jalankan) {
      console.log(`\nDRY RUN selesai — tidak ada yang ditulis. Cadangan akan ditulis ke: ${opsi.cadangan}`);
      console.log("Ulangi dengan --jalankan untuk menerapkan.");
      return;
    }

    try {
      mkdirSync(opsi.cadangan, { recursive: true });
      const isi: Record<string, unknown> = {
        MagangPasangan: await db.magangPasangan.findMany({ orderBy: { id: "asc" } }),
        MagangHarianPengecualian: await db.magangHarianPengecualian.findMany({ orderBy: { id: "asc" } }),
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
      // Ulang periksa di dalam transaksi (idempoten bila dua proses berjalan bersamaan).
      const sekarang = (await tx.magangPasangan.findMany()).map((p) => ({ ...p, patokanTanggal: "", patokanTugas: "konten" as const }));
      let n = 0;
      for (const a of buat) {
        const ids = [a.a.pesertaId, a.b.pesertaId].sort((x, y) => x - y).join(",");
        if (sekarang.some((p) => [p.pesertaAId, p.pesertaBId ?? 0].sort((x, y) => x - y).join(",") === ids)) continue;
        if (bentrokPasangan(sekarang, { pesertaAId: a.a.pesertaId, pesertaBId: a.b.pesertaId, aktif: true }).length) throw new Batal(`Bentrok saat menulis: ${a.a.panggilan} & ${a.b.panggilan}.`);
        const p = await tx.magangPasangan.create({
          data: { pesertaAId: a.a.pesertaId, pesertaBId: a.b.pesertaId, patokanTanggal: new Date(`${a.patokanTanggal}T00:00:00`), patokanTugas: a.patokanTugas, aktif: true, urutan: a.urutan },
        });
        sekarang.push({ ...p, patokanTanggal: "", patokanTugas: "konten" });
        n++;
      }
      return n;
    });
    console.log("\n== SELESAI ==");
    console.log(`  Pasangan dibuat: ${dibuat}`);
    for (const p of await muatPasangan(db)) console.log(`  #${p.id} ${anak.get(p.pesertaAId)?.panggilan} & ${p.pesertaBId ? anak.get(p.pesertaBId)?.panggilan : "-"} · patokan ${p.patokanTanggal} ${p.patokanTugas} · urutan ${p.urutan}`);
    console.log(`  Cadangan: ${opsi.cadangan}`);
  } finally {
    await db.$disconnect();
  }
}

// Diimpor tes (rencanaPasanganVoliko, gridTeks) → jangan jalan otomatis.
if (process.argv[1] && /voliko-jadwal-harian\.ts$/.test(process.argv[1])) {
  utama().catch((e: unknown) => {
    if (e instanceof Batal) console.error(`\nBATAL: ${e.message}`);
    else console.error("\nGAGAL:", e);
    process.exitCode = 1;
  });
}
