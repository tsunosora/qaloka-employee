#!/usr/bin/env bash
# Deploy jadwal harian berpasangan (branch feat/magang-jadwal-harian) ke Employee Voliko.
# JANGAN dijalankan tanpa kata "deploy" dari owner.
#
# Pakai (di server, dari mana saja):
#   bash deploy-jadwal-harian-voliko.sh <SHA-target>
# SHA-target = commit teratas origin/feat/magang-jadwal-harian yang sudah diperiksa (ditulis di laporan).
#
# Isi: ff-only 5231969 → <SHA-target>; build; migrasi 20261114000000_magang_jadwal_harian (HANYA menambah tabel
# MagangPasangan + MagangHarianPengecualian, tanpa data); restart pm2 `ratemystaff` saja (poller Fingerspot tidak
# disentuh). Penjaga jadwal konten tetap: kolom teks MagangKonten dipotret ke JSON sebelum & sesudah (kolom yang tadinya
# berisi lalu kosong → GAGAL, exit 2); semua baris konten harus punya platform sah (exit 3); hitungan per platform
# sebelum = sesudah. Tabel baru harus KOSONG sesudah deploy (pasangan=0 pengecualian=0; selain itu exit 4).
# Pasangan Voliko = langkah TERPISAH sesudahnya:
#   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jadwal-harian.ts            # dry-run, lalu --jalankan
set -euo pipefail
TARGET="${1:?Pakai: bash deploy-jadwal-harian-voliko.sh <SHA-target>}"
BASE=52319695d2e556ca2e208890be429382f10ed11d
BRANCH=feat/magang-jadwal-harian
MIGRASI=20261114000000_magang_jadwal_harian
cd ~/web/rate-my-staff
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "BATAL: HEAD bukan $BASE ($(git rev-parse --short HEAD))"; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "BATAL: ada perubahan terlacak"; exit 1; }

# ── Cadangan (DB lengkap + .env + storage) ──
D=~/cadangan/deploy-rms-$(date +%Y%m%d-%H%M%S)
mkdir -p "$D"; echo "$D" > /tmp/rms-jadwal-harian-cadangan.txt
cp .env "$D/rms.env"; chmod 600 "$D/rms.env"
git rev-parse HEAD > "$D/commit-sebelum.txt"
U=$(grep -oE '^DATABASE_URL="?[^"]+' .env | sed -E 's/^DATABASE_URL="?//')
mapfile -t K < <(node -e 'const u=new URL(process.argv[1]);console.log([decodeURIComponent(u.username),decodeURIComponent(u.password),u.hostname,u.port||3306,u.pathname.slice(1)].join("\n"))' "$U")
export MYSQL_PWD="${K[1]}"
q() { mysql -u "${K[0]}" -h "${K[2]}" -P "${K[3]}" -N -B "${K[4]}" -e "$1"; }
mysqldump -u "${K[0]}" -h "${K[2]}" -P "${K[3]}" --single-transaction --no-tablespaces "${K[4]}" | gzip > "$D/rms.sql.gz"
[ -d storage ] && { tar -czf "$D/storage.tgz" storage; chmod 600 "$D/storage.tgz"; }
N=$(zcat "$D/rms.sql.gz" | grep -c "^CREATE TABLE")
[ "$N" -ge 20 ] || { echo "CADANGAN GAGAL: cuma $N tabel"; exit 1; }
echo "cadangan $D: $N tabel, $(du -h "$D/rms.sql.gz" | cut -f1)"
hitung() { echo "pos=$(q 'SELECT COUNT(*) FROM MagangPos') penugasan=$(q 'SELECT COUNT(*) FROM MagangPenugasan') tugas=$(q 'SELECT COUNT(*) FROM MagangTugas') jurnal=$(q 'SELECT COUNT(*) FROM MagangJurnal') misi=$(q 'SELECT COUNT(*) FROM MagangMisi') misi_kat=$(q 'SELECT GROUP_CONCAT(kategori,":",n ORDER BY kategori) FROM (SELECT kategori,COUNT(*) n FROM MagangMisi GROUP BY kategori) x') kiriman=$(q 'SELECT COUNT(*) FROM MagangMisiKiriman') izin=$(q 'SELECT COUNT(*) FROM LeaveRequest') peserta=$(q 'SELECT COUNT(*) FROM MagangPeserta')"; }
konten() { echo "konten=$(q 'SELECT COUNT(*) FROM MagangKonten') konsep=$(q 'SELECT COUNT(*) FROM MagangKontenKonsep') status=$(q 'SELECT COUNT(*) FROM MagangKontenStatus') grup=$(q 'SELECT COUNT(*) FROM MagangKontenGrup') anggota=$(q 'SELECT COUNT(*) FROM MagangKontenGrupAnggota') berkode=$(q 'SELECT COUNT(*) FROM MagangPeserta WHERE kodeKonten IS NOT NULL')"; }
# Potret kolom teks MagangKonten → JSON [{id, judul, ref, caption, linkFootage, linkEkspor, catatan, updatedAt}]
# (bentuk yang sama dengan masukan tools/magang/pulihkan-konten-teks.ts). --raw: teks tidak di-escape ulang oleh mysql.
potret() {
  mysql -u "${K[0]}" -h "${K[2]}" -P "${K[3]}" -N -B --raw "${K[4]}" -e "SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id',id,'judul',judul,'ref',ref,'caption',caption,'linkFootage',linkFootage,'linkEkspor',linkEkspor,'catatan',catatan,'updatedAt',updatedAt)),'[]') FROM MagangKonten" > "$1"
  node -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(!Array.isArray(a))throw new Error("bukan larik");console.log(a.length+" baris")' "$1"
}
# Jadwal harian (tabel baru) & hitungan konten per platform.
harian() { echo "pasangan=$(q 'SELECT COUNT(*) FROM MagangPasangan') pengecualian=$(q 'SELECT COUNT(*) FROM MagangHarianPengecualian')"; }
platform() { q "SELECT GROUP_CONCAT(CONCAT(p.nama,'=',(SELECT COUNT(*) FROM MagangKonten k WHERE k.platformId=p.id)) ORDER BY p.urutan SEPARATOR ', ') FROM MagangKontenPlatform p"; }
SEBELUM=$(hitung); KONTEN_SEBELUM=$(konten); PLATFORM_SEBELUM=$(platform)
echo "data magang SEBELUM: $SEBELUM · MagangKonten*: $KONTEN_SEBELUM · per platform: $PLATFORM_SEBELUM"
for T in MagangPasangan MagangHarianPengecualian; do
  q "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '$T'" | grep -qx 0 || { echo "BATAL: tabel $T sudah ada sebelum migrasi"; exit 1; }
