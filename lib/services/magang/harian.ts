/**
 * Jadwal harian berpasangan (14 Nov 2026) — logika MURNI (tanpa DB), dipakai dasbor pembina, HP anak, pantau guru,
 * dan skrip data Voliko.
 *
 * Aturan:
 * - Pasangan 2 anak (atau 1 = "sendiri") mengerjakan KONTEN atau PRODUKSI, BERGANTIAN tiap hari kerja.
 * - Hari kerja = Senin–Sabtu yang bukan tanggal di tabel Holiday. Minggu & libur dilewati dan TIDAK membalik giliran.
 * - Patokan: tugas pasangan pada patokanTanggal. Tugas hari D = tugas patokan bila banyaknya hari kerja antara patokan
 *   dan D genap, selain itu tugas satunya (berlaku juga mundur sebelum patokan).
 * - Hanya dalam masa magang tiap anak (mulai..selesai) dan bila anak aktif; di luar itu → tidak ada tugas.
 * - Pengecualian per tanggal dari pembina (tingkat pasangan: ganti tugas / libur; tingkat anak: ganti pasangan hari itu
 *   (+ tugas opsional), ganti tugas, libur). Pengecualian TIDAK menggeser giliran hari-hari berikutnya — giliran selalu
 *   dihitung dari patokan.
 * - Pasangan yang anggotanya tinggal satu (rekan nonaktif / di luar masa / libur sendiri / dipinjam pasangan lain) →
 *   anak yang tersisa tetap mendapat tugas, ditandai "sendiri".
 */

export const TUGAS_HARIAN = ["konten", "produksi"] as const;
export type TugasHarian = (typeof TUGAS_HARIAN)[number];
export const JENIS_PENGECUALIAN = ["tugas", "libur", "pasangan"] as const;
export type JenisPengecualian = (typeof JENIS_PENGECUALIAN)[number];

export const LABEL_TUGAS: Record<TugasHarian, string> = { konten: "KONTEN", produksi: "PRODUKSI" };
export const lawanTugas = (t: TugasHarian): TugasHarian => (t === "konten" ? "produksi" : "konten");

export type PasanganH = {
  id: number;
  nama: string | null;
  pesertaAId: number;
  pesertaBId: number | null;
  patokanTanggal: string;
  patokanTugas: TugasHarian;
  aktif: boolean;
  urutan: number;
};

/** Anak + masa magangnya. aktif = peserta aktif DAN karyawan aktif. */
export type AnakH = { pesertaId: number; panggilan: string; mulai: string; selesai: string | null; aktif: boolean };

export type PengecualianH = {
  id: number;
  tanggal: string;
  pasanganId: number | null;
  pesertaId: number | null;
  jenis: JenisPengecualian;
  tugas: TugasHarian | null;
  pasanganPesertaId: number | null;
  catatan: string | null;
};

/**
 * Keadaan satu anak pada satu tanggal:
 * - tugas: punya tugas (lihat tugas/rekan/sendiri)
 * - libur: diliburkan pembina (pasangan atau anak itu)
 * - bukan-hari-kerja: Minggu / tanggal merah (Holiday)
 * - di-luar-masa: sebelum mulai / sesudah selesai / anak nonaktif
 * - tanpa-pasangan: belum dimasukkan ke pasangan aktif mana pun
 */
export type KeadaanHarian = "tugas" | "libur" | "bukan-hari-kerja" | "di-luar-masa" | "tanpa-pasangan";

export type HasilAnak = {
  pesertaId: number;
  tanggal: string;
  keadaan: KeadaanHarian;
  tugas: TugasHarian | null;
  /** Tugas menurut pola (tanpa pengecualian) — untuk menandai "diubah". */
  tugasPola: TugasHarian | null;
  rekanId: number | null;
  rekan: string | null;
  sendiri: boolean;
  libur: boolean;
  sumber: "pola" | "pengecualian";
  /** Pengecualian yang berlaku: tingkat pasangan atau tingkat anak (ganti pasangan / tugas / libur anak itu). */
  tingkat: "pasangan" | "anak" | null;
  pengecualianId: number | null;
  pasanganId: number | null;
  catatan: string | null;
};

