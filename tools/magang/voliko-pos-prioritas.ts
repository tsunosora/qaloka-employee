/**
 * Pasang pos rotasi PRIORITAS magang (Konten + Produksi, keputusan owner 9 Nov 2026) dan susun ulang
 * rotasi peserta aktif mulai Senin tertentu. Data pos & soal: lib/services/magang/pos-prioritas.ts.
 *
 * Jalankan DI SERVER, di dalam folder aplikasi (yang punya .env berisi DATABASE_URL):
 *
 *   npx tsx tools/magang/voliko-pos-prioritas.ts                  # DRY RUN (bawaan): hanya mencetak rencana
 *   npx tsx tools/magang/voliko-pos-prioritas.ts --jalankan       # cadangan JSON lalu tulis ke DB
 *
 * Pilihan:
 *   --dari=YYYY-MM-DD     Senin mulai rotasi baru (bawaan 2026-11-16). Harus Senin & sesudah Senin minggu ini (WIB).
 *   --pembimbing=<id>     Employee id pembimbing untuk pos yang BARU dibuat (bawaan 13).
 *   --cadangan=<folder>   Folder cadangan JSON (bawaan ./cadangan-magang-<waktu>/). Gagal menulis = batal.
 *   --paksa               Lewati penolakan tanggal (Senin minggu ini / lampau) & penolakan karena sudah ada
 *                         tugas mingguan / jurnal sejak tanggal mulai.
 *   --bantuan             Tampilkan teks ini.
 *
 * Aman diulang (idempoten):
 *   - Pos dicari dengan NAMA PERSIS (yang belum dihapus). Belum ada → dibuat beserta soalnya. Sudah ada →
 *     isinya dibiarkan; soal hanya ditambahkan bila pos itu belum punya soal sama sekali.
 *   - Pos lama "Customer Service", "Desainer", "Operator Outdoor", "Operator A3+" hanya DINONAKTIFKAN (tidak
 *     dihapus). Pos lain (termasuk "Orientasi & Training (Pusat)") tidak disentuh.
 *   - Penugasan yang mulai SEBELUM --dari dipertahankan (minggu Orientasi 9–14 Nov tetap). Yang mulai ≥ --dari
 *     dihapus lalu disusun ulang — sama dengan "Susun rotasi semua" di UI, tapi hanya memakai 5 pos baru.
 *   - Semua penulisan dalam SATU transaksi (tanpa DDL). Batal di tengah = tidak ada yang berubah.
 *
 * Kode keluar ≠ 0 bila dibatalkan / gagal.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { seninDari, tambahHari, tambahMinggu, type PenugasanAda } from "@/lib/services/magang/rotasi";
import { POS_PRIORITAS, rencanakan, type Rencana } from "@/lib/services/magang/pos-prioritas";
import { posSchema, soalSchema } from "@/lib/validators/magang";

const MIGRASI_WAJIB = "20261109000000_magang_sidequest_sekolah";
const NAMA_ORIENTASI = "Orientasi & Training (Pusat)";
const WIB_MENIT = 7 * 60;

/** Pembatalan yang disengaja (pesan jelas, tanpa stack trace). */
class Batal extends Error {}

type Opsi = { jalankan: boolean; paksa: boolean; bantuan: boolean; dari: string; pembimbing: number; cadangan: string };

// ── Argumen ───────────────────────────────────────────────────────────────────────────────────

