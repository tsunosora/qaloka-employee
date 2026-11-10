/**
 * Impor jadwal konten Voliko November 2026 (sheet pembina) ke tabel MagangKonten*. Data: tools/magang/data/voliko-konten-nov2026.ts.
 *
 * Jalankan DI SERVER, di dalam folder aplikasi (yang punya .env berisi DATABASE_URL):
 *
 *   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jadwal-konten.ts               # DRY RUN (bawaan): cetak rencana + tabel
 *   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jadwal-konten.ts --jalankan    # cadangan JSON lalu tulis ke DB
 *
 * Pilihan:
 *   --cadangan=<folder>   Folder cadangan JSON (bawaan ~/cadangan/magang-konten-<waktu WIB>). Gagal menulis = batal.
 *   --bantuan             Tampilkan teks ini.
 *
 * Aman diulang (idempoten), satu transaksi tanpa DDL:
 *   - Batal bila migrasi 20261112000000_magang_jadwal_konten ATAU 20261113000000_magang_konten_platform belum terpasang.
 *   - Sejak multi-platform (13 Nov 2026) semua baris & brief masuk ke platform "Voliko Print" (kunci voliko-print,
 *     dibuat migrasi); platform itu tidak ada = batal.
 *   - Anak dicocokkan dengan MagangPeserta.id DAN nama panggilan (beda = batal). Kode anak hanya dipasang bila
 *     kolomnya masih kosong atau sudah sama; kode yang dipegang anak lain = batal.
 *   - Konsep dicari per kunci, status per kunci, grup per nama: belum ada → dibuat; sudah ada → dibiarkan
 *     (grup: anggota yang belum ada ditambahkan).
 *   - Brief (MagangKontenPlatform.brief Voliko Print) hanya ditulis bila masih kosong; sudah ada & berbeda → dibiarkan
 *     + peringatan. Setting magang_konten_brief lama tidak disentuh lagi.
 *   - Baris dengan (platform, tanggal, konsep, kode/grup) yang sama sudah ada → dilewati.
 *
 * Kode keluar ≠ 0 bila dibatalkan / gagal.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { atMidnight, toYmd } from "@/lib/services/leave/service";
import { hariKe, labelKonsep, namaTanggal } from "@/lib/services/magang/konten";
import { briefSchema, grupKontenSchema, konsepSchema, uraiBrief } from "@/lib/validators/magang-konten";
import { ANAK_VOLIKO, BARIS_VOLIKO, BRIEF_VOLIKO, GRUP_VOLIKO, KONSEP_VOLIKO, KUNCI_PLATFORM_VOLIKO, MIGRASI_KONTEN, MIGRASI_PLATFORM } from "./data/voliko-konten-nov2026";

const WIB_MENIT = 7 * 60;
const STATUS_WAJIB = [
  { kunci: "belum-take", nama: "Belum take", warna: "abu", urutan: 1, anakBoleh: true, final: false },
  { kunci: "sudah-take", nama: "Sudah take", warna: "biru", urutan: 2, anakBoleh: true, final: false },
  { kunci: "editing", nama: "Editing", warna: "kuning", urutan: 3, anakBoleh: true, final: false },
  { kunci: "selesai", nama: "Selesai / Diposting", warna: "hijau", urutan: 4, anakBoleh: false, final: true },
] as const;

class Batal extends Error {}

type Opsi = { jalankan: boolean; bantuan: boolean; cadangan: string };

function capWaktuWib(): string {
  return new Date(Date.now() + WIB_MENIT * 60_000).toISOString().slice(0, 19).replace(/-|:/g, "").replace("T", "-");
}

function bacaArgumen(argv: readonly string[]): Opsi {
  const opsi: Opsi = { jalankan: false, bantuan: false, cadangan: join(homedir(), "cadangan", `magang-konten-${capWaktuWib()}`) };
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

const sama = (a: string | null | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

// ── Pemeriksaan ───────────────────────────────────────────────────────────────────────────────

/** Data statis lolos validator yang sama dengan UI + bentuknya masuk akal. */
export function cekDataStatis() {
  for (const k of KONSEP_VOLIKO) {
    const r = konsepSchema.safeParse({ nama: k.nama, sub: k.sub, warna: k.warna, referensi: k.referensi });
    if (!r.success) throw new Batal(`Konsep "${k.kunci}" tidak lolos konsepSchema: ${r.error.issues.map((x) => x.message).join("; ")}`);
  }
  for (const g of GRUP_VOLIKO) {
    if (!grupKontenSchema.safeParse({ nama: g.nama, warna: g.warna }).success) throw new Batal(`Grup "${g.nama}" tidak lolos grupKontenSchema.`);
    for (const k of g.anggota) if (!ANAK_VOLIKO.some((a) => a.kode === k)) throw new Batal(`Grup ${g.nama}: kode ${k} tidak ada di daftar anak.`);
  }
  if (!briefSchema.safeParse(BRIEF_VOLIKO).success) throw new Batal("Brief tidak lolos briefSchema.");
  const kode: number[] = ANAK_VOLIKO.map((a) => a.kode);
  if (new Set(kode).size !== kode.length) throw new Batal("Kode anak di data tidak unik.");
  for (const b of BARIS_VOLIKO) {
    if (hariKe(b.tanggal) === 0) throw new Batal(`Baris ${b.tanggal} jatuh di hari Minggu.`);
    if ((b.kode == null) === (b.grup == null)) throw new Batal(`Baris ${b.tanggal}: harus kode ATAU grup.`);
    if (b.kode != null && !kode.includes(b.kode)) throw new Batal(`Baris ${b.tanggal}: kode ${b.kode} tidak dikenal.`);
    if (b.grup != null && !GRUP_VOLIKO.some((g) => g.nama === b.grup)) throw new Batal(`Baris ${b.tanggal}: grup ${b.grup} tidak dikenal.`);
  }
}