// ── Tanggal ("YYYY-MM-DD", bebas zona waktu) ─────────────────────────────────────────────────────

const HARI_MS = 86_400_000;
function keHari(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / HARI_MS);
}
function dariHari(n: number): string {
  const t = new Date(n * HARI_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
/** 0 = Minggu … 6 = Sabtu. */
export function hariDalamMinggu(ymd: string): number {
  return (((keHari(ymd) + 4) % 7) + 7) % 7;
}
export function tambahHariH(ymd: string, k: number): string {
  return dariHari(keHari(ymd) + k);
}
export function seninH(ymd: string): string {
  const n = keHari(ymd);
  return dariHari(n - ((((n + 3) % 7) + 7) % 7));
}
export const bentukYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && dariHari(keHari(v)) === v;

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const namaHari = (ymd: string) => NAMA_HARI[hariDalamMinggu(ymd)];
/** "2026-11-16" → "Senin 16 Nov". */
export function labelTanggal(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${namaHari(ymd)} ${d} ${NAMA_BULAN[m - 1]}`;
}

/** Senin–Sabtu dan bukan tanggal Holiday. */
export function hariKerja(ymd: string, libur: ReadonlySet<string>): boolean {
  return hariDalamMinggu(ymd) !== 0 && !libur.has(ymd);
}

/** Banyaknya Senin–Sabtu pada hari ke-n setengah-terbuka [0, n) dihitung dari epoch-hari 0 (Kamis). */
function seninSabtuSebelum(n: number): number {
  // Hari ke-x adalah Minggu bila (x + 4) % 7 === 0 → x ≡ 3 (mod 7).
  const minggu = Math.floor((n - 3 + 6) / 7) - Math.floor((0 - 3 + 6) / 7);
  return n - minggu;
}

/**
 * Selisih hari kerja bertanda dari a ke b: banyaknya hari kerja di (a, b] bila b ≥ a, dan −(hari kerja di (b, a])
 * bila b < a. Paritasnya menentukan giliran (genap = tugas patokan). Minggu & libur tidak dihitung.
 */
export function selisihHariKerja(a: string, b: string, libur: ReadonlySet<string>): number {
  if (a === b) return 0;
  const [lo, hi, tanda] = b > a ? [a, b, 1] : [b, a, -1];
  const nLo = keHari(lo);
  const nHi = keHari(hi);
  // Senin–Sabtu di (lo, hi] = di [lo+1, hi+1)
  let n = seninSabtuSebelum(nHi + 1) - seninSabtuSebelum(nLo + 1);
  for (const t of libur) if (t > lo && t <= hi && hariDalamMinggu(t) !== 0) n--;
  return tanda * n;
}

/** Tugas pola (tanpa pengecualian) pasangan pada tanggal kerja ymd. */
export function tugasPola(p: Pick<PasanganH, "patokanTanggal" | "patokanTugas">, ymd: string, libur: ReadonlySet<string>): TugasHarian {
  return Math.abs(selisihHariKerja(p.patokanTanggal, ymd, libur)) % 2 === 0 ? p.patokanTugas : lawanTugas(p.patokanTugas);
}

export function dalamMasa(a: AnakH | undefined, ymd: string): boolean {
  return !!a && a.aktif && ymd >= a.mulai && (!a.selesai || ymd <= a.selesai);
}

// ── Satu anggota pasangan aktif paling banyak SATU pasangan aktif ───────────────────────────────

export type CalonPasangan = { id?: number; pesertaAId: number; pesertaBId: number | null; aktif: boolean };

/** Anak di calon yang sudah ada di pasangan AKTIF lain → [{pesertaId, pasanganId}]. Calon nonaktif tidak bentrok. */
export function bentrokPasangan(ada: readonly CalonPasangan[], calon: CalonPasangan): { pesertaId: number; pasanganId: number }[] {
  if (!calon.aktif) return [];
  const anggota = [calon.pesertaAId, calon.pesertaBId].filter((x): x is number => x != null);
  const hasil: { pesertaId: number; pasanganId: number }[] = [];
  for (const p of ada) {
    if (!p.aktif || p.id === calon.id || p.id == null) continue;
    for (const x of anggota) if (x === p.pesertaAId || x === p.pesertaBId) hasil.push({ pesertaId: x, pasanganId: p.id });
  }
  return hasil;
}

// ── Inti: tugas tiap anak pada satu tanggal ──────────────────────────────────────────────────────

/**
 * Hasil semua anak yang relevan pada tanggal ymd: anggota pasangan aktif + anak yang disebut pengecualian anak.
 * Anak lain (tanpa pasangan) tidak muncul di peta → pemanggil menganggapnya "tanpa-pasangan".
 * Bila ada lebih dari satu pengecualian untuk sasaran yang sama, yang id-nya terbesar (terbaru) dipakai.
 */
export function tugasPada(
  pasangan: readonly PasanganH[],
  ymd: string,
  libur: ReadonlySet<string>,
  pengecualian: readonly PengecualianH[],
  anak: ReadonlyMap<number, AnakH>
): Map<number, HasilAnak> {
  const aktif = [...pasangan].filter((p) => p.aktif).sort((a, b) => a.urutan - b.urutan || a.id - b.id);
  const hariIni = [...pengecualian].filter((e) => e.tanggal === ymd).sort((a, b) => b.id - a.id);
  const ePasangan = new Map<number, PengecualianH>();
  const eAnak = new Map<number, PengecualianH>();
  for (const e of hariIni) {
    if (e.pasanganId != null && e.pesertaId == null) {
      if (!ePasangan.has(e.pasanganId)) ePasangan.set(e.pasanganId, e);
    } else if (e.pesertaId != null) {
      if (!eAnak.has(e.pesertaId)) eAnak.set(e.pesertaId, e);
      // Ganti pasangan berlaku dua arah: rekan pengganti ikut (bila dia sendiri tidak punya pengecualian lebih baru).
      if (e.jenis === "pasangan" && e.pasanganPesertaId != null && !eAnak.has(e.pasanganPesertaId)) eAnak.set(e.pasanganPesertaId, e);
    }
  }
  const pasanganAnak = new Map<number, PasanganH>();
  for (const p of aktif) for (const x of [p.pesertaAId, p.pesertaBId]) if (x != null && !pasanganAnak.has(x)) pasanganAnak.set(x, p);

  const kerja = hariKerja(ymd, libur);
  const nama = (id: number | null) => (id == null ? null : anak.get(id)?.panggilan ?? null);
  const hasil = new Map<number, HasilAnak>();
  const dasar = (id: number): HasilAnak => {
    const p = pasanganAnak.get(id) ?? null;
    return {
      pesertaId: id,
      tanggal: ymd,
      keadaan: "tanpa-pasangan",
      tugas: null,
      tugasPola: p && kerja ? tugasPola(p, ymd, libur) : null,
      rekanId: null,
      rekan: null,
      sendiri: false,
      libur: false,
      sumber: "pola",
      tingkat: null,
      pengecualianId: null,
      pasanganId: p?.id ?? null,
      catatan: null,
    };
  };

  // Langkah 1: keadaan & tugas tiap anak (tanpa rekan).
  const semua = new Set<number>([...pasanganAnak.keys(), ...eAnak.keys()]);
  for (const id of semua) {
    const h = dasar(id);
    hasil.set(id, h);
    if (!dalamMasa(anak.get(id), ymd)) {
      h.keadaan = "di-luar-masa";
      continue;
    }
    if (!kerja) {
      h.keadaan = "bukan-hari-kerja";
      continue;
    }
    const p = pasanganAnak.get(id);
    const ea = eAnak.get(id);
    const ep = p ? ePasangan.get(p.id) : undefined;
    if (ea) {
      h.sumber = "pengecualian";
      h.tingkat = "anak";
      h.pengecualianId = ea.id;
      h.catatan = ea.catatan;
      if (ea.jenis === "libur") {
        h.keadaan = "libur";
        h.libur = true;
        continue;
      }
      if (ea.jenis === "pasangan") {
        // Tugas hari itu: tugas pengecualian → pola pasangan pemilik pengecualian → pola pasangan rekan.
        const pemilik = ea.pesertaId != null ? pasanganAnak.get(ea.pesertaId) : undefined;
        const lain = ea.pasanganPesertaId != null ? pasanganAnak.get(ea.pasanganPesertaId) : undefined;
        const t = ea.tugas ?? (pemilik ? tugasPola(pemilik, ymd, libur) : lain ? tugasPola(lain, ymd, libur) : null);
        if (t) {
          h.keadaan = "tugas";
          h.tugas = t;
        }
        continue;
      }
      // jenis "tugas" untuk anak ini saja
      h.keadaan = "tugas";
      h.tugas = ea.tugas ?? (p ? tugasPola(p, ymd, libur) : null);
      if (!h.tugas) h.keadaan = "tanpa-pasangan";
      continue;
    }
    if (!p) continue; // tanpa-pasangan
    if (ep) {
      h.sumber = "pengecualian";
      h.tingkat = "pasangan";
      h.pengecualianId = ep.id;
      h.catatan = ep.catatan;
      if (ep.jenis === "libur") {
        h.keadaan = "libur";
        h.libur = true;
        continue;
      }
      h.keadaan = "tugas";
      h.tugas = ep.tugas ?? tugasPola(p, ymd, libur);
      continue;
    }
    h.keadaan = "tugas";
    h.tugas = tugasPola(p, ymd, libur);
  }

  // Langkah 2: rekan.
  for (const h of hasil.values()) {
    if (h.keadaan !== "tugas") continue;
    const ea = eAnak.get(h.pesertaId);
    let rekan: number | null = null;
    if (ea?.jenis === "pasangan") {
      rekan = ea.pesertaId === h.pesertaId ? ea.pasanganPesertaId : ea.pesertaId;
    } else {
      const p = pasanganAnak.get(h.pesertaId);
      const lain = p ? (p.pesertaAId === h.pesertaId ? p.pesertaBId : p.pesertaAId) : null;
      // Rekan asli hanya bila dia juga bertugas hari itu, tidak dipinjam pasangan lain, dan tugasnya sama.
      const hl = lain != null ? hasil.get(lain) : undefined;
      const dipinjam = lain != null && eAnak.get(lain)?.jenis === "pasangan";
      if (hl && hl.keadaan === "tugas" && !dipinjam && hl.tugas === h.tugas) rekan = lain;
    }
    const hr = rekan != null ? hasil.get(rekan) : undefined;
    if (rekan != null && hr && hr.keadaan === "tugas") {
      h.rekanId = rekan;
      h.rekan = nama(rekan);
    } else {
      h.sendiri = true;
    }
  }
  return hasil;
}

// ── Grid seminggu (Senin–Sabtu) untuk dasbor ─────────────────────────────────────────────────────

/** diubah = anak ini punya pengecualian SENDIRI hari itu (pengecualianId = id-nya, untuk dihapus dari dialog). */
export type AnggotaSel = {
  pesertaId: number;
  panggilan: string;
  keadaan: KeadaanHarian;
  tugas: TugasHarian | null;
  rekan: string | null;
  sendiri: boolean;
  diubah: boolean;
  pengecualianId: number | null;
  catatan: string | null;
};
export type SelPasangan = {
  pasanganId: number;
  /** Tugas tingkat pasangan (pola atau pengecualian pasangan); null bila libur / bukan hari kerja / di luar masa semua. */
  tugas: TugasHarian | null;
  tugasPola: TugasHarian | null;
  libur: boolean;
  keadaan: "tugas" | "libur" | "bukan-hari-kerja" | "di-luar-masa";
  sumber: "pola" | "pengecualian";
  catatan: string | null;
  pengecualianId: number | null;
  anggota: AnggotaSel[];
};
export type HariMinggu = { tanggal: string; hariKerja: boolean; sel: SelPasangan[]; hasil: HasilAnak[] };

export function jadwalMinggu(input: {
  senin: string;
  pasangan: readonly PasanganH[];
  libur: ReadonlySet<string>;
  pengecualian: readonly PengecualianH[];
  anak: ReadonlyMap<number, AnakH>;
}): HariMinggu[] {
  const senin = seninH(input.senin);
  const aktif = [...input.pasangan].filter((p) => p.aktif).sort((a, b) => a.urutan - b.urutan || a.id - b.id);
  const hari: HariMinggu[] = [];
  for (let i = 0; i < 6; i++) {
    const t = tambahHariH(senin, i);
    const peta = tugasPada(input.pasangan, t, input.libur, input.pengecualian, input.anak);
    const kerja = hariKerja(t, input.libur);
    const ePas = new Map<number, PengecualianH>();
    for (const e of [...input.pengecualian].filter((e) => e.tanggal === t && e.pasanganId != null && e.pesertaId == null).sort((a, b) => b.id - a.id))
      if (!ePas.has(e.pasanganId!)) ePas.set(e.pasanganId!, e);
    const sel = aktif.map((p): SelPasangan => {
      const ids = [p.pesertaAId, p.pesertaBId].filter((x): x is number => x != null);
      const masaAda = ids.some((x) => dalamMasa(input.anak.get(x), t));
      const e = ePas.get(p.id);
      const pola = kerja ? tugasPola(p, t, input.libur) : null;
      const keadaan: SelPasangan["keadaan"] = !kerja ? "bukan-hari-kerja" : !masaAda ? "di-luar-masa" : e?.jenis === "libur" ? "libur" : "tugas";
      return {
        pasanganId: p.id,
        tugas: keadaan === "tugas" ? e?.tugas ?? pola : null,
        tugasPola: pola,
        libur: keadaan === "libur",
        keadaan,
        sumber: e ? "pengecualian" : "pola",
        catatan: e?.catatan ?? null,
        pengecualianId: e?.id ?? null,
        anggota: ids.map((x) => {
          const h = peta.get(x)!;
          return {
            pesertaId: x,
            panggilan: input.anak.get(x)?.panggilan ?? `#${x}`,
            keadaan: h.keadaan,
            tugas: h.tugas,
            rekan: h.rekan,
            sendiri: h.sendiri,
            diubah: h.tingkat === "anak",
            pengecualianId: h.tingkat === "anak" ? h.pengecualianId : null,
            catatan: h.tingkat === "anak" ? h.catatan : null,
          };
        }),
      };
    });
    hari.push({ tanggal: t, hariKerja: kerja, sel, hasil: [...peta.values()] });
  }
  return hari;
}

