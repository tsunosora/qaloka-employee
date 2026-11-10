#!/usr/bin/env bash
# Deploy perbaikan PATCH parsial Jadwal Konten (branch fix/magang-konten-patch) ke Employee Voliko — perbaikan PATCH parsial; tanpa migrasi.
# JANGAN dijalankan tanpa kata "deploy" dari owner.
#
# Pakai (di server, dari mana saja):
#   bash deploy-fix-konten-patch-voliko.sh <SHA-target>
# SHA-target = commit teratas origin/fix/magang-konten-patch yang sudah diperiksa (ditulis di laporan).
#
# Isi: ff-only 469adf6 → <SHA-target>; TANPA migrasi (dibatalkan bila prisma/ berubah); build; restart pm2
# `ratemystaff` saja (poller Fingerspot tidak disentuh). Kolom teks MagangKonten (judul, ref, caption, linkFootage,
# linkEkspor, catatan) dipotret ke JSON sebelum & sesudah; kolom yang tadinya berisi lalu kosong → GAGAL (exit 2).
# Pemulihan kolom yang sudah terhapus oleh bug = langkah terpisah: tools/magang/pulihkan-konten-teks.ts.
set -euo pipefail
TARGET="${1:?Pakai: bash deploy-fix-konten-patch-voliko.sh <SHA-target>}"
BASE=469adf653a455287aaf283e5f845650321c864ff
BRANCH=fix/magang-konten-patch
cd ~/web/rate-my-staff
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "BATAL: HEAD bukan $BASE ($(git rev-parse --short HEAD))"; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "BATAL: ada perubahan terlacak"; exit 1; }

# ── Cadangan (DB lengkap + .env + storage) ──
D=~/cadangan/deploy-rms-$(date +%Y%m%d-%H%M%S)
mkdir -p "$D"; echo "$D" > /tmp/rms-fix-konten-patch-cadangan.txt
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
SEBELUM=$(hitung); KONTEN_SEBELUM=$(konten); echo "data magang SEBELUM: $SEBELUM · MagangKonten*: $KONTEN_SEBELUM"
echo "potret teks konten SEBELUM: $(potret "$D/konten-teks-sebelum.json") → $D/konten-teks-sebelum.json"

# ── Kode ──
git fetch -q origin "$BRANCH"
[ "$(git rev-parse FETCH_HEAD)" = "$(git rev-parse "$TARGET^{commit}")" ] || { echo "BATAL: origin/$BRANCH bukan $TARGET"; exit 1; }
git diff --quiet "$BASE" "$TARGET" -- prisma/ || { echo "BATAL: prisma/ berubah — skrip ini untuk rilis TANPA migrasi"; exit 1; }
git merge -q --ff-only "$TARGET"
echo "HEAD sekarang: $(git log -1 --oneline)"
if git diff --quiet "$BASE" HEAD -- package-lock.json package.json; then echo "==> lockfile sama, npm ci dilewati"; else echo "==> npm ci"; npm ci --include=dev; fi
echo "==> build"; npm run build
echo "==> pm2"; pm2 restart ratemystaff --update-env; pm2 save

# ── Periksa ──
SESUDAH=$(hitung); KONTEN_SESUDAH=$(konten); echo "data magang SESUDAH: $SESUDAH · MagangKonten*: $KONTEN_SESUDAH"
[ "$SEBELUM" = "$SESUDAH" ] || echo "PERINGATAN: hitungan data magang berubah!"
[ "$KONTEN_SEBELUM" = "$KONTEN_SESUDAH" ] || echo "PERINGATAN: hitungan MagangKonten* berubah (sebelum: $KONTEN_SEBELUM)!"
sleep 5
for u in /login /me/tidak-ada /magang/konten; do echo "GET $u → $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3007$u")"; done
echo "API tanpa login (harus 302/401/403): konten admin $(curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3007/api/magang/konten?bulan=2026-11') · PATCH baris $(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -d '{"statusId":1}' http://127.0.0.1:3007/api/magang/konten/1)"
echo "API portal tanpa sesi (harus 401/404): $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3007/api/public/portal/tidak-ada/magang/konten)"

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
echo "SELESAI $(date +%H:%M:%S) — cadangan $D. Data magang, izin & MagangKonten* harus sama dengan SEBELUM; kolom teks konten utuh."