function bacaArgumen(argv: readonly string[]): Opsi {
  const opsi: Opsi = {
    jalankan: false,
    paksa: false,
    bantuan: false,
    dari: "2026-11-16",
    pembimbing: 13,
    cadangan: resolve(`./cadangan-magang-${capWaktuWib()}`),
  };
  for (const arg of argv) {
    const [kunci, nilai] = arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, ""];
    if (kunci === "--jalankan") opsi.jalankan = true;
    else if (kunci === "--paksa") opsi.paksa = true;
    else if (kunci === "--bantuan" || kunci === "-h" || kunci === "--help") opsi.bantuan = true;
    else if (kunci === "--dari") opsi.dari = nilai;
    else if (kunci === "--cadangan" && nilai) opsi.cadangan = resolve(nilai);
    else if (kunci === "--pembimbing") {
      const n = Number(nilai);
      if (!Number.isInteger(n) || n <= 0) throw new Batal(`--pembimbing harus angka id karyawan, bukan "${nilai}".`);
      opsi.pembimbing = n;
    } else throw new Batal(`Pilihan tidak dikenal: ${arg} (lihat --bantuan).`);
  }
  return opsi;
}

/** Tanggal hari ini menurut WIB, apa pun zona waktu proses. */
function hariIniWib(): string {
  return new Date(Date.now() + WIB_MENIT * 60_000).toISOString().slice(0, 10);
}

