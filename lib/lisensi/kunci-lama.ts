/**
 * Kunci API integrasi LAMA (`HR_API_KEY` untuk panggilan MASUK dari Qaloka POS, `POSPRO_API_KEY`
 * untuk panggilan KELUAR ke POS) — MATI secara bawaan sejak peralihan ke tiket `qi1` selesai.
 *
 * Kenapa dimatikan, bukan sekadar "tiket didahulukan": selama pintu kunci hidup, satu kunci bersama
 * yang bocor (ia tersimpan polos di `.env` DUA aplikasi, dan `.env` ikut cadangan malam) cukup untuk
 * membaca ringkasan HR & tautan portal tiap karyawan — tanpa kedaluwarsa, tanpa ikatan ke usaha mana
 * pun. Tiket berumur 5 menit dan terikat ke kunci lisensi usaha ini.
 *
 * Nama env-nya SAMA dengan di repo POS, supaya jalan mundur di dua aplikasi cukup satu kalimat:
 * `QENDALI_INTEGRASI_KUNCI_LAMA=true` lalu restart — tanpa deploy. Nilai lain apa pun = mati.
 */
export function kunciLamaDiizinkan(): boolean {
  return process.env.QENDALI_INTEGRASI_KUNCI_LAMA === "true";
}
