/**
 * Aturan penilaian mingguan anak magang. MURNI — tests/magang-nilai.test.ts.
 *
 * Tiap akhir minggu anak mengisi "tugas mengingat" di halaman pribadinya:
 *  1. Ingatan — menulis sendiri apa yang dipelajari minggu ini (tanpa contekan). Menulis dari
 *     ingatan (free recall) lebih melekat daripada sekadar memilih jawaban.
 *  2. Kuis — maksimal 5 soal pilihan ganda dari bank soal pos yang sedang dipegang; dinilai otomatis.
 * Pembimbing lalu memberi nilai praktik (rubrik 1–4) + nilai isi ingatan (1–4) + catatan.
 */

import { tambahHari } from "./rotasi";

export const JUMLAH_SOAL = 5;
export const MIN_INGATAN = 80; // karakter — cukup untuk 2–3 kalimat yang sungguh-sungguh
export const MAKS_INGATAN = 4000;

/** Rubrik praktik dari pembimbing. Kuncinya juga nama kolom di tabel MagangTugas. */
export const ASPEK_PRAKTIK = [
  { key: "ketelitian", label: "Ketelitian", bantu: "Hasil kerja rapi, jarang salah, mengecek ulang" },
  { key: "kecepatan", label: "Kecepatan", bantu: "Pekerjaan selesai dalam waktu wajar" },
  { key: "inisiatif", label: "Inisiatif", bantu: "Bertanya, mencoba sendiri, membantu tanpa disuruh" },
  { key: "sikap", label: "Disiplin & sikap", bantu: "Datang tepat waktu, sopan, menjaga alat & tempat kerja" },
] as const;
export type AspekKey = (typeof ASPEK_PRAKTIK)[number]["key"];

export const SKALA = [
  { nilai: 1, label: "Belum bisa" },
  { nilai: 2, label: "Masih dibantu" },
  { nilai: 3, label: "Bisa sendiri" },
  { nilai: 4, label: "Bisa & mengajari" },
] as const;

/** Bobot nilai minggu (0–100). Tanpa kuis (pos belum punya soal), bobot kuis pindah ke ingatan. */
export const BOBOT = { kuis: 0.3, ingatan: 0.2, praktik: 0.5 } as const;

export type SoalBank = { id: number; pertanyaan: string; pilihan: string[]; benar: number };
export type SoalTampil = { id: number; pertanyaan: string; pilihan: string[] };
/** Salinan soal yang DIKERJAKAN — disimpan supaya riwayat tidak berubah bila bank soal disunting. */
export type JawabanKuis = { soalId: number; pertanyaan: string; pilihan: string[]; benar: number; dipilih: number | null };

/** Pengacak bertenaga benih (mulberry32) — soal yang sama untuk anak & minggu yang sama, tiap kali dibuka. */
function acak(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function benihDari(pesertaId: number, senin: string): number {
  let h = 2166136261 ^ pesertaId;
  for (const c of senin) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Soal minggu ini untuk satu anak: tetap (berbenih anak + Senin), jadi membuka ulang halaman tidak
 * mengganti soal, dan minggu ke-2 di pos yang sama mendapat susunan berbeda.
 */
export function pilihSoal<T extends { id: number }>(bank: readonly T[], pesertaId: number, senin: string, jumlah = JUMLAH_SOAL): T[] {
  const r = acak(benihDari(pesertaId, senin));
  const kocok = [...bank].sort((a, b) => a.id - b.id);
  for (let i = kocok.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [kocok[i], kocok[j]] = [kocok[j], kocok[i]];
  }
  return kocok.slice(0, jumlah);
}

/** Soal untuk dikirim ke HP anak — TANPA kunci jawaban. */
export function tanpaKunci(s: SoalBank): SoalTampil {
  return { id: s.id, pertanyaan: s.pertanyaan, pilihan: s.pilihan };
}

/** Cocokkan jawaban anak dengan soal yang memang diberikan minggu itu. Soal lain diabaikan. */
export function periksaKuis(diberikan: readonly SoalBank[], jawaban: Record<string, number | null | undefined>): {
  rincian: JawabanKuis[];
  skor: number | null;
} {
  if (diberikan.length === 0) return { rincian: [], skor: null };
  const rincian = diberikan.map((s) => {
    const d = jawaban[String(s.id)];
    const dipilih = typeof d === "number" && Number.isInteger(d) && d >= 0 && d < s.pilihan.length ? d : null;
    return { soalId: s.id, pertanyaan: s.pertanyaan, pilihan: s.pilihan, benar: s.benar, dipilih };
  });
  const betul = rincian.filter((r) => r.dipilih === r.benar).length;
  return { rincian, skor: Math.round((betul / rincian.length) * 100) };
}

function skala100(n: number): number {
  return ((n - 1) / 3) * 100; // 1 → 0, 4 → 100
}

/**
 * Nilai minggu 0–100. null bila pembimbing belum menilai (praktik/ingatan kosong) — nilai setengah
 * jadi tidak boleh tampil seolah-olah final.
 */
export function nilaiMinggu(t: {
  skorKuis: number | null;
  nilaiIngatan: number | null;
  praktik: Partial<Record<AspekKey, number | null>>;
}): number | null {
  const praktik = ASPEK_PRAKTIK.map((a) => t.praktik[a.key]).filter((n): n is number => typeof n === "number");
  if (t.nilaiIngatan == null || praktik.length < ASPEK_PRAKTIK.length) return null;
  const rataPraktik = skala100(praktik.reduce((s, n) => s + n, 0) / praktik.length);
  const ingatan = skala100(t.nilaiIngatan);
  const total =
    t.skorKuis == null
      ? (BOBOT.kuis + BOBOT.ingatan) * ingatan + BOBOT.praktik * rataPraktik
      : BOBOT.kuis * t.skorKuis + BOBOT.ingatan * ingatan + BOBOT.praktik * rataPraktik;
  return Math.round(total);
}

export function predikat(nilai: number | null): string {
  if (nilai == null) return "Belum dinilai";
  if (nilai >= 85) return "Sangat baik";
  if (nilai >= 70) return "Baik";
  if (nilai >= 55) return "Cukup";
  return "Perlu bimbingan";
}

/**
 * Jendela pengisian tugas minggu (Senin `senin`): dibuka JUMAT minggu itu, tepat waktu sampai
 * Senin berikutnya (anak yang libur Sabtu–Minggu masih bisa mengisi Senin pagi). Sesudah itu masih
 * boleh mengisi, tapi ditandai terlambat.
 */
export function jendelaTugas(senin: string): { buka: string; batas: string } {
  return { buka: tambahHari(senin, 4), batas: tambahHari(senin, 7) };
}

export function keadaanJendela(senin: string, hariIni: string): "belum" | "buka" | "terlambat" {
  const { buka, batas } = jendelaTugas(senin);
  if (hariIni < buka) return "belum";
  if (hariIni <= batas) return "buka";
  return "terlambat";
}