async function cekMigrasi(db: PrismaClient) {
  const tabel = await db.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MagangKonten'`;
  if (Number(tabel[0]?.n ?? 0) === 0) throw new Batal(`Tabel MagangKonten belum ada — jalankan dulu migrasi ${MIGRASI_KONTEN} (npx prisma migrate deploy).`);
  for (const migrasi of [MIGRASI_KONTEN, MIGRASI_PLATFORM]) {
    let catatan: { finished_at: Date | null; rolled_back_at: Date | null }[] = [];
    try {
      catatan = await db.$queryRaw`SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = ${migrasi}`;
    } catch {
      throw new Batal("Tabel _prisma_migrations tidak terbaca — basis data ini tidak dikelola Prisma Migrate?");
    }
    if (!catatan.some((c) => c.finished_at && !c.rolled_back_at)) throw new Batal(`Migrasi ${migrasi} belum tercatat selesai di _prisma_migrations.`);
    console.log(`✓ Migrasi ${migrasi} terpasang.`);
  }
}

function cekZonaWaktu(tanggal: readonly Date[]) {
  const offset = -new Date().getTimezoneOffset();
  const label = `UTC${offset >= 0 ? "+" : "-"}${Math.abs(offset / 60)}`;
  const melenceng = tanggal.filter((d) => d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0);
  if (melenceng.length > 0)
    throw new Batal(`${melenceng.length} tanggal di DB bukan tengah malam menurut zona proses ini (${label}), mis. ${melenceng[0].toISOString()}. Jalankan dengan TZ=Asia/Jakarta.`);
  if (offset !== WIB_MENIT) console.log(`PERINGATAN: zona waktu proses ${label}, bukan WIB — jalankan dengan TZ=Asia/Jakarta bila ragu.`);
  else console.log(`✓ Zona waktu proses WIB (${label}).`);
}

// ── Utama ─────────────────────────────────────────────────────────────────────────────────────

