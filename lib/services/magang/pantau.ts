/**
 * Pantauan guru sekolah (11 Nov 2026) — aturan MURNI: token, sesi cookie, penahan tebakan PIN, cakupan
 * sekolah, hitungan kehadiran, dan serialisasi data yang BOLEH dilihat guru. Tanpa Prisma supaya bisa
 * diuji (tests/magang-pantau*.test.ts). Bagian ber-DB: ./pantau-db.ts.
 *
 * Guru TIDAK PERNAH menerima: nomor HP, publicToken, PIN/portalPin, kode karyawan/PIN mesin, gaji/upah,
 * poin, karyawan lain, catatan internal peserta, kontak guru sekolah lain, koordinat. Serializer di bawah
 * menyusun objek BARU dari medan yang diizinkan (bukan menyalin lalu membuang), jadi kolom baru di tabel
 * tidak ikut bocor diam-diam.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hariKerja, kerajinan } from "./jurnal";
import { kunciSekolah, sekolahSama } from "./sekolah";

export const PANTAU_COOKIE = "rms_pantau";
/** Umur sesi guru: 8 jam. */
export const PANTAU_TTL_MS = 8 * 60 * 60 * 1000;
export const PIN_PANTAU_MIN = 6;
export const PIN_PANTAU_MAKS = 8;
/** Pesan SAMA untuk token tak dikenal, dicabut, maupun kedaluwarsa — tidak membocorkan mana yang benar. */
export const PESAN_TAUTAN_TIDAK_BERLAKU = "Tautan tidak berlaku. Minta tautan baru ke admin.";

// ── Token ───────────────────────────────────────────────────────────────────────────────────────────

/** 32 bita acak → base64url (43 huruf). */
export function buatTokenPantau(): string {
  return randomBytes(32).toString("base64url");
}

/** Bentuk token yang mungkin sah (menyaring sampah sebelum menyentuh DB). */
export function bentukTokenSah(t: string | null | undefined): boolean {
  return typeof t === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(t);
}

/** PIN guru: 6–8 angka saja. Kembalikan pesan galat, atau null bila sah. */
export function periksaPinPantau(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return "PIN hanya boleh angka.";
  if (pin.length < PIN_PANTAU_MIN || pin.length > PIN_PANTAU_MAKS) return `PIN harus ${PIN_PANTAU_MIN}–${PIN_PANTAU_MAKS} angka.`;
  return null;
}

// ── Keberlakuan tautan ──────────────────────────────────────────────────────────────────────────────

export type TautanPantau = {
  id: number;
  token: string;
  pinHash: string;
  aktif: boolean;
  dicabutAt: Date | null;
  kedaluwarsa: Date | null;
  sekolahKunci: string;
};

/**
 * Tautan bisa dipakai: aktif, tidak dicabut, dan (bila ada) belum lewat tanggal kedaluwarsa. Kedaluwarsa
 * = tanggal TERAKHIR yang masih boleh (berlaku sampai akhir hari itu, waktu lokal). `hari` = "YYYY-MM-DD".
 */
