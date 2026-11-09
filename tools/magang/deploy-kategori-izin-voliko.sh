#!/usr/bin/env bash
# Deploy kategori side quest dinamis + lampiran izin (branch feat/magang-kategori-izin) ke Employee Voliko.
# JANGAN dijalankan tanpa kata "deploy" dari owner.
#
# Pakai (di server, dari mana saja):
#   bash deploy-kategori-izin-voliko.sh <SHA-target>
# SHA-target = commit teratas origin/feat/magang-kategori-izin yang sudah diperiksa (ditulis di laporan).
#
# Isi: ff-only 0a179c3 → <SHA-target>; migrasi 20261110000000_magang_misi_kategori (tabel kategori + 3 kategori
# lama via INSERT IGNORE + FK; data misi tidak berubah) dan 20261110010000_izin_lampiran (tabel baru); build;
# restart pm2 `ratemystaff` saja (poller Fingerspot tidak disentuh). Lampiran izin disimpan di storage/izin.
set -euo pipefail
TARGET="${1:?Pakai: bash deploy-kategori-izin-voliko.sh <SHA-target>}"
BASE=0a179c361dd0116ce457bfe60df4990bd8593011
BRANCH=feat/magang-kategori-izin
cd ~/web/rate-my-staff
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "BATAL: HEAD bukan $BASE ($(git rev-parse --short HEAD))"; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "BATAL: ada perubahan terlacak"; exit 1; }

# ── Cadangan (DB lengkap + .env + storage) ──
D=~/cadangan/deploy-rms-$(date +%Y%m%d-%H%M%S)
mkdir -p "$D"; echo "$D" > /tmp/rms-kategori-izin-cadangan.txt
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
hitung() { echo "pos=$(q 'SELECT COUNT(*) FROM MagangPos') penugasan=$(q 'SELECT COUNT(*) FROM MagangPenugasan') tugas=$(q 'SELECT COUNT(*) FROM MagangTugas') jurnal=$(q 'SELECT COUNT(*) FROM MagangJurnal') misi=$(q 'SELECT COUNT(*) FROM MagangMisi') misi_kat=$(q 'SELECT GROUP_CONCAT(kategori,":",n ORDER BY kategori) FROM (SELECT kategori,COUNT(*) n FROM MagangMisi GROUP BY kategori) x') kiriman=$(q 'SELECT COUNT(*) FROM MagangMisiKiriman') izin=$(q 'SELECT COUNT(*) FROM LeaveRequest')"; }
SEBELUM=$(hitung); echo "data magang SEBELUM: $SEBELUM"

# ── Kode ──
git fetch -q origin "$BRANCH"
[ "$(git rev-parse FETCH_HEAD)" = "$(git rev-parse "$TARGET^{commit}")" ] || { echo "BATAL: origin/$BRANCH bukan $TARGET"; exit 1; }
git merge -q --ff-only "$TARGET"
echo "HEAD sekarang: $(git log -1 --oneline)"
if git diff --quiet "$BASE" HEAD -- package-lock.json package.json; then echo "==> lockfile sama, npm ci dilewati"; else echo "==> npm ci"; npm ci --include=dev; fi
echo "==> migrasi"; npm run db:deploy
echo "==> build"; npm run build
echo "==> pm2"; pm2 restart ratemystaff --update-env; pm2 save

# ── Periksa ──
SESUDAH=$(hitung); echo "data magang SESUDAH: $SESUDAH"
[ "$SEBELUM" = "$SESUDAH" ] || echo "PERINGATAN: hitungan data magang berubah!"
echo "migrasi magang:"; q "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%magang%' ORDER BY migration_name"
echo "kategori: $(q "SELECT GROUP_CONCAT(kunci,'=',nama,IF(aktif,'',' (nonaktif)') ORDER BY urutan SEPARATOR ' | ') FROM MagangMisiKategori")"
echo "lampiran izin: $(q 'SELECT COUNT(*) FROM LeaveLampiran') baris"
sleep 5
for u in /login /daftar-magang/tidak-ada /leave-requests; do echo "GET $u → $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3007$u")"; done
echo "API tanpa login (harus 302/401/403): kategori $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/magang/misi/kategori) · lampiran $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/leave-requests/1/lampiran/1)"
echo "SELESAI $(date +%H:%M:%S) — cadangan $D. Data magang & izin harus sama dengan SEBELUM (lihat atas)."
