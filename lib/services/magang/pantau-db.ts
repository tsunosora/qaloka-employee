/**
 * Pantauan guru sekolah — bagian ber-DB. Aturan murni (sesi, cakupan, serializer): ./pantau.ts.
 * Semua respons publik lewat responsPantau()/tidakBerlaku(): no-store + noindex + nosniff.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalSecret } from "@/lib/services/portal/auth";
import { atMidnight, toYmd, LEAVE_MACHINE_NAME } from "@/lib/services/leave/service";
import { aggregateAttendance } from "@/lib/services/attendance/aggregate";
import { namaUsaha } from "@/lib/services/upah/data";
import { daftarFoto } from "./jurnal";
import { hariIni, keYmd } from "./layanan";
import { penugasanPada, seninDari, tambahHari, tambahMinggu } from "./rotasi";
import { susunRapor } from "./rapor";
import { predikat } from "./nilai";
import { kategoriDanPeta, progresPeserta } from "./misi-db";
import { labelKategori } from "./misi";
import { daftarSekolah, kunciSekolah, sekolahSama } from "./sekolah";
import {
  PANTAU_COOKIE,
  PESAN_TAUTAN_TIDAK_BERLAKU,
  PenahanPin,
  anakDalamCakupan,
  bentukTokenSah,
  hariKerjaAnak,
  hitungKehadiran,
  kerajinanGuru,
  saringSekolah,
  serialAnakRingkas,
  serialHariAbsen,
  serialIzinGuru,
  serialJurnalGuru,
  serialRaporRingkas,
  serialScan,
  serialSideQuest,
  serialTautanAdmin,
  serialTugasGuru,
  sesiPantauSah,
  statusGuru,
  tautanBerlaku,
  type ScanGuru,
  type TautanPantau,
} from "./pantau";

export const HEADER_PANTAU = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
} as const;

export function responsPantau(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { ...HEADER_PANTAU, ...(init?.headers ?? {}) } });
}

/** Satu pesan umum untuk token tak dikenal / dicabut / kedaluwarsa. */
export function tidakBerlaku() {
  return responsPantau({ message: PESAN_TAUTAN_TIDAK_BERLAKU }, { status: 404 });
}

/** 404 umum untuk data di luar cakupan (anak sekolah lain, berkas orang lain). */
export function tidakAda() {
  return responsPantau({ message: "Data tidak ditemukan." }, { status: 404 });
}

/** Berkas (foto/lampiran) untuk guru: tidak pernah di-cache, jenis tidak boleh ditebak. */
export function responsBerkas(bita: Buffer, tipe: string, disposisi?: string) {
  return new Response(new Uint8Array(bita), {
    headers: {
      ...HEADER_PANTAU,
      "Content-Type": tipe,
      "Content-Length": String(bita.length),
      ...(disposisi ? { "Content-Disposition": disposisi } : {}),
    },
  });
}

/** Penahan tebakan PIN — di memori proses (cukup untuk satu instalasi; hilang saat restart). */
const g = globalThis as unknown as { penahanPantau?: PenahanPin };
export const penahanPantau = g.penahanPantau ?? (g.penahanPantau = new PenahanPin());

