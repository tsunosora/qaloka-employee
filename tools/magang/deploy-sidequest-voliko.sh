#!/usr/bin/env bash
# Deploy Magang side quest + sekolah + rotasi rombongan (branch feat/magang-sidequest) ke Employee Voliko.
# JANGAN dijalankan tanpa kata "deploy" dari owner.
#
# Pakai (di server, dari mana saja):
#   bash deploy-sidequest-voliko.sh <SHA-target>
# SHA-target = commit teratas origin/feat/magang-sidequest yang sudah diperiksa (ditulis di laporan).
#
# Isi: ff-only f77dedb → <SHA-target>; migrasi baru 20261109000000_magang_sidequest_sekolah (hanya MENAMBAH
# 2 tabel + kolom nullable); build; restart pm2 `ratemystaff` saja (poller Fingerspot tidak disentuh).
# Data magang TIDAK diubah oleh skrip ini — pos prioritas & rotasi 16 Nov memakai skrip terpisah
# tools/magang/voliko-pos-prioritas.ts (dry-run dulu).
set -euo pipefail
TARGET="${1:?Pakai: bash deploy-sidequest-voliko.sh <SHA-target>}"
BASE=f77dedbc72f239011c58a0fbf79da16db749ea17
BRANCH=feat/magang-sidequest
cd ~/web/rate-my-staff
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "BATAL: HEAD bukan $BASE ($(git rev-parse --short HEAD))"; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "BATAL: ada perubahan terlacak"; exit 1; }

# ── Cadangan (DB lengkap + .env + storage) ──
D=~/cadangan/deploy-rms-$(date +%Y%m%d-%H%M%S)
mkdir -p "$D"; echo "$D" > /tmp/rms-sidequest-cadangan.txt
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
hitung() { echo "pos=$(q 'SELECT COUNT(*) FROM MagangPos') soal=$(q 'SELECT COUNT(*) FROM MagangSoal') peserta=$(q 'SELECT COUNT(*) FROM MagangPeserta') penugasan=$(q 'SELECT COUNT(*) FROM MagangPenugasan') tugas=$(q 'SELECT COUNT(*) FROM MagangTugas') jurnal=$(q 'SELECT COUNT(*) FROM MagangJurnal')"; }
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
echo "tabel baru: misi=$(q 'SELECT COUNT(*) FROM MagangMisi') kiriman=$(q 'SELECT COUNT(*) FROM MagangMisiKiriman')"
sleep 5
for u in /login /daftar-magang/tidak-ada; do echo "GET $u → $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3007$u")"; done
echo "status API misi tanpa login (harus 401/403): $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/magang/misi)"
echo "SELESAI $(date +%H:%M:%S) — cadangan $D. Langkah berikut (terpisah): bank misi awal (Magang → Side Quest → Pakai bank misi awal), lalu skrip pos prioritas DRY-RUN."
