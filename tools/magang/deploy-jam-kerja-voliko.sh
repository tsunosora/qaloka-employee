#!/usr/bin/env bash
# Deploy jam kerja khusus magang (branch feat/magang-jam-kerja) ke Employee Voliko.
# JANGAN dijalankan tanpa kata "deploy" dari owner.
#
# Pakai (di server, dari mana saja):
#   bash deploy-jam-kerja-voliko.sh <SHA-target>
#   bash deploy-jam-kerja-voliko.sh --jepret      # hanya cetak jepretan absensi karyawan biasa (tanpa deploy)
# SHA-target = commit teratas origin/feat/magang-jam-kerja yang sudah diperiksa (ditulis di laporan).
#
# Isi: ff-only 527372b → <SHA-target>; build; migrasi 20261115000000_magang_jam_kerja (HANYA menambah tabel
# MagangJamSekolah + 3 kolom NULL di MagangPeserta, tanpa data); restart pm2 `ratemystaff` saja (poller Fingerspot tidak
# disentuh). Penjaga jadwal konten tetap: kolom teks MagangKonten dipotret ke JSON sebelum & sesudah (kolom yang tadinya
# berisi lalu kosong → GAGAL, exit 2); semua baris konten harus punya platform sah (exit 3); hitungan per platform
# sebelum = sesudah. Jam baru harus KOSONG sesudah deploy (jam_sekolah=0 peserta_berjam=0; selain itu exit 4).
# Penjaga karyawan biasa: jumlah + checksum (id, employeeId, scanDate, lateMinutes) Attendance karyawan NON-magang
# (scanDate < hari ini — scan baru hari ini dari poller tidak ikut) sebelum = sesudah; beda → GAGAL, exit 5.
# Jam Voliko = langkah TERPISAH sesudahnya (lalu ulangi `--jepret`, harus sama):
#   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jam-kerja.ts            # dry-run, lalu --jalankan
set -euo pipefail
TARGET="${1:?Pakai: bash deploy-jam-kerja-voliko.sh <SHA-target> | --jepret}"
BASE=527372b58cf71fa2336af49813b9f4b339c35c45
BRANCH=feat/magang-jam-kerja
MIGRASI=20261115000000_magang_jam_kerja
cd ~/web/rate-my-staff
U=$(grep -oE '^DATABASE_URL="?[^"]+' .env | sed -E 's/^DATABASE_URL="?//')
mapfile -t K < <(node -e 'const u=new URL(process.argv[1]);console.log([decodeURIComponent(u.username),decodeURIComponent(u.password),u.hostname,u.port||3306,u.pathname.slice(1)].join("\n"))' "$U")
export MYSQL_PWD="${K[1]}"
q() { mysql -u "${K[0]}" -h "${K[2]}" -P "${K[3]}" -N -B "${K[4]}" -e "$1"; }
# Jepretan absensi karyawan BIASA (bukan peserta magang): jumlah + checksum baris sebelum hari ini.
biasa() { q "SELECT CONCAT('baris=', COUNT(*), ' checksum=', COALESCE(SUM(CRC32(CONCAT_WS('|', id, employeeId, DATE_FORMAT(scanDate, '%Y-%m-%d %H:%i:%s'), lateMinutes))), 0)) FROM Attendance WHERE scanDate < CURDATE() AND employeeId NOT IN (SELECT employeeId FROM MagangPeserta)"; }
if [ "$TARGET" = "--jepret" ]; then echo "absensi karyawan biasa: $(biasa)"; exit 0; fi
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "BATAL: HEAD bukan $BASE ($(git rev-parse --short HEAD))"; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "BATAL: ada perubahan terlacak"; exit 1; }