export function ipKlien(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

export type TautanDb = TautanPantau & { sekolahLabel: string; tampilLampiranIzin: boolean };

/** Tautan yang BERLAKU untuk token ini; selain itu lempar 404 umum. */
export async function muatTautan(token: string): Promise<TautanDb> {
  if (!bentukTokenSah(token)) throw tidakBerlaku();
  const t = await prisma.magangPantau.findUnique({
    where: { token },
    select: { id: true, token: true, pinHash: true, aktif: true, dicabutAt: true, kedaluwarsa: true, sekolahKunci: true, sekolahLabel: true, tampilLampiranIzin: true },
  });
  if (!t || !tautanBerlaku(t, hariIni())) throw tidakBerlaku();
  return t;
}

export async function sudahMasuk(t: TautanDb): Promise<boolean> {
  const store = await cookies();
  return sesiPantauSah(store.get(PANTAU_COOKIE)?.value, t, portalSecret());
}

/** Tautan berlaku + sesi PIN yang sah untuk tautan ini (dicek ulang ke DB tiap permintaan). */
export async function requireSesiPantau(token: string): Promise<TautanDb> {
  const t = await muatTautan(token);
  if (!(await sudahMasuk(t))) {
    throw responsPantau({ message: "Masukkan PIN untuk membuka halaman ini.", code: "PIN_REQUIRED" }, { status: 401 });
  }
  return t;
}

const pilihPeserta = {
  id: true,
  employeeId: true,
  sekolah: true,
  jurusan: true,
  mulai: true,
  selesai: true,
  aktif: true,
  employee: { select: { fullName: true, nickname: true, isActive: true, deletedAt: true } },
  penugasan: { select: { id: true, pesertaId: true, posId: true, mulai: true, minggu: true, berbagi: true }, orderBy: { mulai: "asc" as const } },
} as const;

/** Semua anak sekolah ini (aktif & nonaktif), karyawan tidak dihapus. Dicocokkan dengan sekolahSama. */
export async function pesertaSekolah(kunci: string) {
  const semua = await prisma.magangPeserta.findMany({
    where: { employee: { deletedAt: null } },
    select: pilihPeserta,
    orderBy: [{ aktif: "desc" }, { mulai: "asc" }, { id: "asc" }],
  });
  return saringSekolah(semua, kunci);
}
type PesertaSekolah = Awaited<ReturnType<typeof pesertaSekolah>>[number];

export async function anakAtau404(t: TautanDb, idRaw: string): Promise<PesertaSekolah> {
  const id = Number(idRaw) || 0;
  const p = await prisma.magangPeserta.findFirst({ where: { id, employee: { deletedAt: null } }, select: pilihPeserta });
  const ok = p ? anakDalamCakupan([p], t.sekolahKunci, id) : null;
  if (!ok) throw tidakAda();
  return ok;
}

async function liburDalam(dari: string, sampai: string): Promise<Set<string>> {
  if (sampai < dari) return new Set();
  const rows = await prisma.holiday.findMany({ where: { date: { gte: atMidnight(dari), lte: atMidnight(sampai) } }, select: { date: true } });
  return new Set(rows.map((r) => toYmd(r.date)));
}

const STATUS_IZIN = new Set(["Izin", "Sakit", "Cuti"]);
const masa = (p: { mulai: Date; selesai: Date | null }) => ({ mulai: toYmd(p.mulai), selesai: p.selesai ? toYmd(p.selesai) : null });

async function petaPos() {
  const pos = await prisma.magangPos.findMany({ select: { id: true, nama: true, lokasi: true } });
  return new Map(pos.map((p) => [p.id, { nama: p.nama, lokasi: p.lokasi }]));
}

/** Kepala halaman guru. */
export async function kepalaPantau(t: TautanDb) {
  const anak = await pesertaSekolah(t.sekolahKunci);
  const mulai = anak.map((a) => toYmd(a.mulai)).sort()[0] ?? hariIni();
  return { sekolah: t.sekolahLabel, usaha: await namaUsaha(), hariIni: hariIni(), awalMagang: mulai, tampilLampiranIzin: t.tampilLampiranIzin };
}

/** Daftar anak + ringkasan kehadiran/jurnal/side quest dalam rentang. */
export async function daftarAnakGuru(t: TautanDb, r: { dari: string; sampai: string }) {
  const anak = await pesertaSekolah(t.sekolahKunci);
  const hari = hariIni();
  const ids = anak.map((a) => a.id);
  const empIds = anak.map((a) => a.employeeId);
  const [libur, absen, jurnal, progres, pos] = await Promise.all([
    liburDalam(r.dari, r.sampai),
    empIds.length
      ? prisma.attendance.findMany({
          where: { employeeId: { in: empIds }, scanDate: { gte: atMidnight(r.dari), lt: atMidnight(tambahHari(r.sampai, 1)) } },
          select: { employeeId: true, scanDate: true, scanType: true, status: true },
        })
      : [],
    ids.length
      ? prisma.magangJurnal.findMany({ where: { pesertaId: { in: ids }, tanggal: { gte: atMidnight(r.dari), lte: atMidnight(r.sampai) } }, select: { pesertaId: true, tanggal: true } })
      : [],
    progresPeserta(prisma, ids),
    petaPos(),
  ]);
  const seninIni = seninDari(hari);
  return anak.map((p) => {
    const hk = hariKerjaAnak(r, masa(p), hari, libur);
    const milik = absen.filter((a) => a.employeeId === p.employeeId);
    const hadir = new Set(milik.filter((a) => a.scanType !== "absence" && !STATUS_IZIN.has(a.status)).map((a) => toYmd(a.scanDate)));
    const izin = new Set(milik.filter((a) => a.scanType === "absence" || STATUS_IZIN.has(a.status)).map((a) => toYmd(a.scanDate)));
    const blok = penugasanPada(p.penugasan.map(keYmd), seninIni);
    const pg = progres.get(p.id) ?? null;
    return serialAnakRingkas({
      peserta: { ...p, ...masa(p) },
      posIni: blok ? pos.get(blok.posId) ?? null : null,
      kehadiran: hitungKehadiran(hk, hadir, izin, hari),
      jurnal: kerajinanGuru(jurnal.filter((j) => j.pesertaId === p.id).map((j) => toYmd(j.tanggal)), hk, hari),
      sideQuest: pg ? { selesai: pg.selesai, total: pg.total } : null,
    });
  });
}

/** Detail satu anak untuk guru. Semua URL berkas lewat rute ber-sesi di bawah /api/public/pantau/<token>. */
export async function detailAnakGuru(t: TautanDb, p: PesertaSekolah, r: { dari: string; sampai: string }) {
  const hari = hariIni();
  const m = masa(p);
  const dasar = `/api/public/pantau/${t.token}/anak/${p.id}`;
  const [libur, scanMentah, jurnal, izin, tugas, progres, misiSelesai, { peta }, pos] = await Promise.all([
    liburDalam(r.dari, r.sampai),
    prisma.attendance.findMany({
      where: { employeeId: p.employeeId, scanDate: { gte: atMidnight(r.dari), lt: atMidnight(tambahHari(r.sampai, 1)) } },
      orderBy: { scanDate: "asc" },
      select: { id: true, scanDate: true, scanType: true, status: true, machineName: true, absenceReason: true },
    }),
    prisma.magangJurnal.findMany({
      where: { pesertaId: p.id, tanggal: { gte: atMidnight(r.dari), lte: atMidnight(r.sampai) } },
      orderBy: { tanggal: "desc" },
      select: { id: true, tanggal: true, kegiatan: true, kendala: true, komentar: true, dicekAt: true, foto: true, pos: { select: { nama: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: p.employeeId, startDate: { lte: atMidnight(r.sampai) }, endDate: { gte: atMidnight(r.dari) } },
      orderBy: { startDate: "desc" },
      select: { id: true, type: true, startDate: true, endDate: true, reason: true, status: true, decisionNote: true, lampiran: { select: { id: true, nama: true, tipe: true }, orderBy: { id: "asc" } } },
    }),
    prisma.magangTugas.findMany({
      where: { pesertaId: p.id },
      orderBy: { senin: "asc" },
      select: {
        senin: true, posId: true, skorKuis: true, nilai: true, nilaiIngatan: true, terlambat: true, dikirimAt: true, dinilaiAt: true, catatanPembimbing: true,
        ketelitian: true, kecepatan: true, inisiatif: true, sikap: true, pos: { select: { nama: true } },
      },
    }),
    progresPeserta(prisma, [p.id]),
    prisma.magangMisiKiriman.findMany({
      where: { pesertaId: p.id, status: "disetujui" },
      orderBy: { diputusAt: "asc" },
      select: { diputusAt: true, misi: { select: { judul: true, kategori: true } } },
    }),
    kategoriDanPeta(prisma),
    petaPos(),
  ]);

  // ── Absensi per hari: status dari laporan absensi yang sama dengan dasbor (aggregateAttendance), scan & sumber dari baris mentah.
  const hk = hariKerjaAnak(r, m, hari, libur);
  const hkSet = new Set(hk);
  const awal = r.dari > m.mulai ? r.dari : m.mulai;
  let akhir = r.sampai < hari ? r.sampai : hari;
  if (m.selesai && m.selesai < akhir) akhir = m.selesai;
  const laporan =
    awal <= akhir && p.employee.isActive
      ? new Map((await aggregateAttendance(prisma, { startStr: awal, endStr: akhir, employeeId: String(p.employeeId) })).rows.map((x) => [x.date, x]))
      : new Map();
  const scanNyata = scanMentah.filter((s) => s.scanType !== "absence" && s.machineName !== LEAVE_MACHINE_NAME && !STATUS_IZIN.has(s.status));
  const bukti = scanNyata.some((s) => s.machineName === "hp")
    ? await prisma.absenHpBukti.findMany({
        where: { employeeId: p.employeeId, attendanceId: { in: scanNyata.filter((s) => s.machineName === "hp").map((s) => s.id) } },
        select: { id: true, attendanceId: true, jarakM: true, lokasi: { select: { nama: true } } },
      })
    : [];
  const buktiPer = new Map(bukti.map((b) => [b.attendanceId, b]));
  const scanPer = new Map<string, ScanGuru[]>();
  for (const s of scanNyata) {
    const k = toYmd(s.scanDate);
    const arr = scanPer.get(k) ?? [];
    arr.push(serialScan(s, buktiPer.get(s.id) ?? null, (id) => `${dasar}/absen-foto/${id}`));
    scanPer.set(k, arr);
  }
  const absenRows: ReturnType<typeof serialHariAbsen>[] = [];
  const hadirSet = new Set<string>();
  const izinSet = new Set<string>();
  for (let d = awal, n = 0; d <= akhir && n < 400; d = tambahHari(d, 1), n++) {
    const scan = scanPer.get(d) ?? [];
    const lap = laporan.get(d);
    const absence = scanMentah.find((s) => toYmd(s.scanDate) === d && (s.scanType === "absence" || STATUS_IZIN.has(s.status)));
    let status = lap ? statusGuru(lap.status, hkSet.has(d)) : absence ? statusGuru(absence.status, true) : scan.length ? "hadir" as const : hkSet.has(d) ? "alpa" as const : "libur" as const;
    if (status === "alpa" && scan.length) status = "hadir";
    // Absen di hari yang bukan hari kerja (Minggu/libur): dicatat hadir, tanpa hitungan terlambat.
    const luarHariKerja = !hkSet.has(d) && scan.length > 0 && (status === "hadir" || status === "terlambat");
    if (luarHariKerja) status = "hadir";
    if (status === "libur" && scan.length === 0) continue;
    if (d === hari && status === "alpa") continue; // hari ini belum selesai — belum tentu tidak hadir
    if (status === "hadir" || status === "terlambat") hadirSet.add(d);
    if (status === "izin" || status === "sakit") izinSet.add(d);
    absenRows.push(
      serialHariAbsen({
        tanggal: d,
        masuk: lap?.clockIn ?? scan[0]?.jam ?? null,
        pulang: lap?.clockOut ?? (scan.length > 1 ? scan[scan.length - 1].jam : null),
        status,
        terlambatMenit: lap && status === "terlambat" ? lap.lateMinutes : 0,
        keterangan: luarHariKerja
          ? "Absen di hari libur/Minggu (tidak dihitung)"
          : status === "izin" || status === "sakit"
            ? lap?.absenceReason ?? absence?.absenceReason ?? null
            : null,
        scan,
      })
    );
  }
  absenRows.reverse();

  // ── Rapor ringkas (semua minggu) & tugas mengingat (minggu dalam rentang).
  const tugasYmd = tugas.map((x) => ({
    senin: toYmd(x.senin),
    posId: x.posId,
    pos: x.pos?.nama ?? null,
    skorKuis: x.skorKuis,
    nilai: x.nilai,
    nilaiIngatan: x.nilaiIngatan,
    praktik: { ketelitian: x.ketelitian, kecepatan: x.kecepatan, inisiatif: x.inisiatif, sikap: x.sikap },
    terlambat: x.terlambat,
    dikirimAt: x.dikirimAt.toISOString(),
    dinilaiAt: x.dinilaiAt?.toISOString() ?? null,
    catatanPembimbing: x.catatanPembimbing,
  }));
  const penugasan = p.penugasan.map(keYmd);
  const rapor = susunRapor({
    penugasan,
    tugas: tugasYmd,
    namaPos: new Map([...pos.entries()].map(([id, x]) => [id, x.nama])),
    sampai: seninDari(hari),
  });
  const seninAwal = seninDari(r.dari);

  const jurnalYmd = jurnal.map((j) => ({
    id: j.id,
    tanggal: toYmd(j.tanggal),
    pos: j.pos?.nama ?? null,
    kegiatan: j.kegiatan,
    kendala: j.kendala,
    komentar: j.komentar,
    dicek: !!j.dicekAt,
    jumlahFoto: daftarFoto(j.foto).length,
  }));
  const blokIni = penugasanPada(penugasan, seninDari(hari));
  const ringkas = serialAnakRingkas({
    peserta: { ...p, ...m },
    posIni: blokIni ? pos.get(blokIni.posId) ?? null : null,
    kehadiran: hitungKehadiran(hk, hadirSet, izinSet, hari),
    jurnal: kerajinanGuru(jurnalYmd.map((j) => j.tanggal), hk, hari),
    sideQuest: progres.get(p.id) ?? null,
  });

  return {
    anak: ringkas,
    rentang: r,
    absensi: absenRows,
    jurnal: jurnalYmd.map((j) => serialJurnalGuru(j, (id, n) => `${dasar}/jurnal/${id}/foto/${n}`)),
    izin: izin.map((l) =>
      serialIzinGuru(
        { ...l, startDate: toYmd(l.startDate), endDate: toYmd(l.endDate) },
        t.tampilLampiranIzin,
        (izinId, lampiranId) => `${dasar}/izin/${izinId}/lampiran/${lampiranId}`
      )
    ),
    jadwal: penugasan.map((a) => {
      const x = pos.get(a.posId);
      return { mulai: a.mulai, sampai: tambahHari(tambahMinggu(a.mulai, a.minggu), -1), minggu: a.minggu, pos: x?.nama ?? "(pos dihapus)", lokasi: x?.lokasi ?? null, sekarang: a === blokIni };
    }),
    tugas: tugasYmd
      .filter((x) => x.senin >= seninAwal && x.senin <= r.sampai)
      .map((x) => serialTugasGuru({ ...x, predikat: predikat(x.nilai) }))
      .reverse(),
    sideQuest: serialSideQuest(
      progres.get(p.id) ?? null,
      misiSelesai.map((k) => ({ judul: k.misi.judul, kategoriLabel: labelKategori(k.misi.kategori, peta), tanggal: k.diputusAt ? toYmd(k.diputusAt) : null }))
    ),
    rapor: serialRaporRingkas(rapor),
  };
}

// ── Admin (dasbor, requireManager di rute) ─────────────────────────────────────────────────────────

const pilihTautanAdmin = {
  id: true,
  sekolahKunci: true,
  sekolahLabel: true,
  token: true,
  aktif: true,
  kedaluwarsa: true,
  tampilLampiranIzin: true,
  terakhirDibukaAt: true,
  dibukaKali: true,
  dicabutAt: true,
  createdAt: true,
} as const;

/**
 * Sekolah dari semua peserta (aktif & nonaktif; karyawan tidak dihapus), dikelompokkan dengan daftarSekolah():
 * jumlah anak, rentang mulai–selesai, nama guru pembimbing (tanpa kontak), tautan aktif (tanpa pinHash).
 */
export async function daftarSekolahAdmin() {
  const [peserta, tautan] = await Promise.all([
    prisma.magangPeserta.findMany({
      where: { employee: { deletedAt: null } },
      select: { sekolah: true, guruPembimbing: true, mulai: true, selesai: true, aktif: true },
    }),
    prisma.magangPantau.findMany({ select: pilihTautanAdmin, orderBy: { createdAt: "desc" } }),
  ]);
  const hari = hariIni();
  return daftarSekolah(peserta.map((p) => p.sekolah)).map((s) => {
    const anak = peserta.filter((p) => sekolahSama(p.sekolah, s.kunci));
    const guru = new Map<string, string>();
    for (const a of anak) {
      const n = (a.guruPembimbing ?? "").trim().replace(/\s+/g, " ");
      if (n && !guru.has(kunciSekolah(n))) guru.set(kunciSekolah(n), n);
    }
    const mulai = anak.map((a) => toYmd(a.mulai)).sort();
    const selesai = anak.map((a) => (a.selesai ? toYmd(a.selesai) : null)).filter((x): x is string => !!x).sort();
    const milik = tautan.filter((x) => x.sekolahKunci === s.kunci);
    const aktif = milik.find((x) => x.aktif && !x.dicabutAt) ?? null;
    return {
      kunci: s.kunci,
      label: s.label,
      jumlah: anak.length,
      jumlahAktif: anak.filter((a) => a.aktif).length,
      mulai: mulai[0] ?? null,
      selesai: selesai[selesai.length - 1] ?? null,
      guru: [...guru.values()],
      tautan: aktif ? serialTautanAdmin(aktif, hari) : null,
      riwayat: milik.filter((x) => x !== aktif).length,
    };
  });
}

export async function tautanAdmin(id: number) {
  const t = await prisma.magangPantau.findUnique({ where: { id }, select: pilihTautanAdmin });
  if (!t) return null;
  return serialTautanAdmin(t, hariIni());
}