/** Cap waktu WIB untuk nama folder cadangan, mis. 20261109-143340. */
function capWaktuWib(): string {
  return new Date(Date.now() + WIB_MENIT * 60_000).toISOString().slice(0, 19).replace(/-|:/g, "").replace("T", "-");
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function tgl(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${String(d).padStart(2, " ")} ${BULAN[m - 1]} ${y}`;
}

/** Senin mulai → Sabtu terakhir blok (minggu kerja Senin–Sabtu). */
function rentang(a: { mulai: string; minggu: number }): string {
  return `${tgl(a.mulai)} – ${tgl(tambahHari(tambahMinggu(a.mulai, a.minggu), -2))}`;
}

// ── Pemeriksaan sebelum apa pun ───────────────────────────────────────────────────────────────

/** Data statis harus lolos validator yang sama dengan UI. */
function cekDataStatis(pembimbingId: number) {
  for (const p of POS_PRIORITAS) {
    const r = posSchema.safeParse({ ...p, pembimbingId, aktif: true });
    if (!r.success) throw new Batal(`Data pos "${p.nama}" tidak lolos posSchema: ${r.error.issues.map((i) => i.message).join("; ")}`);
    for (const s of p.soal) {
      const rs = soalSchema.safeParse({ posId: 1, ...s, aktif: true });
      if (!rs.success) throw new Batal(`Soal "${s.pertanyaan}" (${p.nama}) tidak lolos soalSchema.`);
    }
  }
}

function cekTanggal(opsi: Opsi) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opsi.dari) || Number.isNaN(Date.parse(opsi.dari))) throw new Batal(`--dari harus YYYY-MM-DD, bukan "${opsi.dari}".`);
  if (seninDari(opsi.dari) !== opsi.dari) throw new Batal(`--dari=${opsi.dari} bukan hari Senin (Senin minggu itu: ${seninDari(opsi.dari)}).`);
  const seninIni = seninDari(hariIniWib());
  if (opsi.dari <= seninIni) {
    if (!opsi.paksa) throw new Batal(`--dari=${opsi.dari} tidak sesudah Senin minggu ini (${seninIni}, WIB) — jadwal minggu berjalan bisa teracak. Pakai --paksa bila memang sengaja.`);
    console.log(`PERINGATAN: --dari=${opsi.dari} ≤ Senin minggu ini (${seninIni}); dilanjutkan karena --paksa.`);
  }
}

async function cekMigrasi(db: PrismaClient) {
  const kolom = await db.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MagangPos' AND COLUMN_NAME = 'lokasi'`;
  if (Number(kolom[0]?.n ?? 0) === 0) throw new Batal(`Kolom MagangPos.lokasi belum ada — jalankan dulu migrasi ${MIGRASI_WAJIB} (npx prisma migrate deploy).`);
  let catatan: { finished_at: Date | null; rolled_back_at: Date | null }[] = [];
  try {
    catatan = await db.$queryRaw`SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ${MIGRASI_WAJIB}`;
  } catch {
    throw new Batal("Tabel _prisma_migrations tidak terbaca — basis data ini tidak dikelola Prisma Migrate?");
  }
  if (!catatan.some((c) => c.finished_at && !c.rolled_back_at)) throw new Batal(`Migrasi ${MIGRASI_WAJIB} belum tercatat selesai di _prisma_migrations.`);
  console.log(`✓ Migrasi ${MIGRASI_WAJIB} terpasang (kolom MagangPos.lokasi ada).`);
}

async function cekPembimbing(db: PrismaClient, id: number) {
  const e = await db.employee.findUnique({ where: { id }, select: { id: true, fullName: true, nickname: true, isActive: true, deletedAt: true } });
  if (!e) throw new Batal(`Pembimbing id ${id} tidak ada di tabel Employee.`);
  if (e.deletedAt) throw new Batal(`Pembimbing id ${id} sudah dihapus.`);
  if (!e.isActive) throw new Batal(`Pembimbing id ${id} tidak aktif.`);
  const peserta = await db.magangPeserta.findUnique({ where: { employeeId: id }, select: { id: true } });
  if (peserta) throw new Batal(`Pembimbing id ${id} adalah peserta magang (peserta id ${peserta.id}) — pilih karyawan lain.`);
  console.log(`✓ Pembimbing pos baru: id ${id} (${e.nickname?.trim() || e.fullName}).`);
}

/** Tanggal di DB = tengah malam LOKAL. Bila jamnya bukan 00:00 di proses ini, zona waktu proses ≠ aplikasi. */
function cekZonaWaktu(tanggal: readonly Date[]) {
  const offset = -new Date().getTimezoneOffset();
  const label = `UTC${offset >= 0 ? "+" : "-"}${Math.abs(offset / 60)}`;
  const melenceng = tanggal.filter((d) => d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0);
  if (melenceng.length > 0) {
    throw new Batal(
      `${melenceng.length} tanggal di DB bukan tengah malam menurut zona proses ini (${label}, TZ=${process.env.TZ ?? "-"}), mis. ${melenceng[0].toISOString()}. ` +
        "Jalankan dengan zona yang sama dengan aplikasi, mis. TZ=Asia/Jakarta npx tsx …"
    );
  }
  if (offset !== WIB_MENIT) console.log(`PERINGATAN: zona waktu proses ${label}, bukan WIB. Data lama cocok, jadi dilanjutkan — pastikan sama dengan aplikasi.`);
  else console.log(`✓ Zona waktu proses WIB (${label}); tanggal di DB tengah malam lokal.`);
}

// ── Cetak rencana ─────────────────────────────────────────────────────────────────────────────

function cetakRencana(r: Rencana, namaPeserta: Map<number, string>, namaPos: Map<number, string>) {
  console.log(`\n== Pos prioritas (${r.pos.length}) ==`);
  for (const p of r.pos) {
    const lok = p.def.lokasi ? `, lokasi "${p.def.lokasi}"` : "";
    if (p.baru) console.log(`  + BUAT  "${p.def.nama}" — ${p.def.durasiMinggu} mg, kap ${p.def.kapasitas}${lok}, urutan ${p.def.urutan}, ${p.def.soal.length} soal`);
    else console.log(`  = ADA   "${p.def.nama}" (id ${p.id}, ${p.durasiMinggu} mg, kap ${p.kapasitas}) — dibiarkan${p.tambahSoal ? `; +${p.def.soal.length} soal (belum punya soal)` : ""}`);
  }

  console.log(`\n== Pos lama dinonaktifkan (${r.nonaktifkan.length}) ==`);
  if (r.nonaktifkan.length === 0) console.log("  (tidak ada yang masih aktif)");
  for (const p of r.nonaktifkan) console.log(`  - "${p.nama}" (id ${p.id}) → aktif = false`);

  if (r.tetapAktif.length > 0) {
    console.log(`\n== PENGINGAT: pos lain yang TETAP AKTIF ==`);
    for (const p of r.tetapAktif) console.log(`  ! "${p.nama}" (id ${p.id})`);
    const adaOrientasi = r.tetapAktif.some((p) => p.nama === NAMA_ORIENTASI);
    console.log(
      `  ${adaOrientasi ? `"${NAMA_ORIENTASI}" masih aktif. ` : ""}Pos aktif di atas IKUT rotasi bila seseorang menekan "Susun rotasi semua" di UI.\n` +
        "  Nonaktifkan dulu di Magang → Pos & Soal sebelum memakai tombol itu, atau minta admin memakai mode \"Tambah peserta baru\"."
    );
  }

  if (r.berjalan.length > 0) {
    console.log(`\n== PERHATIAN: penugasan lama yang masih berjalan sesudah ${r.dari} (dipertahankan) ==`);
    for (const a of r.berjalan) console.log(`  ${namaPeserta.get(a.pesertaId) ?? a.pesertaId}: ${rentang(a)}  ${namaPos.get(a.posId) ?? `pos ${a.posId}`}`);
  }

  console.log(`\n== Rotasi mulai ${tgl(r.dari).trim()} ==`);
  console.log(`  Dipertahankan (mulai < ${r.dari}): ${r.ada.length} penugasan · dihapus (mulai ≥ ${r.dari}): ${r.hapus.length} · baru: ${r.usulan.length}`);
  for (const [pesertaId, nama] of namaPeserta) {
    const blok = r.usulan.filter((a) => a.pesertaId === pesertaId);
    const berbagi = blok.filter((a) => a.berbagi).length;
    console.log(`\n  ${nama} (peserta ${pesertaId}) — ${blok.length} blok, berbagi ${berbagi}`);
    for (const a of r.ada.filter((x) => x.pesertaId === pesertaId)) console.log(`    [tetap] ${rentang(a)}  ${namaPos.get(a.posId) ?? `pos ${a.posId}`}`);
    for (const a of blok) console.log(`    ${a.berbagi ? "[BAGI] " : "       "} ${rentang(a)}  ${namaPos.get(a.posId) ?? `pos ${a.posId}`}`);
  }
  const totalBerbagi = r.usulan.filter((a) => a.berbagi).length;
  console.log(`\n  Total blok berbagi: ${totalBerbagi}${totalBerbagi > 0 ? "  ← ada pos yang kelebihan anak" : ""}`);
}

// ── Cadangan ──────────────────────────────────────────────────────────────────────────────────

function tulisCadangan(folder: string, isi: Record<string, unknown>) {
  try {
    mkdirSync(folder, { recursive: true });
    for (const [nama, data] of Object.entries(isi)) {
      const berkas = join(folder, `${nama}.json`);
      writeFileSync(berkas, JSON.stringify(data, null, 2), { encoding: "utf8", flag: "wx" }); // wx: jangan timpa cadangan lama
      JSON.parse(readFileSync(berkas, "utf8")); // pastikan terbaca utuh
    }
  } catch (e) {
    throw new Batal(`Gagal menulis cadangan ke ${folder}: ${(e as Error).message}. Tidak ada yang diubah di DB.`);
  }
  console.log(`✓ Cadangan ditulis: ${folder}`);
}

// ── Utama ─────────────────────────────────────────────────────────────────────────────────────

async function utama() {
  const opsi = bacaArgumen(process.argv.slice(2));
  if (opsi.bantuan) {
    const teks = readFileSync(process.argv[1], "utf8");
    console.log(teks.slice(teks.indexOf("/**") + 3, teks.indexOf("*/")).replace(/^ \* ?/gm, ""));
    return;
  }
  console.log(`Mode: ${opsi.jalankan ? "JALANKAN (menulis ke DB)" : "DRY RUN (tidak menulis apa pun)"} · dari ${opsi.dari} · pembimbing ${opsi.pembimbing}${opsi.paksa ? " · --paksa" : ""}`);
  cekDataStatis(opsi.pembimbing);
  cekTanggal(opsi);

  const db = new PrismaClient();
  try {
    await cekMigrasi(db);
    await cekPembimbing(db, opsi.pembimbing);

    // Data sekarang. Filter peserta = sama dengan susunUlang() di lib/services/magang/layanan.ts.
    const [posDbMentah, peserta] = await Promise.all([
      db.magangPos.findMany({
        where: { deletedAt: null },
        orderBy: [{ urutan: "asc" }, { id: "asc" }],
        select: { id: true, nama: true, aktif: true, durasiMinggu: true, kapasitas: true, _count: { select: { soal: true } } },
      }),
      db.magangPeserta.findMany({
        where: { aktif: true, employee: { deletedAt: null, isActive: true } },
        orderBy: { id: "asc" },
        select: { id: true, mulai: true, selesai: true, employee: { select: { fullName: true, nickname: true } } },
      }),
    ]);
    if (peserta.length === 0) throw new Batal("Tidak ada peserta magang aktif.");
    const pesertaIds = peserta.map((p) => p.id);
    const penugasan = await db.magangPenugasan.findMany({ where: { pesertaId: { in: pesertaIds } }, orderBy: [{ pesertaId: "asc" }, { mulai: "asc" }] });

    cekZonaWaktu([...penugasan.map((a) => a.mulai), ...peserta.flatMap((p) => (p.selesai ? [p.mulai, p.selesai] : [p.mulai]))]);

    const dari = atMidnight(opsi.dari);
    const [tugasSesudah, jurnalSesudah] = await Promise.all([
      db.magangTugas.count({ where: { pesertaId: { in: pesertaIds }, senin: { gte: dari } } }),
      db.magangJurnal.count({ where: { pesertaId: { in: pesertaIds }, tanggal: { gte: dari } } }),
    ]);
    if (tugasSesudah + jurnalSesudah > 0) {
      const pesan = `Sudah ada ${tugasSesudah} tugas mingguan & ${jurnalSesudah} jurnal sejak ${opsi.dari} — posnya bisa tidak cocok dengan rotasi baru.`;
      if (!opsi.paksa) throw new Batal(`${pesan} Pakai --paksa bila memang sengaja.`);
      console.log(`PERINGATAN: ${pesan} Dilanjutkan karena --paksa.`);
    }

    const rencana = rencanakan({
      posDb: posDbMentah.map((p) => ({ id: p.id, nama: p.nama, aktif: p.aktif, durasiMinggu: p.durasiMinggu, kapasitas: p.kapasitas, jumlahSoal: p._count.soal })),
      peserta: peserta.map((p) => ({ id: p.id, mulai: toYmd(p.mulai), selesai: p.selesai ? toYmd(p.selesai) : null })),
      penugasan: penugasan.map((a): PenugasanAda => ({ pesertaId: a.pesertaId, posId: a.posId, mulai: toYmd(a.mulai), minggu: a.minggu })),
      dari: opsi.dari,
    });
    if (rencana.masalah.length > 0) throw new Batal(`Rencana tidak bisa dijalankan:\n  - ${rencana.masalah.join("\n  - ")}`);

    const namaPeserta = new Map(peserta.map((p) => [p.id, p.employee.nickname?.trim() || p.employee.fullName]));
    const namaPos = new Map<number, string>([...posDbMentah.map((p): [number, string] => [p.id, p.nama]), ...rencana.pos.map((p): [number, string] => [p.id, p.def.nama])]);
    cetakRencana(rencana, namaPeserta, namaPos);

    if (!opsi.jalankan) {
      console.log(`\nDRY RUN selesai — tidak ada yang ditulis. Cadangan akan ditulis ke: ${opsi.cadangan}`);
      console.log("Ulangi dengan --jalankan untuk menerapkan.");
      return;
    }

    // Cadangan dulu; gagal = batal sebelum menyentuh DB.
    const posTerdampak = [...rencana.pos.filter((p) => !p.baru).map((p) => p.id), ...rencana.nonaktifkan.map((p) => p.id)];
    tulisCadangan(opsi.cadangan, {
      MagangPos: await db.magangPos.findMany({ orderBy: { id: "asc" } }),
      MagangSoal: await db.magangSoal.findMany({ where: { posId: { in: posTerdampak } }, orderBy: { id: "asc" } }),
      MagangPenugasan: await db.magangPenugasan.findMany({ where: { pesertaId: { in: pesertaIds } }, orderBy: { id: "asc" } }),
      rencana: { dibuatPada: new Date().toISOString(), opsi, rencana },
    });

    const hasil = await db.$transaction(
      async (tx) => {
        const idAsli = new Map<number, number>();
        let posDibuat = 0;
        let soalDitambah = 0;
        for (const p of rencana.pos) {
          const soal = p.def.soal.map((s) => ({ pertanyaan: s.pertanyaan, pilihan: s.pilihan, benar: s.benar }));
          if (p.baru) {
            // Cek ulang di dalam transaksi: jangan membuat pos kembar bila ada yang membuatnya barusan.
            const kembar = await tx.magangPos.findFirst({ where: { nama: p.def.nama, deletedAt: null }, select: { id: true } });
            if (kembar) throw new Batal(`Pos "${p.def.nama}" muncul (id ${kembar.id}) sejak rencana dibuat — jalankan ulang skrip.`);
            const dibuat = await tx.magangPos.create({
              data: {
                nama: p.def.nama,
                deskripsi: p.def.deskripsi,
                durasiMinggu: p.def.durasiMinggu,
                kapasitas: p.def.kapasitas,
                urutan: p.def.urutan,
                lokasi: p.def.lokasi,
                pembimbingId: opsi.pembimbing,
                aktif: true,
                soal: { create: soal },
              },
              select: { id: true },
            });
            idAsli.set(p.id, dibuat.id);
            posDibuat++;
            soalDitambah += soal.length;
          } else {
            idAsli.set(p.id, p.id);
            if (p.tambahSoal && (await tx.magangSoal.count({ where: { posId: p.id } })) === 0) {
              await tx.magangSoal.createMany({ data: soal.map((s) => ({ ...s, posId: p.id })) });
              soalDitambah += soal.length;
            }
          }
        }

        const nonaktif = await tx.magangPos.updateMany({
          where: { id: { in: rencana.nonaktifkan.map((p) => p.id) }, aktif: true },
          data: { aktif: false },
        });
        const dihapus = await tx.magangPenugasan.deleteMany({ where: { pesertaId: { in: pesertaIds }, mulai: { gte: dari } } });
        const dibuat = await tx.magangPenugasan.createMany({
          data: rencana.usulan.map((b) => {
            const posId = idAsli.get(b.posId);
            if (!posId) throw new Batal(`Id pos ${b.posId} tidak terpetakan — dibatalkan.`);
            return { pesertaId: b.pesertaId, posId, mulai: atMidnight(b.mulai), minggu: b.minggu, berbagi: b.berbagi };
          }),
        });
        return { posDibuat, soalDitambah, nonaktif: nonaktif.count, dihapus: dihapus.count, dibuat: dibuat.count, idAsli };
      },
      { timeout: 60_000 }
    );

    console.log("\n== SELESAI ==");
    console.log(`  Pos dibuat: ${hasil.posDibuat} · soal ditambah: ${hasil.soalDitambah} · pos lama dinonaktifkan: ${hasil.nonaktif}`);
    console.log(`  Penugasan dihapus (mulai ≥ ${opsi.dari}): ${hasil.dihapus} · penugasan baru: ${hasil.dibuat}`);
    for (const p of rencana.pos) console.log(`  "${p.def.nama}" → id ${hasil.idAsli.get(p.id)}`);
    console.log(`  Cadangan: ${opsi.cadangan}`);
  } finally {
    await db.$disconnect();
  }
}

utama().catch((e: unknown) => {
  if (e instanceof Batal) console.error(`\nBATAL: ${e.message}`);
  else console.error("\nGAGAL:", e);
  process.exitCode = 1;
});