# ── Cadangan (DB lengkap + .env + storage) ──
D=~/cadangan/deploy-rms-$(date +%Y%m%d-%H%M%S)
mkdir -p "$D"; echo "$D" > /tmp/rms-jam-kerja-cadangan.txt
cp .env "$D/rms.env"; chmod 600 "$D/rms.env"
git rev-parse HEAD > "$D/commit-sebelum.txt"
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
# Jadwal harian (tetap), jam kerja magang (tabel/kolom baru) & hitungan konten per platform.
harian() { echo "pasangan=$(q 'SELECT COUNT(*) FROM MagangPasangan') pengecualian=$(q 'SELECT COUNT(*) FROM MagangHarianPengecualian')"; }
jam() { echo "jam_sekolah=$(q 'SELECT COUNT(*) FROM MagangJamSekolah') peserta_berjam=$(q 'SELECT COUNT(*) FROM MagangPeserta WHERE jamMasuk IS NOT NULL OR jamPulang IS NOT NULL OR toleransiMenit IS NOT NULL')"; }
platform() { q "SELECT GROUP_CONCAT(CONCAT(p.nama,'=',(SELECT COUNT(*) FROM MagangKonten k WHERE k.platformId=p.id)) ORDER BY p.urutan SEPARATOR ', ') FROM MagangKontenPlatform p"; }
SEBELUM=$(hitung); KONTEN_SEBELUM=$(konten); PLATFORM_SEBELUM=$(platform); HARIAN_SEBELUM=$(harian); BIASA_SEBELUM=$(biasa)
echo "data magang SEBELUM: $SEBELUM · MagangKonten*: $KONTEN_SEBELUM · per platform: $PLATFORM_SEBELUM · harian: $HARIAN_SEBELUM"
echo "absensi karyawan biasa SEBELUM: $BIASA_SEBELUM" | tee "$D/absensi-biasa-sebelum.txt"
q "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MagangJamSekolah'" | grep -qx 0 || { echo "BATAL: tabel MagangJamSekolah sudah ada sebelum migrasi"; exit 1; }
q "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MagangPeserta' AND COLUMN_NAME IN ('jamMasuk','jamPulang','toleransiMenit')" | grep -qx 0 || { echo "BATAL: kolom jam sudah ada di MagangPeserta sebelum migrasi"; exit 1; }
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
HARIAN=$(harian); echo "jadwal harian SESUDAH: $HARIAN"
[ "$HARIAN_SEBELUM" = "$HARIAN" ] || echo "PERINGATAN: hitungan jadwal harian berubah (sebelum: $HARIAN_SEBELUM)!"
# ── Jam kerja magang: tabel/kolom baru ada & KOSONG (jam Voliko = skrip terpisah sesudahnya) ──
JAM=$(jam); echo "jam kerja magang SESUDAH: $JAM (diharapkan jam_sekolah=0 peserta_berjam=0)"
# ── Platform: setiap baris jadwal harus punya platform; hitungan per platform ──
TANPA=$(q 'SELECT COUNT(*) FROM MagangKonten WHERE platformId IS NULL OR platformId NOT IN (SELECT id FROM MagangKontenPlatform)')
echo "per platform: $PLATFORM_SESUDAH"
if [ "$TANPA" != "0" ]; then echo "!!! GAGAL: $TANPA baris MagangKonten tanpa platform yang sah"; exit 3; fi
echo "semua baris MagangKonten punya platform"
sleep 5
for u in /login /me/tidak-ada /magang/sekolah /magang/peserta /magang/harian /attendance/report; do echo "GET $u → $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3007$u")"; done
echo "API tanpa login (harus 302/401/403): jam $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/magang/jam) · PUT jam sekolah $(curl -s -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:3007/api/magang/jam/sekolah) · PATCH jam peserta $(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -d '{"jamMasuk":"09:00"}' http://127.0.0.1:3007/api/magang/jam/peserta/1) · laporan absensi $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/attendance/report)"
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
if [ "$JAM" != "jam_sekolah=0 peserta_berjam=0" ]; then echo "!!! GAGAL: jam kerja magang tidak kosong sesudah deploy ($JAM)"; exit 4; fi
# ── Karyawan biasa: absensi tersimpan (sebelum hari ini) tidak boleh berubah ──
BIASA_SESUDAH=$(biasa)
echo "absensi karyawan biasa SESUDAH: $BIASA_SESUDAH" | tee "$D/absensi-biasa-sesudah.txt"
if [ "$BIASA_SEBELUM" != "$BIASA_SESUDAH" ]; then echo "!!! GAGAL: absensi karyawan biasa BERUBAH (sebelum: $BIASA_SEBELUM). Cadangan $D"; exit 5; fi
echo "SELESAI $(date +%H:%M:%S) — cadangan $D. Data magang, izin, MagangKonten*, per platform, jadwal harian & absensi karyawan biasa sama dengan SEBELUM; kolom teks konten utuh; jam magang kosong."
echo "Berikutnya (terpisah): TZ=Asia/Jakarta npx tsx tools/magang/voliko-jam-kerja.ts   # dry-run → --jalankan; lalu: bash $0 --jepret (harus = $BIASA_SESUDAH)"
