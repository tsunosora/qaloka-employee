#!/usr/bin/env bash
# Deploy jadwal konten magang (branch feat/magang-jadwal-konten) ke Employee Voliko.
# JANGAN dijalankan tanpa kata "deploy" dari owner.
#
# Pakai (di server, dari mana saja):
#   bash deploy-jadwal-konten-voliko.sh <SHA-target>
# SHA-target = commit teratas origin/feat/magang-jadwal-konten yang sudah diperiksa (ditulis di laporan).
#
# Isi: ff-only da81381 → <SHA-target>; migrasi 20261112000000_magang_jadwal_konten (5 tabel baru MagangKonten*,
# 1 kolom nullable unik MagangPeserta.kodeKonten, 4 status bawaan INSERT IGNORE — hanya menambah; data lama tidak
# diubah); build; restart pm2 `ratemystaff` saja (poller Fingerspot tidak disentuh).
#
# IMPOR DATA NOVEMBER = LANGKAH TERPISAH (tidak dijalankan skrip ini), sesudah deploy berhasil, di folder app:
#   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jadwal-konten.ts              # dry-run, periksa tabelnya
#   TZ=Asia/Jakarta npx tsx tools/magang/voliko-jadwal-konten.ts --jalankan   # cadangan JSON ~/cadangan/magang-konten-<waktu>
set -euo pipefail
TARGET="${1:?Pakai: bash deploy-jadwal-konten-voliko.sh <SHA-target>}"
BASE=da813817dc546d5f4c6a8e22d915c03b80167d7b
BRANCH=feat/magang-jadwal-konten
cd ~/web/rate-my-staff
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "BATAL: HEAD bukan $BASE ($(git rev-parse --short HEAD))"; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "BATAL: ada perubahan terlacak"; exit 1; }

# ── Cadangan (DB lengkap + .env + storage) ──
D=~/cadangan/deploy-rms-$(date +%Y%m%d-%H%M%S)
mkdir -p "$D"; echo "$D" > /tmp/rms-jadwal-konten-cadangan.txt
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
# Tabel MagangKonten* belum ada SEBELUM migrasi → dihitung terpisah (sesudah migrasi: status=4, lainnya 0).
ada_tabel() { q "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$1'" | grep -q 1; }
konten() { if ada_tabel MagangKonten; then echo "konten=$(q 'SELECT COUNT(*) FROM MagangKonten') konsep=$(q 'SELECT COUNT(*) FROM MagangKontenKonsep') status=$(q 'SELECT COUNT(*) FROM MagangKontenStatus') grup=$(q 'SELECT COUNT(*) FROM MagangKontenGrup') anggota=$(q 'SELECT COUNT(*) FROM MagangKontenGrupAnggota') berkode=$(q 'SELECT COUNT(*) FROM MagangPeserta WHERE kodeKonten IS NOT NULL')"; else echo "belum-ada"; fi; }
SEBELUM=$(hitung); echo "data magang SEBELUM: $SEBELUM · MagangKonten*: $(konten)"

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
SESUDAH=$(hitung); echo "data magang SESUDAH: $SESUDAH · MagangKonten*: $(konten) (harus konten=0 konsep=0 status=4 grup=0 anggota=0 berkode=0)"
[ "$SEBELUM" = "$SESUDAH" ] || echo "PERINGATAN: hitungan data magang berubah!"
echo "migrasi magang:"; q "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%magang%' ORDER BY migration_name"
sleep 5
for u in /login /me/tidak-ada /magang/konten; do echo "GET $u → $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3007$u")"; done
echo "API tanpa login (harus 302/401/403): konten admin $(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3007/api/magang/konten?bulan=2026-11')"
echo "API portal tanpa sesi (harus 401/404): $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/public/portal/tidak-ada/magang/konten)"
echo "SELESAI $(date +%H:%M:%S) — cadangan $D. Data magang & izin harus sama dengan SEBELUM. Lanjut: impor data November (dry-run dulu, lihat kepala skrip)."