// ── Teks untuk WhatsApp ──────────────────────────────────────────────────────────────────────────

/** Satuan kerja hari itu (pasangan nyata, bisa hasil tukar) dikelompokkan per tugas, urut pasangan. */
export function satuanHari(h: Pick<HariMinggu, "hasil">, anak: ReadonlyMap<number, AnakH>, urutAnak: readonly number[]) {
  const posisi = new Map(urutAnak.map((id, i) => [id, i]));
  const urut = [...h.hasil].sort((a, b) => (posisi.get(a.pesertaId) ?? 1e9) - (posisi.get(b.pesertaId) ?? 1e9) || a.pesertaId - b.pesertaId);
  const sudah = new Set<number>();
  const per: Record<TugasHarian, string[]> = { konten: [], produksi: [] };
  const libur: string[] = [];
  const nama = (id: number) => anak.get(id)?.panggilan ?? `#${id}`;
  for (const x of urut) {
    if (sudah.has(x.pesertaId)) continue;
    sudah.add(x.pesertaId);
    if (x.keadaan === "libur") {
      libur.push(nama(x.pesertaId));
      continue;
    }
    if (x.keadaan !== "tugas" || !x.tugas) continue;
    if (x.rekanId != null) {
      sudah.add(x.rekanId);
      per[x.tugas].push(`${nama(x.pesertaId)} & ${nama(x.rekanId)}`);
    } else per[x.tugas].push(`${nama(x.pesertaId)} (sendiri)`);
  }
  return { ...per, libur };
}

