import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  POLA_BAWAAN,
  dataArsipPlatform,
  geserUrutan,
  kunciPlatformUnik,
  namaPlatformBentrok,
  putusanHapusPlatform,
  referensiEfektif,
  ringkasKontenPlatform,
  susunRencana,
  tanpaUndefined,
  urutanPlatformBaru,
  type BarisGenerator,
  type MasukanRencana,
} from "@/lib/services/magang/konten";
import { serialisasiBarisAnak } from "@/lib/services/magang/konten-db";
import { serialKontenGuru, kunciBocor } from "@/lib/services/magang/pantau";
import { briefPlatformSchema, buatBulanSchema, kontenBaruSchema, platformSchema, ubahPlatformSchema, uraiBrief } from "@/lib/validators/magang-konten";
import { PLATFORM_VOLIKO, rencanaPlatformVoliko } from "@/tools/magang/voliko-platform-konten";

const MIGRASI = "prisma/migrations/20261113000000_magang_konten_platform/migration.sql";

describe("migrasi 20261113000000_magang_konten_platform", () => {
  const sql = readFileSync(MIGRASI, "utf8");
  const tanpaKomentar = sql.replace(/^--.*$/gm, "");

  it("membuat Voliko Print dengan INSERT IGNORE (kunci voliko-print, urutan 1, aktif)", () => {
    expect(tanpaKomentar).toMatch(/INSERT IGNORE INTO `MagangKontenPlatform`[\s\S]*'Voliko Print', 'voliko-print', '[a-z]+', '[a-z]+', 1, true/);
  });

  it("platformId: kolom NULL → UPDATE … WHERE platformId IS NULL → NOT NULL → indeks + FK RESTRICT (urutan benar)", () => {
    const tambah = tanpaKomentar.indexOf("ADD COLUMN `platformId` INTEGER NULL");
    const isi = tanpaKomentar.search(/UPDATE `MagangKonten`\s+SET `platformId` = \(SELECT `id` FROM `MagangKontenPlatform` WHERE `kunci` = 'voliko-print'\)\s+WHERE `platformId` IS NULL/);
    const wajib = tanpaKomentar.indexOf("MODIFY `platformId` INTEGER NOT NULL");
    const fk = tanpaKomentar.indexOf("FOREIGN KEY (`platformId`) REFERENCES `MagangKontenPlatform`(`id`) ON DELETE RESTRICT");
    expect(tambah).toBeGreaterThan(0);
    expect(isi).toBeGreaterThan(tambah);
    expect(wajib).toBeGreaterThan(isi);
    expect(fk).toBeGreaterThan(wajib);
    expect(tanpaKomentar).toMatch(/CREATE INDEX `MagangKonten_platformId_tanggal_idx`/);
  });

  it("brief Setting disalin hanya bila brief platform masih NULL dan JSON sah; Setting & konten tidak dihapus", () => {
    expect(tanpaKomentar).toMatch(/s\.`key` = 'magang_konten_brief'/);
    expect(tanpaKomentar).toMatch(/p\.`brief` IS NULL/);
    expect(tanpaKomentar).toMatch(/JSON_VALID\(s\.`value`\)/);
    expect(tanpaKomentar).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(tanpaKomentar.replace(/ON DELETE RESTRICT/g, "")).not.toMatch(/\bDELETE\b/i);
    expect(tanpaKomentar).not.toMatch(/\bDROP\b/i);
    expect(tanpaKomentar).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe("platform — hapus, arsip, urutan, nama", () => {
  it("hapus ditolak 409 + jumlah bila dipakai; boleh bila 0", () => {
    expect(putusanHapusPlatform(0)).toEqual({ boleh: true });
    const p = putusanHapusPlatform(24);
    expect(p.boleh).toBe(false);
    if (!p.boleh) {
      expect(p.status).toBe(409);
      expect(p.body.dipakai).toBe(24);
      expect(p.body.message).toMatch(/Arsipkan/);
    }
  });

  it("rute DELETE memakai hapusPlatform (hitung baris → 409) dan rute arsip memakai dataArsipPlatform", () => {
    expect(readFileSync("app/api/magang/konten/platform/[id]/route.ts", "utf8")).toMatch(/hapusPlatform\(prisma, id\)/);
    expect(readFileSync("lib/services/magang/konten-db.ts", "utf8")).toMatch(/magangKonten\.count\(\{ where: \{ platformId: id \} \}\)/);
    expect(readFileSync("app/api/magang/konten/platform/[id]/arsip/route.ts", "utf8")).toMatch(/dataArsipPlatform\(true\)/);
    expect(readFileSync("app/api/magang/konten/platform/[id]/buka-arsip/route.ts", "utf8")).toMatch(/dataArsipPlatform\(false\)/);
  });

  it("arsip = aktif false + diarsipkanAt; buka arsip = aktif true + diarsipkanAt null", () => {
    const t = new Date("2026-11-13T03:00:00Z");
    expect(dataArsipPlatform(true, t)).toEqual({ aktif: false, diarsipkanAt: t });
    expect(dataArsipPlatform(false, t)).toEqual({ aktif: true, diarsipkanAt: null });
  });

  it("nama unik tanpa peduli huruf besar/spasi; kunci slug tetap & unik", () => {
    const ada = [
      { id: 1, nama: "Voliko Print" },
      { id: 2, nama: "Exindo" },
    ];
    expect(namaPlatformBentrok("  voliko   PRINT ", ada)).toBe(true);
    expect(namaPlatformBentrok("Voliko Print", ada, 1)).toBe(false); // ganti nama diri sendiri
    expect(namaPlatformBentrok("Voliko Sport", ada)).toBe(false);
    expect(kunciPlatformUnik("Epic Jogja", ["voliko-print"])).toBe("epic-jogja");
    expect(kunciPlatformUnik("Exindo", ["exindo"])).toBe("exindo-2");
  });

  it("urutan: harus berisi semua id tepat sekali; naik/turun menukar tetangga", () => {
    expect(urutanPlatformBaru([3, 1, 2], [1, 2, 3])).toEqual([
      { id: 3, urutan: 1 },
      { id: 1, urutan: 2 },
      { id: 2, urutan: 3 },
    ]);
    expect(urutanPlatformBaru([1, 2], [1, 2, 3])).toBeNull();
    expect(urutanPlatformBaru([1, 1, 2], [1, 2, 3])).toBeNull();
    expect(urutanPlatformBaru([1, 2, 9], [1, 2, 3])).toBeNull();
    expect(geserUrutan([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(geserUrutan([1, 2, 3], 3, 1)).toEqual([1, 2, 3]);
  });
});

describe("platform — PATCH sebagian tidak mengembalikan nilai bawaan", () => {
  it("{nama} saja → hanya nama (warna/ikon/urutan tidak tersentuh)", () => {
    const r = ubahPlatformSchema.parse({ nama: "  Exindo Baru " });
    expect(tanpaUndefined(r)).toEqual({ nama: "Exindo Baru" });
  });
  it("{} → kosong; {ikon:null} → hapus ikon saja; {warna} → warna saja", () => {
    expect(tanpaUndefined(ubahPlatformSchema.parse({}))).toEqual({});
    expect(tanpaUndefined(ubahPlatformSchema.parse({ ikon: null }))).toEqual({ ikon: null });
    expect(tanpaUndefined(ubahPlatformSchema.parse({ warna: "biru" }))).toEqual({ warna: "biru" });
  });
  it("aktif/arsip/brief tidak bisa lewat PATCH (strict) — hanya lewat rute arsip & brief", () => {
    expect(ubahPlatformSchema.safeParse({ aktif: false }).success).toBe(false);
    expect(ubahPlatformSchema.safeParse({ brief: {} }).success).toBe(false);
  });
  it("buat platform: nama wajib ≥2 huruf, warna bawaan putih, ikon dari daftar", () => {
    expect(platformSchema.parse({ nama: "Xposer" })).toMatchObject({ nama: "Xposer", warna: "putih" });
    expect(platformSchema.safeParse({ nama: "X" }).success).toBe(false);
    expect(platformSchema.safeParse({ nama: "Xposer", ikon: "myspace" }).success).toBe(false);
  });
  it("baris baru & buat jadwal wajib platformId", () => {
    expect(kontenBaruSchema.safeParse({ tanggal: "2026-11-16", konsepId: 1 }).success).toBe(false);
    expect(kontenBaruSchema.safeParse({ platformId: 1, tanggal: "2026-11-16", konsepId: 1 }).success).toBe(true);
    expect(buatBulanSchema.safeParse({ bulan: "2026-12" }).success).toBe(false);
    expect(buatBulanSchema.parse({ platformId: 2, bulan: "2026-12" })).toMatchObject({ platformId: 2, ganti: false, simpan: false });
  });
});

describe("brief per platform", () => {
  const lama = { drive: [{ label: "1. VOLIKO PRINT", url: "" }], catatan: "Absen di Xposer", font: "Rubik", preset: "Outline black", caption: "Halo\n\n💬 tanya", hashtag: "#contoh" };

  it("JSON Setting lama (teks) & kolom Json (objek) terbaca sama; referensi bawaan {}", () => {
    const a = uraiBrief(JSON.stringify(lama));
    const b = uraiBrief(lama);
    expect(a).toEqual({ ...lama, referensi: {} });
    expect(b).toEqual(a);
    expect(uraiBrief(null)).toMatchObject({ caption: "", referensi: {} });
    expect(uraiBrief("{rusak")).toMatchObject({ caption: "", referensi: {} });
  });

  it("referensi per konsep: kunci id konsep, tautan http(s) saja", () => {
    expect(briefPlatformSchema.safeParse({ ...lama, referensi: { "3": [{ label: "Contoh", url: "https://www.tiktok.com/@x/video/1" }] } }).success).toBe(true);
    expect(briefPlatformSchema.safeParse({ ...lama, referensi: { sitkom: [] } }).success).toBe(false);
    expect(briefPlatformSchema.safeParse({ ...lama, referensi: { "3": [{ label: "x", url: "javascript:alert(1)" }] } }).success).toBe(false);
  });

  it("referensi efektif: khusus platform bila tidak kosong, selain itu bawaan konsep", () => {
    const bawaan = [{ label: "IG", url: "https://www.instagram.com/p/a/" }];
    const khusus = { "1": [{ label: "TikTok", url: "https://www.tiktok.com/@x" }], "2": [] };
    expect(referensiEfektif(bawaan, khusus, 1)).toEqual({ referensi: khusus["1"], sumber: "platform" });
    expect(referensiEfektif(bawaan, khusus, 2)).toEqual({ referensi: bawaan, sumber: "bawaan" });
    expect(referensiEfektif(bawaan, null, 3)).toEqual({ referensi: bawaan, sumber: "bawaan" });
  });
});

describe("generator per platform", () => {
  const A = 101;
  const B = 102;
  const C = 103;
  const VP = 1; // Voliko Print
  const EX = 2; // Exindo
  const konsep = [
    { id: 11, kunci: "sitkom", aktif: true },
    { id: 12, kunci: "flexing", aktif: true },
    { id: 13, kunci: "talk", aktif: true },
    { id: 14, kunci: "empathy", aktif: true },
  ];
  const idKonsep = Object.fromEntries(konsep.map((k) => [k.kunci, k.id]));
  const anak = [1, 2, 3, 4].map((k) => ({ pesertaId: 200 + k, kode: k, aktif: true }));
  let n = 0;
  const baris = (platformId: number, tanggal: string, k: string, kode: number | null, grupId: number | null = null): BarisGenerator => ({
    id: ++n,
    platformId,
    tanggal,
    konsepId: idKonsep[k],
    pesertaId: kode != null ? 200 + kode : null,
    grupId,
    statusId: 2,
  });
  const dasar = (b: BarisGenerator[], platformId = VP): MasukanRencana => ({
    bulan: "2026-12",
    ganti: false,
    platformId,
    konsep,
    status: [
      { id: 1, kunci: "belum-take", aktif: true, final: false },
      { id: 2, kunci: "selesai", aktif: true, final: true },
    ],
    grup: [
      { id: A, aktif: true },
      { id: B, aktif: true },
      { id: C, aktif: true },
    ],
    anak,
    pola: POLA_BAWAAN,
    libur: [],
    baris: b,
  });

  // Riwayat Voliko Print: kode terakhir 2 (Jum 27 Nov), EMPATHY terakhir GRUB B Sab 28 Nov.
  const riwayatVP = [baris(VP, "2026-11-26", "flexing", 1), baris(VP, "2026-11-27", "talk", 2), baris(VP, "2026-11-28", "empathy", null, B)];
  // Exindo punya riwayat berbeda: kode terakhir 4, EMPATHY terakhir GRUB C 21 Nov; plus baris Desember.
  const riwayatEX = [baris(EX, "2026-11-20", "talk", 4), baris(EX, "2026-11-21", "empathy", null, C), baris(EX, "2026-12-01", "flexing", 3), baris(EX, "2026-12-02", "sitkom", 4)];

  it("baris platform lain tidak memengaruhi giliran kode, giliran grup, maupun tanggal terisi", () => {
    const sendiri = susunRencana(dasar(riwayatVP));
    const campur = susunRencana(dasar([...riwayatVP, ...riwayatEX]));
    expect(campur).toEqual(sendiri);
    // Lanjut dari kode 2 (Voliko Print) → Selasa 1 Des kode 3; tanggal 1–2 Des Exindo tidak dianggap terisi.
    expect(campur.baris[0]).toMatchObject({ tanggal: "2026-12-01", kode: 3 });
    expect(campur.baris.find((b) => b.tanggal === "2026-12-02")).toMatchObject({ kode: 4 });
    // EMPATHY Voliko Print: 28 Nov + 14 = Sabtu 12 Des, grup sesudah B = C.
    expect(campur.baris.find((b) => b.grupId != null)).toMatchObject({ tanggal: "2026-12-12", grupId: C });
    expect(campur.platformId).toBe(VP);
  });

  it("platform lain memakai riwayatnya sendiri", () => {
    const r = susunRencana(dasar([...riwayatVP, ...riwayatEX], EX));
    // 1–2 Des sudah ada di Exindo (kode 3, 4) → dilewati; Kamis 3 Des lanjut dari 4 → 1.
    expect(r.dilewati.filter((d) => d.alasan === "sudah-ada").map((d) => d.tanggal)).toEqual(["2026-12-01", "2026-12-02"]);
    expect(r.baris[0]).toMatchObject({ tanggal: "2026-12-03", kode: 1 });
    // EMPATHY Exindo: 21 Nov + 14 = 5 Des, grup sesudah C = A.
    expect(r.baris.find((b) => b.grupId != null)).toMatchObject({ tanggal: "2026-12-05", grupId: A });
  });

  it("platform baru tanpa riwayat: mulai kode terkecil, hari grup Sabtu kedua grup pertama", () => {
    const r = susunRencana(dasar([...riwayatVP, ...riwayatEX], 3));
    expect(r.baris[0]).toMatchObject({ tanggal: "2026-12-01", kode: 1 });
    expect(r.baris.find((b) => b.grupId != null)).toMatchObject({ tanggal: "2026-12-12", grupId: A });
  });

  it("ganti hanya menghapus baris platform ini yang belum dikerjakan", () => {
    const desVP = { ...baris(VP, "2026-12-03", "flexing", 1), statusId: 1 };
    const desEX = { ...baris(EX, "2026-12-04", "talk", 2), statusId: 1 };
    const r = susunRencana({ ...dasar([...riwayatVP, desVP, desEX]), ganti: true });
    expect(r.hapus).toEqual([desVP.id]);
  });
});

describe("label platform di HP anak & pantauan guru", () => {
  const konsep = new Map([[11, { id: 11, kunci: "sitkom", nama: "ENTERTAIMENT", sub: "SITKOM", label: "ENTERTAIMENT (SITKOM)", warna: "pink", referensi: [{ label: "IG", url: "https://www.instagram.com/p/a/" }], urutan: 1, aktif: true }]]);
  const status = new Map([[1, { id: 1, kunci: "belum-take", nama: "Belum take", warna: "abu", urutan: 1, aktif: true, anakBoleh: true, final: false }]]);
  type Pf = { id: number; nama: string; warna: string; ikon: string | null; brief: { referensi: Record<string, { label: string; url: string }[]> } };
  const platform = new Map<number, Pf>([
    [1, { id: 1, nama: "Voliko Print", warna: "putih", ikon: "instagram", brief: { referensi: {} } }],
    [2, { id: 2, nama: "Exindo", warna: "biru", ikon: null, brief: { referensi: { "11": [{ label: "TikTok Exindo", url: "https://www.tiktok.com/@exindo" }] } } }],
  ]);
  const b = {
    id: 5,
    platformId: 2,
    tanggal: new Date(2026, 10, 16),
    konsepId: 11,
    pesertaId: 3,
    grupId: null,
    statusId: 1,
    judul: null,
    ref: null,
    caption: null,
    linkFootage: null,
    linkEkspor: null,
    catatan: null,
    usulan: true,
    selesaiAt: null,
  };

  it("baris anak membawa nama platform (tanpa brief mentah) dan referensi khusus platformnya", () => {
    const out = serialisasiBarisAnak(b, konsep, status, new Map(), platform);
    expect(out.platform).toEqual({ id: 2, nama: "Exindo", warna: "biru", ikon: null });
    expect(out.konsep.referensi).toEqual([{ label: "TikTok Exindo", url: "https://www.tiktok.com/@exindo" }]);
    const vp = serialisasiBarisAnak({ ...b, platformId: 1 }, konsep, status, new Map(), platform);
    expect(vp.platform.nama).toBe("Voliko Print");
    expect(vp.konsep.referensi).toEqual([{ label: "IG", url: "https://www.instagram.com/p/a/" }]);
    expect(Object.keys(out)).not.toContain("platformId");
  });

  it("rute HP anak mengirim brief per platform dan label platform per baris", () => {
    const get = readFileSync("app/api/public/portal/[token]/magang/konten/route.ts", "utf8");
    expect(get).toMatch(/muatPlatformAnak\(prisma, baris\.map\(\(b\) => b\.platformId\)\)/);
    expect(get).toMatch(/serialisasiBarisAnak\(b, petaKonsep, petaStatus, petaGrup, platform\)/);
  });

  it("guru: hitungan per platform (nama + angka saja), tidak membocorkan isi baris", () => {
    const masuk = [
      { platform: { nama: "Exindo", urutan: 2 }, status: { final: false }, judul: "rahasia", catatan: "internal", linkFootage: "https://x" },
      { platform: { nama: "Voliko Print", urutan: 1 }, status: { final: true }, judul: "x", catatan: "y" },
      { platform: { nama: "Voliko Print", urutan: 1 }, status: { final: false } },
    ];
    const out = serialKontenGuru(masuk);
    expect(out).toEqual({
      terjadwal: 3,
      selesai: 1,
      perPlatform: [
        { platform: "Voliko Print", terjadwal: 2, selesai: 1 },
        { platform: "Exindo", terjadwal: 1, selesai: 0 },
      ],
    });
    expect(kunciBocor(out)).toEqual([]);
    expect(JSON.stringify(out)).not.toMatch(/rahasia|internal|catatan|judul|https/);
    expect(ringkasKontenPlatform([])).toEqual({ terjadwal: 0, selesai: 0, perPlatform: [] });
  });
});

describe("skrip data Voliko: platform kosong (dry-run murni)", () => {
  const vp = { id: 1, kunci: "voliko-print", nama: "Voliko Print" };

  it("DB sesudah migrasi: 4 platform dibuat urutan 2–5", () => {
    const r = rencanaPlatformVoliko([vp]);
    expect(r.masalah).toEqual([]);
    expect(r.aksi.map((a) => [a.nama, a.urutan, a.aksi])).toEqual([
      ["Exindo", 2, "buat"],
      ["Xposer", 3, "buat"],
      ["Epic Jogja", 4, "buat"],
      ["Voliko Sport", 5, "buat"],
    ]);
  });

  it("idempoten: dijalankan ulang sesudah diterapkan → 0 dibuat", () => {
    const sesudah = [vp, ...PLATFORM_VOLIKO.map((p, i) => ({ id: 10 + i, kunci: p.kunci, nama: p.nama }))];
    expect(rencanaPlatformVoliko(sesudah).aksi.every((a) => a.aksi === "ada")).toBe(true);
  });

  it("nama sudah dipakai platform lain (mis. dibuat pembina lewat UI) → dilewati, bukan dobel", () => {
    const r = rencanaPlatformVoliko([vp, { id: 7, kunci: "exindo-official", nama: "EXINDO" }]);
    expect(r.aksi[0]).toMatchObject({ nama: "Exindo", aksi: "nama-bentrok" });
    expect(r.aksi.filter((a) => a.aksi === "buat")).toHaveLength(3);
  });

  it("Voliko Print tidak ada (migrasi belum jalan) → batal", () => {
    expect(rencanaPlatformVoliko([]).masalah[0]).toMatch(/voliko-print/);
  });
});