export function tautanBerlaku(t: Pick<TautanPantau, "aktif" | "dicabutAt" | "kedaluwarsa">, hari: string): boolean {
  if (!t.aktif || t.dicabutAt) return false;
  if (t.kedaluwarsa && ymd(t.kedaluwarsa) < hari) return false;
  return true;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Sesi cookie ─────────────────────────────────────────────────────────────────────────────────────
// Isi: `pantauId.sidikToken.sidikPin.exp.tandaTangan` (HMAC-SHA256 AUTH_SECRET). Token & pinHash asli
// tidak pernah masuk cookie — hanya sidiknya. Ganti tautan (token baru) atau ubah PIN (pinHash baru)
// membuat sidiknya tidak cocok → sesi lama ditolak di permintaan berikutnya.

function hmac(input: string, key: string): string {
  return createHmac("sha256", key).update(input).digest("base64url");
}

function samaAman(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function sidikToken(token: string, key: string): string {
  return hmac(`pantau-token:${token}`, key).slice(0, 16);
}

export function sidikPin(pinHash: string, key: string): string {
  return hmac(`pantau-pin:${pinHash}`, key).slice(0, 16);
}

export function buatSesiPantau(
  t: Pick<TautanPantau, "id" | "token" | "pinHash">,
  key: string,
  now: number = Date.now(),
  ttl: number = PANTAU_TTL_MS
): string {
  const payload = `${t.id}.${sidikToken(t.token, key)}.${sidikPin(t.pinHash, key)}.${now + ttl}`;
  return `${payload}.${hmac(payload, key)}`;
}

/**
 * Sesi sah untuk tautan INI: tanda tangan benar, belum habis, id sama, sidik token & PIN cocok dengan
 * baris DB saat ini, dan tautannya masih berlaku. Satu saja gagal → null.
 */
export function sesiPantauSah(
  cookie: string | null | undefined,
  t: TautanPantau,
  key: string,
  now: number = Date.now(),
  hari: string = ymd(new Date(now))
): boolean {
  if (!cookie) return false;
  const bagian = cookie.split(".");
  if (bagian.length !== 5) return false;
  const [idRaw, fpToken, fpPin, expRaw, sig] = bagian;
  if (!samaAman(sig, hmac(`${idRaw}.${fpToken}.${fpPin}.${expRaw}`, key))) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return false;
  if (Number(idRaw) !== t.id) return false;
  if (!samaAman(fpToken, sidikToken(t.token, key))) return false;
  if (!samaAman(fpPin, sidikPin(t.pinHash, key))) return false;
  return tautanBerlaku(t, hari);
}

// ── Penahan tebakan PIN ─────────────────────────────────────────────────────────────────────────────

/**
 * Penahan di MEMORI proses (satu instalasi PM2 — sama dengan lib/rate-limit.ts; hilang saat restart):
 * - per token+IP: 5 PIN salah → dikunci 15 menit;
 * - per token (semua IP): 20 PIN salah → dikunci 15 menit (menahan penebak yang berganti IP).
 * PIN benar menghapus hitungan token+IP itu (bukan hitungan global — penebak tidak bisa "mereset" dengan
 * masuk memakai PIN benar dari perangkat lain).
 */
export class PenahanPin {
  private ember = new Map<string, { n: number; sampai: number }>();
  constructor(
    private maksPerIp = 5,
    private maksPerToken = 20,
    private jendelaMs = 15 * 60 * 1000
  ) {}

  private hitung(k: string, now: number): number {
    const e = this.ember.get(k);
    if (!e || now > e.sampai) return 0;
    return e.n;
  }

  private tambah(k: string, now: number) {
    const e = this.ember.get(k);
    if (!e || now > e.sampai) this.ember.set(k, { n: 1, sampai: now + this.jendelaMs });
    else e.n += 1;
  }

  boleh(token: string, ip: string, now: number = Date.now()): boolean {
    return this.hitung(`ip:${token}:${ip}`, now) < this.maksPerIp && this.hitung(`t:${token}`, now) < this.maksPerToken;
  }

  gagal(token: string, ip: string, now: number = Date.now()) {
    this.tambah(`ip:${token}:${ip}`, now);
    this.tambah(`t:${token}`, now);
    if (this.ember.size > 5000) for (const [k, e] of this.ember) if (now > e.sampai) this.ember.delete(k);
  }

  berhasil(token: string, ip: string) {
    this.ember.delete(`ip:${token}:${ip}`);
  }
}

// ── Cakupan sekolah ─────────────────────────────────────────────────────────────────────────────────

export type PesertaCakupan = { id: number; sekolah: string | null; employee: { deletedAt: Date | null } };

/** Anak milik sekolah tautan ini: nama sekolah sama (tanpa peduli huruf/spasi) DAN karyawannya tidak dihapus. */
export function milikSekolah(p: PesertaCakupan, kunci: string): boolean {
  return !!kunciSekolah(kunci) && sekolahSama(p.sekolah, kunci) && p.employee.deletedAt == null;
}

export function saringSekolah<T extends PesertaCakupan>(daftar: readonly T[], kunci: string): T[] {
  return daftar.filter((p) => milikSekolah(p, kunci));
}

/** Ambil satu anak berdasarkan id DI DALAM cakupan sekolah; anak sekolah lain = null (rute → 404). */
export function anakDalamCakupan<T extends PesertaCakupan>(daftar: readonly T[], kunci: string, id: number): T | null {
  return daftar.find((p) => p.id === id && milikSekolah(p, kunci)) ?? null;
}

// ── Rentang & kehadiran ─────────────────────────────────────────────────────────────────────────────

const POLA_YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Rentang dari query (?dari&sampai); kosong/tak sah → bawaan. dari > sampai → ditukar. */
export function rentangDariQuery(dari: string | null, sampai: string | null, bawaan: { dari: string; sampai: string }) {
  const d = dari && POLA_YMD.test(dari) ? dari : bawaan.dari;
  const s = sampai && POLA_YMD.test(sampai) ? sampai : bawaan.sampai;
  return d <= s ? { dari: d, sampai: s } : { dari: s, sampai: d };
}

/**
 * Hari kerja yang dihitung untuk satu anak: dari max(dari, mulai) s.d. min(sampai, hari ini, selesai),
 * Senin–Sabtu tanpa libur (tabel Holiday) — aturan yang sama dengan rapor & jurnal (jurnal.ts hariKerja).
 * Hari SEBELUM mulai magang tidak dihitung (lihat portal/awal-hitung.ts).
 */
export function hariKerjaAnak(
  r: { dari: string; sampai: string },
  masa: { mulai: string; selesai: string | null },
  hariIni: string,
  libur: ReadonlySet<string>
): string[] {
  const awal = r.dari > masa.mulai ? r.dari : masa.mulai;
  let akhir = r.sampai < hariIni ? r.sampai : hariIni;
  if (masa.selesai && masa.selesai < akhir) akhir = masa.selesai;
  return awal <= akhir ? hariKerja(awal, akhir, libur) : [];
}

export type Kehadiran = { hariKerja: number; hadir: number; izin: number; alpa: number; persen: number | null };

/**
 * hadir/izin = set tanggal "YYYY-MM-DD"; hanya tanggal yang termasuk hari kerja yang dihitung. `hariIni` (opsional):
 * hari ini yang BELUM ada absen/izin tidak dihitung — harinya belum selesai, belum tentu tidak hadir.
 */
export function hitungKehadiran(semua: readonly string[], hadir: ReadonlySet<string>, izin: ReadonlySet<string>, hariIni?: string): Kehadiran {
  const hari = hariIni ? semua.filter((t) => t !== hariIni || hadir.has(t) || izin.has(t)) : semua;
  let h = 0;
  let i = 0;
  for (const t of hari) {
    if (hadir.has(t)) h++;
    else if (izin.has(t)) i++;
  }
  return { hariKerja: hari.length, hadir: h, izin: i, alpa: hari.length - h - i, persen: hari.length ? Math.round((h / hari.length) * 100) : null };
}

/**
 * Kerajinan jurnal untuk guru: x dari y hari kerja (aturan rapor, jurnal.ts kerajinan). Hari ini yang belum diisi
 * tidak dihitung — anak masih boleh mengisinya sampai malam.
 */
export function kerajinanGuru(terisi: readonly string[], hari: readonly string[], hariIni: string) {
  const isi = new Set(terisi);
  const dihitung = hari.filter((t) => t !== hariIni || isi.has(t));
  return kerajinan(terisi, dihitung);
}

/** Status absensi untuk guru dari status baris laporan absensi (lib/services/attendance/report.ts). */
export type StatusHariGuru = "hadir" | "terlambat" | "izin" | "sakit" | "alpa" | "libur";
export function statusGuru(status: string, hariKerja: boolean): StatusHariGuru {
  if (status === "late") return "terlambat";
  if (status === "Sakit") return "sakit";
  if (status === "Izin" || status === "Cuti") return "izin";
  if (status === "holiday") return hariKerja ? "alpa" : "libur";
  if (status === "absent") return hariKerja ? "alpa" : "libur";
  return "hadir";
}

// ── Serialisasi untuk guru ──────────────────────────────────────────────────────────────────────────

/** Kunci yang TIDAK BOLEH muncul di JSON guru (diuji rekursif di tests/magang-pantau-serial.test.ts). */
export const KUNCI_TERLARANG = [
  "hp",
  "phone",
  "publicToken",
  "portalPin",
  "pin",
  "pinHash",
  "machinePin",
  "employeeCode",
  "salary",
  "upah",
  "upahHarian",
  "poin",
  "poinMaks",
  "lat",
  "lng",
  "latitude",
  "longitude",
  "catatan",
  "kontakGuru",
  "perangkat",
  "akurasiM",
  "ip",
  "token",
] as const;

/** Semua kunci objek (rekursif) yang terlarang. Kosong = aman. */
export function kunciBocor(nilai: unknown): string[] {
  const terlarang = new Set(KUNCI_TERLARANG.map((k) => k.toLowerCase()));
  const hasil = new Set<string>();
  const jalan = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(jalan);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (terlarang.has(k.toLowerCase())) hasil.add(k);
        jalan(x);
      }
    }
  };
  jalan(nilai);
  return [...hasil];
}