done
echo "potret teks konten SEBELUM: $(potret "$D/konten-teks-sebelum.json") → $D/konten-teks-sebelum.json"

# ── Kode ──
git fetch -q origin "$BRANCH"
[ "$(git rev-parse FETCH_HEAD)" = "$(git rev-parse "$TARGET^{commit}")" ] || { echo "BATAL: origin/$BRANCH bukan $TARGET"; exit 1; }
# Satu-satunya migrasi baru yang boleh ikut = $MIGRASI (migrasi lama tidak boleh disunting).
BARU=$(git diff --name-only --diff-filter=AMDR "$BASE" "$TARGET" -- prisma/migrations | sort -u)
[ "$BARU" = "prisma/migrations/$MIGRASI/migration.sql" ] || { echo "BATAL: perubahan prisma/migrations tak terduga:"; echo "$BARU"; exit 1; }
git merge -q --ff-only "$TARGET"
echo "HEAD sekarang: $(git log -1 --oneline)"
if git diff --quiet "$BASE" HEAD -- package-lock.json package.json; then echo "==> lockfile sama, npm ci dilewati"; else echo "==> npm ci"; npm ci --include=dev; fi
# Build DULU (tidak menyentuh DB; gagal build = belum ada migrasi), lalu migrasi (hanya tabel baru), lalu restart.
echo "==> build"; npm run build
echo "==> migrasi ($MIGRASI)"; npm run db:deploy
echo "migrasi: $(q "SELECT CONCAT(migration_name, ' ', IFNULL(finished_at, 'BELUM SELESAI')) FROM _prisma_migrations WHERE migration_name = '$MIGRASI'")"
echo "==> pm2"; pm2 restart ratemystaff --update-env; pm2 save

