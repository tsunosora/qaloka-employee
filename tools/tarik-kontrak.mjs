#!/usr/bin/env node
/**
 * Tarik `kontrak/lisensi.json` dari repo qendali (sumbernya) ke repo ini.
 * Disalin dari Qaloka POS (tools/tarik-kontrak.mjs) 11 Okt 2026 — produk di sini qendali_employee.
 *
 *   node tools/tarik-kontrak.mjs                 → salin, lalu laporkan apa yang berubah
 *   node tools/tarik-kontrak.mjs --periksa       → jangan salin; kode 1 kalau beda
 *   QENDALI_REPO=D:/lain/qendali node tools/...  → kalau repo qendali tidak bersebelahan
 *
 * Kontraknya DIBANGKITKAN di repo qendali (`npm run kontrak`) dari `data/paket.json`. Di sini dia
 * cuma salinan, dan sengaja ikut di-commit: tes kontrak harus bisa jalan di mesin yang tidak
 * punya repo sebelahnya — termasuk CI dan klon yang baru.
 *
 * Yang membuat langkah ini perlu ada sama sekali: dua repo memegang satu kesepakatan. Kalau
 * paket berubah di sana dan salinan di sini tidak ikut, tes di sini menguji dirinya terhadap
 * daftar fitur yang sudah tidak berlaku — dan LULUS. Lulus yang salah lebih berbahaya daripada
 * gagal, karena tidak ada yang melihat.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TUJUAN = join(AKAR, 'kontrak', 'lisensi.json');

const repoQaloka = process.env.QENDALI_REPO
    ? resolve(process.env.QENDALI_REPO)
    // Folder situs bernama qaloka sejak 1 Nov 2026; folder lama qendali tetap dikenali.
    : [resolve(AKAR, '..', 'qaloka'), resolve(AKAR, '..', 'qendali')].find((d) => existsSync(join(d, 'kontrak', 'lisensi.json'))) ?? resolve(AKAR, '..', 'qaloka');
const SUMBER = join(repoQaloka, 'kontrak', 'lisensi.json');

const periksaSaja = process.argv.includes('--periksa');

if (!existsSync(SUMBER)) {
    console.error(`Tidak ketemu: ${SUMBER}`);
    console.error('Setel QENDALI_REPO ke folder repo situs Qaloka, dan pastikan `npm run kontrak` sudah dijalankan di sana.');
    process.exit(2);
}

const baru = readFileSync(SUMBER, 'utf8');
const lama = existsSync(TUJUAN) ? readFileSync(TUJUAN, 'utf8') : null;

// Akhiran baris dinormalkan dulu di KEDUA sisi. Repo situs dipakai di Windows dengan
// `core.autocrlf=true`, jadi tiap `git checkout`/`merge` menulis ulang kontraknya sebagai CRLF
// sementara pembangkitnya di sana selalu LF. Tanpa ini, `--periksa` melapor BEDA untuk kontrak
// yang isinya SAMA PERSIS — terukur 9 Okt 2026: 736 CR lawan 0, nol baris isi yang berbeda — dan
// obat yang disarankannya memang membuatnya hijau, jadi sebabnya tidak pernah ketahuan.
// Yang dijaga tetap isi kontraknya, bukan bita akhir barisnya.
const lf = (s) => (s === null ? null : s.replace(/\r\n/g, '\n'));

if (lf(lama) === lf(baru)) {
    console.log('kontrak sudah sama dengan sumbernya.');
    process.exit(0);
}

if (periksaSaja) {
    console.error('BEDA: kontrak/lisensi.json tidak sama dengan yang di repo qendali.');
    console.error('Jalankan: node tools/tarik-kontrak.mjs');
    process.exit(1);
}

mkdirSync(dirname(TUJUAN), { recursive: true });
copyFileSync(SUMBER, TUJUAN);
console.log(`${lama === null ? 'disalin' : 'diperbarui'}: kontrak/lisensi.json`);
console.log('Jalankan tesnya sekarang — selisih kesepakatan muncul di situ, bukan di sini:');
console.log('  npm test');