/**
 * "Senin 16 Nov — Konten: A & B, C & D · Produksi: E & F, G & H" per hari kerja (Senin–Sabtu); hari libur
 * (Holiday) tertulis "Libur"; libur pembina ditambahkan "· Libur: X".
 */
export function teksWA(minggu: readonly HariMinggu[], anak: ReadonlyMap<number, AnakH>, urutAnak: readonly number[], namaLibur: ReadonlyMap<string, string> = new Map()): string {
  if (minggu.length === 0) return "";
  const baris = [`Jadwal harian magang ${labelTanggal(minggu[0].tanggal)} – ${labelTanggal(minggu[minggu.length - 1].tanggal)}`, ""];
  for (const h of minggu) {
    if (!h.hariKerja) {
      if (hariDalamMinggu(h.tanggal) !== 0) baris.push(`${labelTanggal(h.tanggal)} — Libur${namaLibur.get(h.tanggal) ? ` (${namaLibur.get(h.tanggal)})` : ""}`);
      continue;
    }
    const s = satuanHari(h, anak, urutAnak);
    const bagian: string[] = [];
    if (s.konten.length) bagian.push(`Konten: ${s.konten.join(", ")}`);
    if (s.produksi.length) bagian.push(`Produksi: ${s.produksi.join(", ")}`);
    if (s.libur.length) bagian.push(`Libur: ${s.libur.join(", ")}`);
    if (bagian.length) baris.push(`${labelTanggal(h.tanggal)} — ${bagian.join(" · ")}`);
  }
  return baris.join("\n").trim();
}

