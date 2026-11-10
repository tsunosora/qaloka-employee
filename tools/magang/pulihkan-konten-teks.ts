/**
 * Pemulihan kolom teks Jadwal Konten yang terhapus oleh bug sunting-sebagian (fix/magang-konten-patch, 10 Nov 2026).
 *
 * Pakai (di server, folder app):
 *   TZ=Asia/Jakarta npx tsx tools/magang/pulihkan-konten-teks.ts --dari=<snapshot.json>            # DRY RUN
 *   TZ=Asia/Jakarta npx tsx tools/magang/pulihkan-konten-teks.ts --dari=<snapshot.json> --jalankan  # menulis
 *
 * <snapshot.json> = larik [{id, judul, ref, caption, linkFootage, linkEkspor, catatan, updatedAt}] — mis.
 * ~/cadangan/magang-konten-snapshot-20261110-171453/konten-kolom-teks.json (diambil 17.14 sebelum perbaikan; saat itu
 * 24 baris, semua kolom teks masih kosong — tak ada yang terkena). Untuk perubahan SESUDAH snapshot, nilai lama bisa
 * dicari di binlog MySQL (log_bin ON, ROW, FULL, simpan 30 hari) → tulis ulang menjadi JSON dengan bentuk yang sama.
 *
 * Aturan: HANYA mengisi kolom yang SEKARANG kosong (NULL/"") dan di snapshot berisi. Kolom yang sekarang berisi
 * tidak pernah ditimpa. Baris yang sudah dihapus dilewati. Cadangan JSON keadaan sekarang ditulis dulu; satu transaksi.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const KOLOM = ["judul", "ref", "caption", "linkFootage", "linkEkspor", "catatan"] as const;
type Kolom = (typeof KOLOM)[number];
type Baris = { id: number } & Partial<Record<Kolom, string | null>>;

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const jalankan = process.argv.includes("--jalankan");
const kosong = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

async function main() {
  const dari = arg("dari");
  if (!dari) throw new Error("Pakai --dari=<snapshot.json>");
  const snap: Baris[] = JSON.parse(readFileSync(dari, "utf8")) ?? [];
  const prisma = new PrismaClient();
  try {
    const kini = await prisma.magangKonten.findMany({ where: { id: { in: snap.map((s) => s.id) } } });
    const peta = new Map(kini.map((k) => [k.id, k]));
    const rencana: { id: number; data: Partial<Record<Kolom, string>> }[] = [];
    for (const s of snap) {
      const k = peta.get(s.id);
      if (!k) continue;
      const data: Partial<Record<Kolom, string>> = {};
      for (const c of KOLOM) if (kosong(k[c]) && !kosong(s[c])) data[c] = s[c] as string;
      if (Object.keys(data).length) rencana.push({ id: s.id, data });
    }
    console.log(`Mode: ${jalankan ? "MENJALANKAN" : "DRY RUN"} · snapshot ${snap.length} baris · ada di DB ${kini.length}`);
    for (const r of rencana) console.log(`  baris #${r.id}: isi ${Object.keys(r.data).join(", ")}`);
    console.log(`Akan dipulihkan: ${rencana.length} baris.`);
    if (!jalankan || rencana.length === 0) return;

    const dir = `${process.env.HOME}/cadangan/pulihkan-konten-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/konten-sebelum-pulih.json`, JSON.stringify(kini, null, 1));
    console.log(`Cadangan: ${dir}`);
    await prisma.$transaction(rencana.map((r) => prisma.magangKonten.update({ where: { id: r.id }, data: r.data })));
    console.log("SELESAI");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