# ── Periksa ──
SESUDAH=$(hitung); KONTEN_SESUDAH=$(konten); PLATFORM_SESUDAH=$(platform); echo "data magang SESUDAH: $SESUDAH · MagangKonten*: $KONTEN_SESUDAH"
[ "$SEBELUM" = "$SESUDAH" ] || echo "PERINGATAN: hitungan data magang berubah!"
[ "$KONTEN_SEBELUM" = "$KONTEN_SESUDAH" ] || echo "PERINGATAN: hitungan MagangKonten* berubah (sebelum: $KONTEN_SEBELUM)!"
[ "$PLATFORM_SEBELUM" = "$PLATFORM_SESUDAH" ] || echo "PERINGATAN: hitungan per platform berubah (sebelum: $PLATFORM_SEBELUM)!"
# ── Jadwal harian: tabel baru ada & KOSONG (pasangan Voliko = skrip terpisah sesudahnya) ──
HARIAN=$(harian); echo "jadwal harian SESUDAH: $HARIAN (diharapkan pasangan=0 pengecualian=0)"
# ── Platform: setiap baris jadwal harus punya platform; hitungan per platform ──
TANPA=$(q 'SELECT COUNT(*) FROM MagangKonten WHERE platformId IS NULL OR platformId NOT IN (SELECT id FROM MagangKontenPlatform)')
echo "per platform: $PLATFORM_SESUDAH"
if [ "$TANPA" != "0" ]; then echo "!!! GAGAL: $TANPA baris MagangKonten tanpa platform yang sah"; exit 3; fi
echo "semua baris MagangKonten punya platform"
sleep 5
for u in /login /me/tidak-ada /magang/konten /magang/harian "/magang/harian?minggu=2026-11-16"; do echo "GET $u → $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3007$u")"; done
echo "API tanpa login (harus 302/401/403): konten admin $(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3007/api/magang/konten?bulan=2026-11') · harian $(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3007/api/magang/harian?minggu=2026-11-16') · teks WA $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/magang/harian/teks) · POST pasangan $(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3007/api/magang/harian/pasangan) · PATCH baris konten $(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -d '{"statusId":1}' http://127.0.0.1:3007/api/magang/konten/1)"
echo "API portal tanpa sesi (harus 401/404): konten $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/public/portal/tidak-ada/magang/konten) · harian $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/public/portal/tidak-ada/magang/harian)"

echo "potret teks konten SESUDAH: $(potret "$D/konten-teks-sesudah.json") → $D/konten-teks-sesudah.json"
# Kolom teks yang SEBELUM berisi lalu SESUDAH kosong (NULL/"") → GAGAL KERAS. Baris yang hilang dilaporkan.
if ! node -e '
const fs = require("fs");
const baca = (f) => new Map(JSON.parse(fs.readFileSync(f, "utf8")).map((b) => [b.id, b]));
const [a, b] = [baca(process.argv[1]), baca(process.argv[2])];
const KOLOM = ["judul", "ref", "caption", "linkFootage", "linkEkspor", "catatan"];
const isi = (v) => v != null && String(v).trim() !== "";
const hilang = [], kosong = [];
for (const [id, lama] of a) {
  const baru = b.get(id);
  if (!baru) { hilang.push(id); continue; }
  for (const k of KOLOM) if (isi(lama[k]) && !isi(baru[k])) kosong.push(`#${id}.${k}`);
}
if (hilang.length) console.log(`PERINGATAN: ${hilang.length} baris konten hilang sesudah deploy: ${hilang.join(", ")}`);
if (kosong.length) { console.error(`GAGAL: ${kosong.length} kolom teks konten MENJADI KOSONG: ${kosong.join(", ")}`); process.exit(1); }
console.log(`kolom teks konten utuh (${a.size} baris sebelum, ${b.size} sesudah)`);
' "$D/konten-teks-sebelum.json" "$D/konten-teks-sesudah.json"; then
  echo "!!! GAGAL: ADA KOLOM TEKS KONTEN YANG TERHAPUS. Pulihkan dari $D/konten-teks-sebelum.json:"
  echo "!!!   TZ=Asia/Jakarta npx tsx tools/magang/pulihkan-konten-teks.ts --dari=$D/konten-teks-sebelum.json   # dry-run dulu"
  exit 2
fi
if [ "$HARIAN" != "pasangan=0 pengecualian=0" ]; then echo "!!! GAGAL: tabel jadwal harian tidak kosong sesudah deploy ($HARIAN)"; exit 4; fi
echo "SELESAI $(date +%H:%M:%S) — cadangan $D. Data magang, izin, MagangKonten* & per platform harus sama dengan SEBELUM; kolom teks konten utuh; jadwal harian kosong."
echo "Berikutnya (terpisah): TZ=Asia/Jakarta npx tsx tools/magang/voliko-jadwal-harian.ts   # dry-run → --jalankan"