async function utama() {
  const opsi = bacaArgumen(process.argv.slice(2));
  if (opsi.bantuan) {
    const teks = readFileSync(process.argv[1], "utf8");
    console.log(teks.slice(teks.indexOf("/**") + 3, teks.indexOf("*/")).replace(/^ \* ?/gm, ""));
    return;
  }
  console.log(`Mode: ${opsi.jalankan ? "JALANKAN (menulis ke DB)" : "DRY RUN (tidak menulis apa pun)"}`);
  cekDataStatis();
  console.log(`✓ Data statis: ${ANAK_VOLIKO.length} anak, ${GRUP_VOLIKO.length} grup, ${KONSEP_VOLIKO.length} konsep, ${BARIS_VOLIKO.length} baris.`);

  const db = new PrismaClient();
  try {
    await cekMigrasi(db);

    // ── Anak: id + nama panggilan harus cocok ──
    const peserta = await db.magangPeserta.findMany({
      where: { id: { in: ANAK_VOLIKO.map((a) => a.pesertaId) } },
      select: { id: true, kodeKonten: true, aktif: true, mulai: true, employee: { select: { fullName: true, nickname: true, deletedAt: true, isActive: true } } },
    });
    const masalah: string[] = [];
    const pasangKode: { pesertaId: number; kode: number }[] = [];
    for (const a of ANAK_VOLIKO) {
      const p = peserta.find((x) => x.id === a.pesertaId);
      if (!p) {
        masalah.push(`Peserta id ${a.pesertaId} (${a.panggilan}) tidak ada.`);
        continue;
      }
      const panggil = p.employee.nickname?.trim() || p.employee.fullName.trim().split(/\s+/)[0];
      if (!sama(panggil, a.panggilan) && !sama(p.employee.fullName.split(/\s+/)[0], a.panggilan))
        masalah.push(`Peserta id ${a.pesertaId}: nama panggilan "${panggil}" ≠ "${a.panggilan}".`);
      if (p.employee.deletedAt) masalah.push(`Peserta id ${a.pesertaId} (${a.panggilan}): karyawannya sudah dihapus.`);
      if (!p.aktif || !p.employee.isActive) console.log(`PERINGATAN: peserta id ${a.pesertaId} (${a.panggilan}) tidak aktif — baris tetap dibuat.`);
      if (p.kodeKonten != null && p.kodeKonten !== a.kode) masalah.push(`Peserta id ${a.pesertaId} (${a.panggilan}) sudah berkode ${p.kodeKonten}, bukan ${a.kode}.`);
      if (p.kodeKonten == null) pasangKode.push({ pesertaId: a.pesertaId, kode: a.kode });
    }
    const pemegang = await db.magangPeserta.findMany({
      where: { kodeKonten: { in: ANAK_VOLIKO.map((a) => a.kode) }, id: { notIn: ANAK_VOLIKO.map((a) => a.pesertaId) } },
      select: { id: true, kodeKonten: true },
    });
    for (const p of pemegang) masalah.push(`Kode ${p.kodeKonten} sudah dipegang peserta id ${p.id} (bukan anak di data).`);
    if (masalah.length) throw new Batal(`Data anak tidak cocok:\n  - ${masalah.join("\n  - ")}`);
    console.log(`✓ ${ANAK_VOLIKO.length} anak cocok (id + nama panggilan). Kode baru dipasang: ${pasangKode.length}.`);

    const platform = await db.magangKontenPlatform.findUnique({ where: { kunci: KUNCI_PLATFORM_VOLIKO } });
    if (!platform) throw new Batal(`Platform "${KUNCI_PLATFORM_VOLIKO}" tidak ada (seharusnya dibuat migrasi ${MIGRASI_PLATFORM}).`);
    console.log(`✓ Platform tujuan: ${platform.nama} (id ${platform.id}${platform.aktif ? "" : ", DIARSIPKAN"}).`);
    const [konsepAda, statusAda, grupAda, barisAda] = await Promise.all([
      db.magangKontenKonsep.findMany(),
      db.magangKontenStatus.findMany(),
      db.magangKontenGrup.findMany({ include: { anggota: true } }),
      db.magangKonten.findMany({ where: { platformId: platform.id, tanggal: { gte: atMidnight("2026-11-01"), lt: atMidnight("2026-12-01") } } }),
    ]);
    cekZonaWaktu([...barisAda.map((b) => b.tanggal), ...peserta.map((p) => p.mulai)]);

    const konsepBaru = KONSEP_VOLIKO.filter((k) => !konsepAda.some((x) => x.kunci === k.kunci));
    const statusBaru = STATUS_WAJIB.filter((s) => !statusAda.some((x) => x.kunci === s.kunci));
    const grupBaru = GRUP_VOLIKO.filter((g) => !grupAda.some((x) => x.nama === g.nama));
    const kodeKePeserta = new Map<number, number>(ANAK_VOLIKO.map((a) => [a.kode, a.pesertaId]));
    const anggotaTambah = GRUP_VOLIKO.flatMap((g) => {
      const ada = grupAda.find((x) => x.nama === g.nama);
      return ada ? g.anggota.map((k) => kodeKePeserta.get(k)!).filter((pid) => !ada.anggota.some((a) => a.pesertaId === pid)).map((pid) => ({ grup: g.nama, pesertaId: pid })) : [];
    });
    const briefData = { ...BRIEF_VOLIKO, drive: BRIEF_VOLIKO.drive.map((d) => ({ ...d })), referensi: {} };
    const tulisBrief = platform.brief == null;
    if (!tulisBrief && JSON.stringify({ ...uraiBrief(platform.brief), referensi: undefined }) !== JSON.stringify(BRIEF_VOLIKO))
      console.log("PERINGATAN: brief Voliko Print sudah ada dan berbeda dari data — DIBIARKAN (mungkin sudah disunting pembina).");

    // ── Rencana baris ──
    const idKonsepAda = new Map(konsepAda.map((k) => [k.kunci, k.id]));
    const idGrupAda = new Map(grupAda.map((g) => [g.nama, g.id]));
    const sudahAda = (b: (typeof BARIS_VOLIKO)[number]) => {
      const konsepId = idKonsepAda.get(b.konsep);
      if (konsepId == null) return false;
      const pesertaId = b.kode != null ? kodeKePeserta.get(b.kode)! : null;
      const grupId = b.grup != null ? (idGrupAda.get(b.grup) ?? -1) : null;
      return barisAda.some((x) => toYmd(x.tanggal) === b.tanggal && x.konsepId === konsepId && (pesertaId != null ? x.pesertaId === pesertaId : x.grupId === grupId));
    };
    const rencanaBaris = BARIS_VOLIKO.map((b) => ({ ...b, ada: sudahAda(b) }));
    const lainDiBulan = barisAda.length;

    // ── Cetak ──
    const panggilanKode = new Map<number, string>(ANAK_VOLIKO.map((a) => [a.kode, a.panggilan]));
    const labelKonsepData = new Map<string, string>(KONSEP_VOLIKO.map((k) => [k.kunci, labelKonsep(k)]));
    console.log(`\n== Konsep ==`);
    for (const k of KONSEP_VOLIKO) console.log(`  ${konsepBaru.includes(k) ? "+ BUAT " : "= ADA  "} ${k.kunci.padEnd(8)} ${labelKonsep(k).padEnd(24)} warna ${k.warna.padEnd(8)} ref ${k.referensi[0].url}`);
    console.log(`\n== Status ==`);
    for (const s of STATUS_WAJIB) console.log(`  ${statusBaru.includes(s) ? "+ BUAT " : "= ADA  "} ${s.kunci.padEnd(11)} "${s.nama}"${s.anakBoleh ? " · anak boleh" : ""}${s.final ? " · FINAL (pembina)" : ""}`);
    console.log(`\n== Kode anak ==`);
    for (const a of ANAK_VOLIKO) console.log(`  kode ${a.kode} = peserta ${a.pesertaId} ${a.panggilan.padEnd(8)} ${pasangKode.some((x) => x.pesertaId === a.pesertaId) ? "+ pasang" : "= sudah"}`);
    console.log(`\n== Grup (urutan giliran hari grup) ==`);
    for (const g of GRUP_VOLIKO)
      console.log(`  ${grupBaru.includes(g) ? "+ BUAT " : "= ADA  "} ${g.nama} (urutan ${g.urutan}): ${g.anggota.map((k) => `${k} ${panggilanKode.get(k)}`).join(", ")}`);
    for (const t of anggotaTambah) console.log(`    + anggota ${t.grup}: peserta ${t.pesertaId}`);
    console.log(`\n== Brief ${platform.nama} ==  ${tulisBrief ? "+ TULIS" : "= dibiarkan"} (drive "${BRIEF_VOLIKO.drive[0].label}" TANPA URL — isi di Jadwal Konten → Catatan & brief)`);

    console.log(`\n== Jadwal November 2026 — ${platform.nama} (${rencanaBaris.length} baris; baris platform ini bulan ini di DB: ${lainDiBulan}) ==`);
    console.log("  NO  TANGGAL                       KLASIFIKASI KONSEP         CODE    NAMA PKL              STATUS      AKSI");
    let no = 0;
    let mingguLalu = "";
    for (const b of rencanaBaris) {
      const minggu = b.tanggal;
      // Pemisah Minggu seperti sheet.
      const sebelumnya = new Date(`${minggu}T00:00:00Z`);
      sebelumnya.setUTCDate(sebelumnya.getUTCDate() - hariKe(minggu));
      const ymdMinggu = sebelumnya.toISOString().slice(0, 10);
      if (ymdMinggu !== mingguLalu) {
        console.log(`  ---- ${namaTanggal(ymdMinggu)} ----`);
        mingguLalu = ymdMinggu;
      }
      no++;
      const code = b.grup ?? String(b.kode);
      const nama = b.grup ? GRUP_VOLIKO.find((g) => g.nama === b.grup)!.anggota.map((k) => panggilanKode.get(k)).join(", ") : panggilanKode.get(b.kode!)!;
      console.log(
        `  ${String(no).padStart(2)}  ${namaTanggal(b.tanggal).padEnd(28)}  ${labelKonsepData.get(b.konsep)!.padEnd(25)}  ${code.padEnd(6)}  ${nama.padEnd(20)}  Belum take  ${b.ada ? "= ada" : "+ buat"}${b.usulan ? " · USULAN" : ""}`
      );
    }
    const dibuat = rencanaBaris.filter((b) => !b.ada).length;
    console.log(`\n  Akan dibuat: ${dibuat} baris · sudah ada (dilewati): ${rencanaBaris.length - dibuat}`);
    console.log("  Giliran grup sesudah ini: GRUB C → GRUB A → GRUB B (hari grup berikutnya Sabtu 12 Desember 2026 = GRUB C).");

    if (!opsi.jalankan) {
      console.log(`\nDRY RUN selesai — tidak ada yang ditulis. Cadangan akan ditulis ke: ${opsi.cadangan}`);
      console.log("Ulangi dengan --jalankan untuk menerapkan.");
      return;
    }

    // ── Cadangan dulu; gagal = batal sebelum menyentuh DB ──
    try {
      mkdirSync(opsi.cadangan, { recursive: true });
      const isi: Record<string, unknown> = {
        MagangPeserta_kode: await db.magangPeserta.findMany({ select: { id: true, kodeKonten: true }, orderBy: { id: "asc" } }),
        MagangKontenKonsep: konsepAda,
        MagangKontenStatus: statusAda,
        MagangKontenGrup: grupAda,
        MagangKonten: await db.magangKonten.findMany({ orderBy: { id: "asc" } }),
        MagangKontenPlatform: await db.magangKontenPlatform.findMany({ orderBy: { id: "asc" } }),
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

    const hasil = await db.$transaction(
      async (tx) => {
        for (const s of statusBaru) await tx.magangKontenStatus.upsert({ where: { kunci: s.kunci }, update: {}, create: { ...s, aktif: true } });
        for (const k of KONSEP_VOLIKO)
          await tx.magangKontenKonsep.upsert({ where: { kunci: k.kunci }, update: {}, create: { ...k, referensi: k.referensi.map((r) => ({ ...r })), aktif: true } });
        for (const { pesertaId, kode } of pasangKode) {
          const r = await tx.magangPeserta.updateMany({ where: { id: pesertaId, kodeKonten: null }, data: { kodeKonten: kode } });
          if (r.count !== 1) throw new Batal(`Kode peserta ${pesertaId} berubah sejak rencana dibuat — jalankan ulang.`);
        }
        for (const g of GRUP_VOLIKO) {
          const ada = await tx.magangKontenGrup.findFirst({ where: { nama: g.nama }, select: { id: true } });
          const anggota = g.anggota.map((k) => kodeKePeserta.get(k)!);
          if (!ada) await tx.magangKontenGrup.create({ data: { nama: g.nama, warna: g.warna, urutan: g.urutan, aktif: true, anggota: { create: anggota.map((pesertaId) => ({ pesertaId })) } } });
          else await tx.magangKontenGrupAnggota.createMany({ data: anggota.map((pesertaId) => ({ grupId: ada.id, pesertaId })), skipDuplicates: true });
        }
        if (tulisBrief) await tx.magangKontenPlatform.updateMany({ where: { id: platform.id, brief: { equals: Prisma.DbNull } }, data: { brief: briefData } });

        const [konsep, grup, belumTake] = await Promise.all([
          tx.magangKontenKonsep.findMany({ select: { id: true, kunci: true } }),
          tx.magangKontenGrup.findMany({ select: { id: true, nama: true } }),
          tx.magangKontenStatus.findUniqueOrThrow({ where: { kunci: "belum-take" }, select: { id: true } }),
        ]);
        const idKonsep = new Map(konsep.map((k) => [k.kunci, k.id]));
        const idGrup = new Map(grup.map((g) => [g.nama, g.id]));
        let dibuat = 0;
        for (const b of BARIS_VOLIKO) {
          const konsepId = idKonsep.get(b.konsep)!;
          const pesertaId = b.kode != null ? kodeKePeserta.get(b.kode)! : null;
          const grupId = b.grup != null ? idGrup.get(b.grup)! : null;
          const tanggal = atMidnight(b.tanggal);
          const ada = await tx.magangKonten.findFirst({ where: { platformId: platform.id, tanggal, konsepId, ...(pesertaId != null ? { pesertaId } : { grupId }) }, select: { id: true } });
          if (ada) continue;
          const terakhir = await tx.magangKonten.findFirst({ where: { platformId: platform.id, tanggal }, orderBy: { urutan: "desc" }, select: { urutan: true } });
          await tx.magangKonten.create({
            data: { platformId: platform.id, tanggal, konsepId, pesertaId, grupId, statusId: belumTake.id, usulan: b.usulan, urutan: terakhir ? terakhir.urutan + 1 : 0 },
          });
          dibuat++;
        }
        return { dibuat };
      },
      { timeout: 60_000 }
    );

    console.log("\n== SELESAI ==");
    console.log(`  Status dibuat: ${statusBaru.length} · konsep dibuat: ${konsepBaru.length} · grup dibuat: ${grupBaru.length} · kode dipasang: ${pasangKode.length}`);
    console.log(`  Brief: ${tulisBrief ? "ditulis" : "dibiarkan"} · baris dibuat: ${hasil.dibuat}`);
    console.log(`  Cadangan: ${opsi.cadangan}`);
  } finally {
    await db.$disconnect();
  }
}

// Diimpor tes (cekDataStatis) → jangan jalan otomatis.
if (process.argv[1] && /voliko-jadwal-konten\.ts$/.test(process.argv[1])) {
  utama().catch((e: unknown) => {
    if (e instanceof Batal) console.error(`\nBATAL: ${e.message}`);
    else console.error("\nGAGAL:", e);
    process.exitCode = 1;
  });
}