type EmployeeNama = { fullName: string; nickname: string | null };

export function namaAnak(e: EmployeeNama): string {
  return e.nickname?.trim() || e.fullName;
}

/** Kartu anak di daftar guru. */
export function serialAnakRingkas(a: {
  peserta: { id: number; jurusan: string | null; mulai: string; selesai: string | null; aktif: boolean; employee: EmployeeNama & { isActive?: boolean } };
  posIni: { nama: string; lokasi: string | null } | null;
  kehadiran: Kehadiran;
  jurnal: { terisi: number; dari: number };
  sideQuest: { selesai: number; total: number } | null;
}) {
  return {
    id: a.peserta.id,
    nama: namaAnak(a.peserta.employee),
    namaLengkap: a.peserta.employee.fullName,
    jurusan: a.peserta.jurusan,
    mulai: a.peserta.mulai,
    selesai: a.peserta.selesai,
    aktif: a.peserta.aktif && a.peserta.employee.isActive !== false,
    posIni: a.posIni ? { nama: a.posIni.nama, lokasi: a.posIni.lokasi } : null,
    kehadiran: { hariKerja: a.kehadiran.hariKerja, hadir: a.kehadiran.hadir, izin: a.kehadiran.izin, alpa: a.kehadiran.alpa, persen: a.kehadiran.persen },
    jurnal: { terisi: a.jurnal.terisi, dari: a.jurnal.dari },
    sideQuest: a.sideQuest ? { selesai: a.sideQuest.selesai, total: a.sideQuest.total } : null,
  };
}

