/**
 * Rekap harian tim oleh PIC lapangan — aturan MURNI (tanpa basis data), supaya tiap keputusan bisa
 * diuji. Dipakai layar HP PIC (/absen/[token] → "Absen tim") dan rute
 * /api/public/absen/[token]/tim/rekap.
 *
 * Keputusan owner (18 Okt 2026): satu orang satu baris per hari (Hadir / ½ Hari / Absen + lembur,
 * kota, divisi, proyek). Semua yang dicatat PIC MENUNGGU persetujuan owner/HR; baris yang sudah
 * disetujui lalu DIUBAH PIC kembali menunggu. Baris yang sudah DIBAYAR terkunci. PIC terakhir yang
 * menyimpan menang (sama dengan Qaloka Event). Upah hanya dihitung dari baris yang disetujui —
 * hitungannya bukan di sini (lib/services/upah).
 */

export const STATUS_REKAP = ["hadir", "setengah", "absen"] as const;
export type StatusRekap = (typeof STATUS_REKAP)[number];
export type Persetujuan = "menunggu" | "disetujui" | "ditolak";

/** PIC boleh mengisi hari ini dan paling jauh sekian hari ke belakang. Masa depan tidak. */
export const MUNDUR_MAKS_HARI = 7;
export const LEMBUR_MAKS_JAM = 15;
export const LEMBUR_LANGKAH = 0.5;
/** Notifikasi ke owner paling banyak sekali per tim per tanggal dalam jendela ini. */
export const JEDA_NOTIF_MENIT = 30;

export type Tolak = { ok: false; kode: string; alasan: string };