/** Urutan anak untuk teks/tampilan: anggota pasangan aktif menurut urutan pasangan (A lalu B). */
export function urutAnakPasangan(pasangan: readonly PasanganH[]): number[] {
  return [...pasangan]
    .filter((p) => p.aktif)
    .sort((a, b) => a.urutan - b.urutan || a.id - b.id)
    .flatMap((p) => [p.pesertaAId, p.pesertaBId].filter((x): x is number => x != null));
}

// ── Satu anak (HP anak & pantau guru) ────────────────────────────────────────────────────────────

/** Hasil satu anak untuk tiap tanggal di [dari, sampai] (termasuk Minggu/libur). Anak tanpa pasangan → tanpa-pasangan. */
export function jadwalAnak(input: {
  pesertaId: number;
  dari: string;
  sampai: string;
  pasangan: readonly PasanganH[];
  libur: ReadonlySet<string>;
  pengecualian: readonly PengecualianH[];
  anak: ReadonlyMap<number, AnakH>;
}): HasilAnak[] {
  const out: HasilAnak[] = [];
  for (let t = input.dari, i = 0; t <= input.sampai && i < 400; t = tambahHariH(t, 1), i++) {
    const h = tugasPada(input.pasangan, t, input.libur, input.pengecualian, input.anak).get(input.pesertaId);
    if (h) out.push(h);
    else {
      const a = input.anak.get(input.pesertaId);
      out.push({
        pesertaId: input.pesertaId,
        tanggal: t,
        keadaan: !dalamMasa(a, t) ? "di-luar-masa" : !hariKerja(t, input.libur) ? "bukan-hari-kerja" : "tanpa-pasangan",
        tugas: null,
        tugasPola: null,
        rekanId: null,
        rekan: null,
        sendiri: false,
        libur: false,
        sumber: "pola",
        tingkat: null,
        pengecualianId: null,
        pasanganId: null,
        catatan: null,
      });
    }
  }
  return out;
}

/**
 * Bentuk yang dikirim ke HP anak & guru: tanggal, keadaan, tugas, nama panggilan rekan, sendiri. TANPA catatan
 * pembina, id pengecualian, atau data anak lain.
 */
export function serialHarianAnak(h: HasilAnak) {
  return { tanggal: h.tanggal, keadaan: h.keadaan, tugas: h.tugas, rekan: h.rekan, sendiri: h.sendiri };
}
export type HarianAnakJson = ReturnType<typeof serialHarianAnak>;