export type ScanGuru = { jam: string; sumber: "HP" | "Mesin"; lokasi: string | null; jarakM: number | null; fotoUrl: string | null };

/** Satu scan untuk guru: jam + sumber; scan HP menyertakan NAMA lokasi + jarak + foto (tanpa koordinat). */
export function serialScan(
  s: { scanDate: Date; machineName: string | null },
  bukti: { id: number; jarakM: number; lokasi: { nama: string } | null; lat?: number; lng?: number } | null,
  urlFoto: (buktiId: number) => string
): ScanGuru {
  const hp = s.machineName === "hp";
  const jam = `${String(s.scanDate.getHours()).padStart(2, "0")}:${String(s.scanDate.getMinutes()).padStart(2, "0")}`;
  return {
    jam,
    sumber: hp ? "HP" : "Mesin",
    lokasi: hp && bukti ? bukti.lokasi?.nama ?? null : null,
    jarakM: hp && bukti ? bukti.jarakM : null,
    fotoUrl: hp && bukti ? urlFoto(bukti.id) : null,
  };
}

export function serialHariAbsen(d: {
  tanggal: string;
  masuk: string | null;
  pulang: string | null;
  status: StatusHariGuru;
  terlambatMenit: number;
  keterangan: string | null;
  scan: readonly ScanGuru[];
}) {
  return {
    tanggal: d.tanggal,
    masuk: d.masuk,
    pulang: d.pulang,
    status: d.status,
    terlambatMenit: d.terlambatMenit,
    keterangan: d.keterangan,
    scan: d.scan.map((s) => ({ jam: s.jam, sumber: s.sumber, lokasi: s.lokasi, jarakM: s.jarakM, fotoUrl: s.fotoUrl })),
  };
}

export function serialJurnalGuru(
  j: { id: number; tanggal: string; pos: string | null; kegiatan: string; kendala: string | null; komentar: string | null; dicek: boolean; jumlahFoto: number },
  urlFoto: (jurnalId: number, n: number) => string
) {
  return {
    id: j.id,
    tanggal: j.tanggal,
    pos: j.pos,
    kegiatan: j.kegiatan,
    kendala: j.kendala,
    komentarPembimbing: j.komentar,
    dicek: j.dicek,
    foto: Array.from({ length: j.jumlahFoto }, (_, n) => urlFoto(j.id, n)),
  };
}

