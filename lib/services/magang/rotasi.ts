/**
 * Penyusun rotasi pos kerja anak magang. MURNI (tanpa DB) supaya bisa diuji — tests/magang-rotasi.test.ts.
 *
 * Aturan (keputusan owner 6 Nov 2026):
 * - Tiap anak harus kebagian SEMUA pos sebelum mengulang pos yang sama.
 * - Lama per pos ikut posnya: pos berat 2 minggu (minggu 1 didampingi, minggu 2 mandiri),
 *   pos ringan 1 minggu.
 * - Satu pos idealnya dipegang satu anak (`kapasitas`). Kalau semua pos yang belum dia pegang sedang
 *   penuh, anak tetap ditaruh di pos yang paling sedikit isinya dan ditandai `berbagi` —
 *   anak tidak pernah dibiarkan tanpa pos.
 * - Anak yang masuk di tengah jalan ikut disusun mulai minggu masuknya.
 *
 * Satuan waktu = MINGGU yang dimulai Senin, ditulis "YYYY-MM-DD" (tanggal Seninnya).
 */

export type PosRotasi = { id: number; durasiMinggu: number; kapasitas?: number };

export type PesertaRotasi = {
  id: number;
  /** Senin minggu pertama anak ini. */
  mulai: string;
  /** Hari terakhir magang (boleh bukan Senin). null = belum ditentukan. */
  selesai: string | null;
};

/** Penugasan yang sudah ada & dipertahankan (riwayat, atau yang sedang berjalan saat disusun ulang). */
export type PenugasanAda = { pesertaId: number; posId: number; mulai: string; minggu: number };

export type PenugasanBaru = PenugasanAda & { berbagi: boolean };

/** Bila tanggal selesai kosong, susun sejauh ini dari minggu mulai disusun. */
export const MINGGU_BAWAAN = 13;
/** Batas keras supaya data rusak (tanggal tahun 2099) tidak membuat ribuan baris. */
export const MAKS_MINGGU = 60;

const HARI_MS = 86_400_000;

/** "YYYY-MM-DD" → hari ke-n sejak epoch (UTC, bebas zona waktu). */
function keHari(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / HARI_MS);
}