const dua = (n: number) => String(n).padStart(2, "0");
/** Date lokal → "YYYY-MM-DD" (sama dengan toYmd() di leave/service, disalin supaya berkas ini murni). */
export const ymd = (d: Date) => `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;

/**
 * Tanggal rekap dari kiriman HP. Hari LOKAL server (sama dengan atMidnight()). Tidak boleh masa
 * depan, tidak boleh lebih dari MUNDUR_MAKS_HARI ke belakang, dan harus tanggal sungguhan
 * ("2026-02-30" ditolak, bukan digeser ke Maret).
 */
export function periksaTanggal(teks: string | null | undefined, sekarang: Date): { ok: true; ymd: string; tanggal: Date } | Tolak {
  const t = String(teks ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const salah: Tolak = { ok: false, kode: "tanggal", alasan: "Tanggal tidak sah. Pilih tanggal dari kalender." };
  if (!m) return salah;
  const tanggal = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (ymd(tanggal) !== t) return salah;
  const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
  if (tanggal.getTime() > hariIni.getTime()) {
    return { ok: false, kode: "masa_depan", alasan: "Tanggal belum lewat. Rekap hanya untuk hari ini atau hari sebelumnya." };
  }
  const batas = new Date(hariIni);
  batas.setDate(batas.getDate() - MUNDUR_MAKS_HARI);
  if (tanggal.getTime() < batas.getTime()) {
    return { ok: false, kode: "terlalu_lama", alasan: `Rekap paling lama ${MUNDUR_MAKS_HARI} hari ke belakang. Untuk tanggal sebelumnya, minta admin.` };
  }
  return { ok: true, ymd: t, tanggal };
}

/** Rentang tanggal yang boleh dipilih di HP: { min, max } "YYYY-MM-DD". */
export function rentangTanggal(sekarang: Date): { min: string; max: string } {
  const max = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
  const min = new Date(max);
  min.setDate(min.getDate() - MUNDUR_MAKS_HARI);
  return { min: ymd(min), max: ymd(max) };
}

/** Jam lembur: angka 0..15, dibulatkan ke 0,5 jam terdekat. Kosong = 0. */
export function normalisasiLembur(v: unknown): { ok: true; jam: number } | Tolak {
  if (v === null || v === undefined || v === "") return { ok: true, jam: 0 };
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return { ok: false, kode: "lembur", alasan: "Jam lembur tidak sah." };
  const jam = Math.round(n / LEMBUR_LANGKAH) * LEMBUR_LANGKAH;
  if (jam > LEMBUR_MAKS_JAM) return { ok: false, kode: "lembur", alasan: `Lembur paling banyak ${LEMBUR_MAKS_JAM} jam sehari.` };
  return { ok: true, jam };
}

/** Pilihan jam lembur di HP: 0, 0,5, 1, … 15. */
export function pilihanLembur(): number[] {
  const hasil: number[] = [];
  for (let j = 0; j <= LEMBUR_MAKS_JAM; j += LEMBUR_LANGKAH) hasil.push(j);
  return hasil;
}

/** Teks bebas pendek (kota/divisi): spasi dirapatkan; kosong → null. */
export function teksPendek(v: unknown, maks = 100): string | null {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, maks) : null;
}

const kunci = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Isi baris yang dibandingkan untuk "berubah atau tidak". Foto & lokasi sengaja tidak ikut. */
export type IsiRekap = {
  status: StatusRekap;
  lemburJam: number;
  kota: string | null;
  divisi: string | null;
  proyekId: number | null;
};

/** Berubah? Kota/divisi dibandingkan tanpa beda huruf besar & spasi; lembur per 0,5 jam. */
export function isiBerubah(lama: IsiRekap, baru: IsiRekap): boolean {
  return (
    lama.status !== baru.status ||
    Math.round(lama.lemburJam * 2) !== Math.round(baru.lemburJam * 2) ||
    kunci(lama.kota) !== kunci(baru.kota) ||
    kunci(lama.divisi) !== kunci(baru.divisi) ||
    (lama.proyekId ?? null) !== (baru.proyekId ?? null)
  );
}

export type BarisLama = IsiRekap & { id: number; persetujuan: string; pembayaranId: number | null };

/**
 * Apa yang terjadi pada satu baris saat PIC menyimpan:
 * - "buat"    — belum ada baris → baris baru, MENUNGGU.
 * - "ubah"    — ada & berubah → isinya diganti dan persetujuan kembali MENUNGGU (keputusan
 *               lama dibuang — owner harus melihat isi barunya).
 * - "tetap"   — ada & tidak berubah → tidak disentuh sama sekali (persetujuan tetap).
 * - "terkunci"— sudah dibayar → tidak boleh diubah oleh siapa pun.
 */
export function putuskanBaris(lama: BarisLama | null, baru: IsiRekap): "buat" | "ubah" | "tetap" | "terkunci" {
  if (!lama) return "buat";
  if (lama.pembayaranId !== null) return "terkunci";
  return isiBerubah(lama, baru) ? "ubah" : "tetap";
}

/**
 * Setiap orang di kiriman WAJIB anggota tim PIC ini (Employee.timId = tim), aktif, belum dihapus.
 * Tanpa pemeriksaan ini PIC bisa merekap siapa pun dengan menebak id — celah yang ada di Qaloka
 * Event, sengaja tidak ditiru. Mengembalikan id yang DITOLAK (kosong = semua sah).
 */
export function bukanAnggota(
  timId: number,
  idDikirim: readonly number[],
  karyawan: readonly { id: number; timId: number | null; isActive: boolean; deletedAt: Date | null }[],
): number[] {
  const sah = new Set(karyawan.filter((k) => k.timId === timId && k.isActive && !k.deletedAt).map((k) => k.id));
  return [...new Set(idDikirim)].filter((id) => !sah.has(id));
}

/** Satu baris kiriman HP, sesudah dibersihkan. */
export type KirimanBaris = IsiRekap & { employeeId: number };

/**
 * Bersihkan daftar baris dari HP: status wajib salah satu dari tiga, lembur dinormalkan, id
 * karyawan dobel ditolak (satu orang satu baris sehari). Proyek: id bulat positif atau null.
 */
export function bersihkanKiriman(mentah: unknown): { ok: true; baris: KirimanBaris[] } | Tolak {
  if (!Array.isArray(mentah)) return { ok: false, kode: "kiriman", alasan: "Kiriman tidak terbaca. Coba lagi." };
  if (mentah.length === 0) return { ok: false, kode: "kosong", alasan: "Belum ada yang diisi. Pilih Hadir, ½ Hari, atau Absen untuk tiap orang." };
  if (mentah.length > 500) return { ok: false, kode: "kiriman", alasan: "Terlalu banyak baris sekaligus." };
  const lihat = new Set<number>();
  const baris: KirimanBaris[] = [];
  for (const r of mentah as Record<string, unknown>[]) {
    const employeeId = Number(r?.employeeId);
    if (!Number.isInteger(employeeId) || employeeId <= 0) return { ok: false, kode: "kiriman", alasan: "Kiriman tidak terbaca. Coba lagi." };
    if (lihat.has(employeeId)) return { ok: false, kode: "dobel", alasan: "Satu orang tercatat dua kali. Muat ulang lalu coba lagi." };
    lihat.add(employeeId);
    const status = String(r?.status ?? "");
    if (!(STATUS_REKAP as readonly string[]).includes(status)) {
      return { ok: false, kode: "status", alasan: "Pilih Hadir, ½ Hari, atau Absen untuk tiap orang yang diisi." };
    }
    const lembur = normalisasiLembur(r?.lemburJam);
    if (!lembur.ok) return lembur;
    const p = r?.proyekId;
    const proyekId = p === null || p === undefined || p === "" ? null : Number(p);
    if (proyekId !== null && (!Number.isInteger(proyekId) || proyekId <= 0)) {
      return { ok: false, kode: "proyek", alasan: "Proyek tidak dikenali. Muat ulang lalu pilih lagi." };
    }
    baris.push({
      employeeId,
      status: status as StatusRekap,
      lemburJam: lembur.jam,
      kota: teksPendek(r?.kota),
      divisi: teksPendek(r?.divisi),
      proyekId,
    });
  }
  return { ok: true, baris };
}

/**
 * Pilihan kota & divisi di HP: nilai unik (tanpa beda huruf besar) dari tarif kota×divisi yang
 * aktif + bawaan karyawan tim + nilai yang sudah tersimpan di baris hari itu — supaya nilai lama
 * tetap terlihat walau tarifnya sudah dinonaktifkan. Diurutkan abjad.
 */
export function pilihanUnik(...sumber: readonly (readonly (string | null | undefined)[])[]): string[] {
  const peta = new Map<string, string>();
  for (const daftar of sumber) {
    for (const v of daftar) {
      const t = teksPendek(v);
      if (t && !peta.has(kunci(t))) peta.set(kunci(t), t);
    }
  }
  return [...peta.values()].sort((a, b) => a.localeCompare(b, "id"));
}

/** Isi awal satu kartu di HP: dari baris tersimpan kalau ada, kalau tidak dari bawaan karyawan. */
export function isiAwal(
  lama: (IsiRekap & { persetujuan?: string }) | null,
  karyawan: { kotaBawaan: string | null; divisiBawaan: string | null },
): { status: StatusRekap | null; lemburJam: number; kota: string | null; divisi: string | null; proyekId: number | null } {
  if (lama) return { status: lama.status, lemburJam: lama.lemburJam, kota: lama.kota, divisi: lama.divisi, proyekId: lama.proyekId };
  return { status: null, lemburJam: 0, kota: karyawan.kotaBawaan, divisi: karyawan.divisiBawaan, proyekId: null };
}

/** Boleh mengirim notifikasi rekap untuk tim + tanggal ini sekarang? */
export function bolehBeritahu(terakhir: Date | null, nowMs: number): boolean {
  return !terakhir || nowMs - terakhir.getTime() >= JEDA_NOTIF_MENIT * 60 * 1000;
}