export function serialIzinGuru(
  l: {
    id: number;
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: string;
    decisionNote: string | null;
    lampiran: readonly { id: number; nama: string; tipe: string }[];
  },
  tampilLampiran: boolean,
  urlLampiran: (izinId: number, lampiranId: number) => string
) {
  return {
    id: l.id,
    jenis: l.type,
    mulai: l.startDate,
    sampai: l.endDate,
    alasan: l.reason,
    status: l.status,
    keputusan: l.decisionNote,
    jumlahLampiran: l.lampiran.length,
    lampiran: tampilLampiran ? l.lampiran.map((x) => ({ id: x.id, nama: x.nama, tipe: x.tipe, url: urlLampiran(l.id, x.id) })) : [],
  };
}

export function serialTugasGuru(t: {
  senin: string;
  pos: string | null;
  dikirimAt: string;
  terlambat: boolean;
  nilai: number | null;
  predikat: string;
  catatanPembimbing: string | null;
  dinilaiAt: string | null;
}) {
  return {
    senin: t.senin,
    pos: t.pos,
    dikirim: t.dikirimAt.slice(0, 10),
    terlambat: t.terlambat,
    dinilai: !!t.dinilaiAt,
    nilai: t.nilai,
    predikat: t.predikat,
    catatanPembimbing: t.catatanPembimbing,
  };
}

/** Progres side quest TANPA poin. */
export function serialSideQuest(
  progres: { kategori: readonly { kategori: string; label: string; selesai: number; menunggu: number; total: number }[]; selesai: number; total: number } | null,
  disetujui: readonly { judul: string; kategoriLabel: string; tanggal: string | null }[]
) {
  return {
    selesai: progres?.selesai ?? 0,
    total: progres?.total ?? 0,
    kategori: (progres?.kategori ?? []).map((k) => ({ kunci: k.kategori, label: k.label, selesai: k.selesai, menunggu: k.menunggu, total: k.total })),
    disetujui: disetujui.map((d) => ({ judul: d.judul, kategori: d.kategoriLabel, tanggal: d.tanggal })),
  };
}

export function serialRaporRingkas(r: {
  nilaiAkhir: number | null;
  predikat: string;
  tugasDikirim: number;
  tugasTerlambat: number;
  mingguBerjalan: number;
  baris: readonly { nama: string; mulai: string; minggu: number; nilai: number | null; predikat: string; tugasDikirim: number }[];
}) {
  return {
    nilaiAkhir: r.nilaiAkhir,
    predikat: r.predikat,
    tugasDikirim: r.tugasDikirim,
    tugasTerlambat: r.tugasTerlambat,
    mingguBerjalan: r.mingguBerjalan,
    perPos: r.baris.map((b) => ({ pos: b.nama, mulai: b.mulai, minggu: b.minggu, nilai: b.nilai, predikat: b.predikat, tugasDikirim: b.tugasDikirim })),
  };
}

/** Bentuk tautan untuk dasbor admin — TANPA pinHash. Token penuh hanya untuk manajer (pemanggil = requireManager). */
export function serialTautanAdmin(t: {
  id: number;
  sekolahKunci: string;
  sekolahLabel: string;
  token: string;
  aktif: boolean;
  kedaluwarsa: Date | null;
  tampilLampiranIzin: boolean;
  terakhirDibukaAt: Date | null;
  dibukaKali: number;
  dicabutAt: Date | null;
  createdAt: Date;
}, hari: string) {
  return {
    id: t.id,
    sekolahKunci: t.sekolahKunci,
    sekolahLabel: t.sekolahLabel,
    token: t.token,
    aktif: t.aktif,
    berlaku: tautanBerlaku(t, hari),
    kedaluwarsa: t.kedaluwarsa ? ymd(t.kedaluwarsa) : null,
    tampilLampiranIzin: t.tampilLampiranIzin,
    terakhirDibukaAt: t.terakhirDibukaAt?.toISOString() ?? null,
    dibukaKali: t.dibukaKali,
    dicabutAt: t.dicabutAt?.toISOString() ?? null,
    dibuatAt: t.createdAt.toISOString(),
  };
}