function dariHari(n: number): string {
  const t = new Date(n * HARI_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** Senin dari minggu yang memuat tanggal ini. */
export function seninDari(ymd: string): string {
  const n = keHari(ymd);
  // 1970-01-01 = Kamis → (n + 3) % 7 = 0 untuk Senin.
  const geser = (((n + 3) % 7) + 7) % 7;
  return dariHari(n - geser);
}

export function tambahMinggu(senin: string, k: number): string {
  return dariHari(keHari(senin) + 7 * k);
}

/** Selisih minggu dua Senin (b − a). */
export function selisihMinggu(a: string, b: string): number {
  return Math.round((keHari(b) - keHari(a)) / 7);
}

export function tambahHari(ymd: string, k: number): string {
  return dariHari(keHari(ymd) + k);
}

/** Senin terakhir yang masih dalam masa magang (minggu yang memuat tanggal selesai). */
function seninTerakhir(p: PesertaRotasi, dari: string): string {
  if (p.selesai) return seninDari(p.selesai);
  return tambahMinggu(seninDari(p.mulai) > dari ? seninDari(p.mulai) : dari, MINGGU_BAWAAN - 1);
}

/**
 * Susun penugasan mulai minggu `dari` (Senin). `ada` = penugasan yang dipertahankan (yang mulai
 * sebelum `dari`): dipakai untuk tahu pos mana yang sudah dipegang tiap anak dan pos mana yang masih
 * terisi di minggu-minggu awal. Hasilnya HANYA penugasan baru (mulai ≥ dari).
 */
export function susunRotasi(input: {
  pos: readonly PosRotasi[];
  peserta: readonly PesertaRotasi[];
  ada: readonly PenugasanAda[];
  dari: string;
}): PenugasanBaru[] {
  const dari = seninDari(input.dari);
  const pos = input.pos.filter((p) => p.durasiMinggu >= 1);
  if (pos.length === 0 || input.peserta.length === 0) return [];

  // isi[minggu][posId] = jumlah anak di pos itu pada minggu itu
  const isi = new Map<string, Map<number, number>>();
  const tambahIsi = (senin: string, posId: number) => {
    const m = isi.get(senin) ?? new Map<number, number>();
    m.set(posId, (m.get(posId) ?? 0) + 1);
    isi.set(senin, m);
  };
  const isiPada = (senin: string, posId: number) => isi.get(senin)?.get(posId) ?? 0;

  // sibukSampai[pesertaId] = Senin pertama anak itu bebas lagi
  const sibukSampai = new Map<number, string>();
  const pernah = new Map<number, Map<number, number>>(); // pesertaId → posId → berapa kali

  for (const a of input.ada) {
    for (let k = 0; k < a.minggu; k++) tambahIsi(tambahMinggu(a.mulai, k), a.posId);
    const akhir = tambahMinggu(a.mulai, a.minggu);
    if (!sibukSampai.has(a.pesertaId) || sibukSampai.get(a.pesertaId)! < akhir) sibukSampai.set(a.pesertaId, akhir);
    const p = pernah.get(a.pesertaId) ?? new Map<number, number>();
    p.set(a.posId, (p.get(a.posId) ?? 0) + 1);
    pernah.set(a.pesertaId, p);
  }

  const peserta = [...input.peserta].sort((a, b) => a.id - b.id);
  const akhirSemua = peserta.reduce((maks, p) => {
    const t = seninTerakhir(p, dari);
    return t > maks ? t : maks;
  }, dari);
  const jumlahMinggu = Math.min(MAKS_MINGGU, selisihMinggu(dari, akhirSemua) + 1);

  const hasil: PenugasanBaru[] = [];
  for (let w = 0; w < jumlahMinggu; w++) {
    const senin = tambahMinggu(dari, w);
    peserta.forEach((p, urutan) => {
      if (seninDari(p.mulai) > senin) return; // belum masuk
      const terakhir = seninTerakhir(p, dari);
      if (senin > terakhir) return; // sudah selesai
      const bebas = sibukSampai.get(p.id);
      if (bebas && bebas > senin) return; // masih memegang pos

      const sisaMinggu = selisihMinggu(senin, terakhir) + 1;
      const riwayat = pernah.get(p.id) ?? new Map<number, number>();
      const putaran = Math.min(...pos.map((x) => riwayat.get(x.id) ?? 0));

      // Kandidat: pos yang paling jarang dipegang anak ini; di antara yang setara, mulai dari pos
      // "gilirannya" (indeks digeser urutan anak) supaya anak-anak tidak berebut pos yang sama.
      const kandidat = pos
        .map((x, i) => ({ x, kali: riwayat.get(x.id) ?? 0, giliran: (((i - urutan - putaran) % pos.length) + pos.length) % pos.length }))
        .filter((k) => k.kali === putaran)
        .sort((a, b) => a.giliran - b.giliran);

      const panjang = (x: PosRotasi) => Math.min(x.durasiMinggu, sisaMinggu);
      const muat = (x: PosRotasi) => {
        const kap = Math.max(1, x.kapasitas ?? 1);
        for (let k = 0; k < panjang(x); k++) if (isiPada(tambahMinggu(senin, k), x.id) >= kap) return false;
        return true;
      };
      const terisi = (x: PosRotasi) => {
        let maks = 0;
        for (let k = 0; k < panjang(x); k++) maks = Math.max(maks, isiPada(tambahMinggu(senin, k), x.id));
        return maks;
      };

      let pilih = kandidat.find((k) => muat(k.x))?.x;
      let berbagi = false;
      if (!pilih) {
        // Semua pos yang belum dipegang sedang penuh → taruh di yang paling longgar.
        pilih = [...kandidat].sort((a, b) => terisi(a.x) - terisi(b.x) || a.giliran - b.giliran)[0].x;
        berbagi = true;
      }

      const minggu = panjang(pilih);
      for (let k = 0; k < minggu; k++) tambahIsi(tambahMinggu(senin, k), pilih.id);
      sibukSampai.set(p.id, tambahMinggu(senin, minggu));
      riwayat.set(pilih.id, (riwayat.get(pilih.id) ?? 0) + 1);
      pernah.set(p.id, riwayat);
      hasil.push({ pesertaId: p.id, posId: pilih.id, mulai: senin, minggu, berbagi });
    });
  }
  return hasil;
}

/** Penugasan yang berlaku pada Senin tertentu. */
export function penugasanPada<T extends { mulai: string; minggu: number }>(daftar: readonly T[], senin: string): T | undefined {
  return daftar.find((a) => a.mulai <= senin && senin < tambahMinggu(a.mulai, a.minggu));
}

/** Minggu ke berapa (1-based) di dalam penugasannya, mis. "minggu 2 dari 2". */
export function mingguKe(a: { mulai: string }, senin: string): number {
  return selisihMinggu(a.mulai, senin) + 1;
}
