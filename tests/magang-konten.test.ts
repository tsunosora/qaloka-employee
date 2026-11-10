import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  POLA_BAWAAN,
  bolehDiganti,
  cekUbahAnak,
  hariKe,
  hexWarna,
  kodeTampil,
  labelKonsep,
  milikAnak,
  namaPkl,
  namaTanggal,
  selesaiAtBaru,
  susunBulan,
  susunPekan,
  tanggalBulan,
  tautanPendek,
  tautanSah,
  warnaSelKode,
  type BarisAda,
  type InputSusun,
} from "@/lib/services/magang/konten";
import { briefSchema, kodeAnakSchema, kontenBaruSchema, polaSchema, ubahKontenAnakSchema, uraiBrief } from "@/lib/validators/magang-konten";

const A = 101;
const B = 102;
const C = 103;

const dasar = (ubah: Partial<InputSusun> = {}): InputSusun => ({
  bulan: "2026-11",
  kode: [1, 2, 3, 4],
  grupUrut: [A, B],
  polaHari: POLA_BAWAAN.hari,
  empathyKonsep: "empathy",
  mulaiKodeSetelah: null,
  empathyTerakhir: { tanggal: "2026-10-31", grupId: B },
  libur: new Set(),
  ...ubah,
});

/** "2 SITKOM 1" / "14 EMPATHY GRUB A" — bentuk yang sama dengan daftar di sheet pembina. */
const ringkas = (b: { tanggal: string; konsep: string; kode: number | null; grupId: number | null }) =>
  `${Number(b.tanggal.slice(8))} ${b.konsep.toUpperCase()} ${b.grupId != null ? `GRUB ${{ [A]: "A", [B]: "B", [C]: "C" }[b.grupId]}` : b.kode}`;

describe("jadwal konten — generator susunBulan", () => {
  it("meniru pola November pembina mulai 2 Nov (kode 1–4, grup A/B)", () => {
    const r = susunBulan(dasar());
    expect(r.baris.slice(0, 24).map(ringkas)).toEqual([
      "2 SITKOM 1", "3 FLEXING 2", "4 SITKOM 3", "5 FLEXING 4", "6 TALK 1", "7 FLEXING 2",
      "9 SITKOM 3", "10 FLEXING 4", "11 SITKOM 1", "12 FLEXING 2", "13 TALK 3", "14 EMPATHY GRUB A",
      "16 SITKOM 4", "17 FLEXING 1", "18 SITKOM 2", "19 FLEXING 3", "20 TALK 4", "21 FLEXING 1",
      "23 SITKOM 2", "24 FLEXING 3", "25 SITKOM 4", "26 FLEXING 1", "27 TALK 2", "28 EMPATHY GRUB B",
    ]);
    // Senin 30 Nov melanjutkan giliran; Minggu tidak pernah dijadwalkan.
    expect(r.baris.map(ringkas)[24]).toBe("30 SITKOM 3");
    expect(r.baris.every((b) => hariKe(b.tanggal) !== 0)).toBe(true);
  });

  it("tanpa EMPATHY sebelumnya: hari grup pertama = Sabtu kedua, grup pertama (sama dengan sheet)", () => {
    const r = susunBulan(dasar({ empathyTerakhir: null }));
    expect(r.baris.filter((b) => b.grupId != null).map(ringkas)).toEqual(["14 EMPATHY GRUB A", "28 EMPATHY GRUB B"]);
  });

  it("usulan 16–28 Nov dengan 7 anak melanjutkan baris 2–14 yang sudah ada; Desember → GRUB C di 12 Des", () => {
    const sheet: [string, number | null, number | null][] = [
      ["02", 1, null], ["03", 2, null], ["04", 3, null], ["05", 4, null], ["06", 1, null], ["07", 2, null],
      ["09", 3, null], ["10", 4, null], ["11", 1, null], ["12", 2, null], ["13", 3, null], ["14", null, A],
    ];
    const ada = new Map<string, BarisAda[]>(sheet.map(([d, kode, grupId]) => [`2026-11-${d}`, [{ kode, grupId, empathy: grupId != null }]]));
    const r = susunBulan(dasar({ kode: [1, 2, 3, 4, 5, 6, 7], grupUrut: [A, B, C], ada, empathyTerakhir: null }));
    expect(r.baris.filter((b) => b.tanggal <= "2026-11-28").map(ringkas)).toEqual([
      "16 SITKOM 4", "17 FLEXING 5", "18 SITKOM 6", "19 FLEXING 7", "20 TALK 1", "21 FLEXING 2",
      "23 SITKOM 3", "24 FLEXING 4", "25 SITKOM 5", "26 FLEXING 6", "27 TALK 7", "28 EMPATHY GRUB B",
    ]);
    expect(r.dilewati.filter((d) => d.alasan === "sudah-ada")).toHaveLength(12);

    const des = susunBulan(dasar({ bulan: "2026-12", kode: [1, 2, 3, 4, 5, 6, 7], grupUrut: [A, B, C], mulaiKodeSetelah: 1, empathyTerakhir: { tanggal: "2026-11-28", grupId: B } }));
    expect(des.baris.filter((b) => b.grupId != null).map(ringkas)).toEqual(["12 EMPATHY GRUB C", "26 EMPATHY GRUB A"]);
    expect(ringkas(des.baris[0])).toBe("1 FLEXING 2"); // Selasa 1 Des, lanjut sesudah kode 1 (30 Nov)
  });

  it("hari grup tidak memakan giliran anak; libur & Minggu dilewati tanpa memakan giliran", () => {
    const r = susunBulan(dasar({ libur: new Set(["2026-11-03"]) }));
    expect(r.dilewati).toContainEqual({ tanggal: "2026-11-03", alasan: "libur" });
    expect(r.baris.slice(0, 3).map(ringkas)).toEqual(["2 SITKOM 1", "4 SITKOM 2", "5 FLEXING 3"]);
  });

  it("Sabtu grup yang libur → hari grup pindah ke Sabtu berikutnya", () => {
    const r = susunBulan(dasar({ libur: new Set(["2026-11-14"]) }));
    expect(r.baris.filter((b) => b.grupId != null).map((b) => b.tanggal)).toEqual(["2026-11-21"]);
  });

  it("bulan-bulan tanpa jadwal di antaranya: irama 14 hari tetap terjaga", () => {
    const r = susunBulan(dasar({ bulan: "2027-01", empathyTerakhir: { tanggal: "2026-11-28", grupId: B } }));
    // 28 Nov + 14k → 9 Jan & 23 Jan 2027
    expect(r.baris.filter((b) => b.grupId != null).map((b) => b.tanggal)).toEqual(["2027-01-09", "2027-01-23"]);
  });

  it("tanpa kode anak → baris tetap dibuat tanpa anak (belum dibagi); tanpa grup → tidak ada hari grup", () => {
    const r = susunBulan(dasar({ kode: [], grupUrut: [] }));
    expect(r.baris.every((b) => b.kode === null && b.grupId === null)).toBe(true);
    expect(r.baris.some((b) => b.konsep === "empathy")).toBe(false);
  });

  it("kode berputar melanjutkan bulan lalu; kode yang tak ada lagi → kode berikutnya yang lebih besar", () => {
    expect(susunBulan(dasar({ mulaiKodeSetelah: 4 })).baris[0].kode).toBe(1);
    expect(susunBulan(dasar({ kode: [1, 3, 5], mulaiKodeSetelah: 2 })).baris[0].kode).toBe(3);
  });

  it("menjalankan ulang dengan semua tanggal terisi tidak membuat apa pun (tanpa duplikat)", () => {
    const pertama = susunBulan(dasar());
    const ada = new Map<string, BarisAda[]>(pertama.baris.map((b) => [b.tanggal, [{ kode: b.kode, grupId: b.grupId, empathy: b.grupId != null }]]));
    expect(susunBulan(dasar({ ada })).baris).toHaveLength(0);
  });
});

describe("jadwal konten — tampilan", () => {
  it("tanggal & label seperti sheet", () => {
    expect(namaTanggal("2026-11-02")).toBe("Senin, 02 November 2026");
    expect(namaTanggal("2026-11-08")).toBe("Minggu, 08 November 2026");
    expect(labelKonsep({ nama: "ENTERTAIMENT", sub: "SITKOM" })).toBe("ENTERTAIMENT (SITKOM)");
    expect(labelKonsep({ nama: "LAIN", sub: " " })).toBe("LAIN");
  });

  it("pemisah tiap hari Minggu, Senin–Sabtu tetap tampil walau kosong, libur bernama", () => {
    const item = susunPekan("2026-11", [{ tanggal: "2026-11-02", urutan: 1, id: 2 }, { tanggal: "2026-11-02", urutan: 0, id: 5 }], new Map([["2026-11-17", "Libur contoh"]]));
    expect(item).toHaveLength(30);
    expect(item.filter((i) => i.jenis === "minggu").map((i) => i.tanggal)).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
    const senin = item[1];
    expect(senin.jenis === "hari" && senin.baris.map((b) => b.id)).toEqual([5, 2]);
    const libur = item.find((i) => i.tanggal === "2026-11-17");
    expect(libur?.jenis === "hari" && libur.libur).toBe("Libur contoh");
    expect(tanggalBulan("2027-02")).toHaveLength(28);
  });

  it("CODE & NAMA PKL dari kode anak / anggota grup", () => {
    const anak = [
      { pesertaId: 10, kode: 1, panggilan: "Anak Satu" },
      { pesertaId: 11, kode: 2, panggilan: "Anak Dua" },
    ];
    const grup = [{ id: A, nama: "GRUB A", anggota: [10, 11] }];
    expect(kodeTampil({ pesertaId: 11, grupId: null }, anak, grup)).toBe("2");
    expect(kodeTampil({ pesertaId: null, grupId: A }, anak, grup)).toBe("GRUB A");
    expect(kodeTampil({ pesertaId: null, grupId: null }, anak, grup)).toBe("");
    expect(namaPkl({ pesertaId: null, grupId: A }, anak, grup)).toBe("Anak Satu, Anak Dua");
  });

  it("warna: kunci palet / hex; sel CODE kuning untuk konsep tanpa warna, warna grup untuk baris grup", () => {
    expect(hexWarna("putih")).toBeNull();
    expect(hexWarna("#AABBCC")).toBe("#aabbcc");
    expect(hexWarna("tidak-ada")).toBeNull();
    expect(warnaSelKode("putih", null)).toBe(hexWarna("kuning"));
    expect(warnaSelKode("pink", null)).toBeNull();
    expect(warnaSelKode("putih", "merah")).toBe(hexWarna("merah"));
  });
});

describe("jadwal konten — tautan", () => {
  it("hanya http(s)", () => {
    expect(tautanSah("https://www.instagram.com/p/abc/")).toBe(true);
    expect(tautanSah("http://drive.google.com/x")).toBe(true);
    for (const salah of ["javascript:alert(1)", "data:text/html,hai", "ftp://x.y/z", "instagram.com/p/x", "https://a b.com", "", null]) expect(tautanSah(salah)).toBe(false);
    expect(tautanPendek("https://www.instagram.com/p/DaohSfOveLK/")).toBe("instagram.com/p/DaohSfOveLK");
  });

  it("validator menolak tautan bukan http(s) di baris & brief", () => {
    expect(kontenBaruSchema.safeParse({ platformId: 1, tanggal: "2026-11-02", konsepId: 1, linkFootage: "javascript:alert(1)" }).success).toBe(false);
    expect(kontenBaruSchema.safeParse({ platformId: 1, tanggal: "2026-11-02", konsepId: 1, linkFootage: "  " }).data?.linkFootage).toBeNull();
    expect(kontenBaruSchema.safeParse({ platformId: 1, tanggal: "2026-11-02", konsepId: 1, pesertaId: 1, grupId: 2 }).success).toBe(false);
    expect(kontenBaruSchema.safeParse({ platformId: 1, tanggal: "2026-02-30", konsepId: 1 }).success).toBe(false);
    expect(briefSchema.safeParse({ drive: [{ label: "x", url: "javascript:1" }] }).success).toBe(false);
  });
});

describe("jadwal konten — brief & pola", () => {
  it("brief: drive boleh tanpa URL (belum diketahui), isi rusak → brief kosong", () => {
    const r = briefSchema.parse({ drive: [{ label: "1. DRIVE", url: "" }], catatan: "Catatan", font: "Rubik", preset: "Outline", caption: "Teks", hashtag: "#a #b" });
    expect(r.drive[0]).toEqual({ label: "1. DRIVE", url: "" });
    // Brief lama (tanpa referensi) tetap terbaca; sejak multi-platform ada referensi khusus platform (bawaan {}).
    expect(uraiBrief(JSON.stringify(r))).toEqual({ ...r, referensi: {} });
    expect(uraiBrief("{bukan json")).toEqual({ drive: [], catatan: "", font: "", preset: "", caption: "", hashtag: "", referensi: {} });
    expect(uraiBrief(null).drive).toEqual([]);
  });

  it("pola: selang hari 7–56; kode anak unik", () => {
    expect(polaSchema.safeParse({ hari: { 1: "sitkom" }, empathy: "empathy", selangHari: 14 }).success).toBe(true);
    expect(polaSchema.safeParse({ hari: {}, empathy: null, selangHari: 3 }).success).toBe(false);
    expect(kodeAnakSchema.safeParse({ kode: [{ pesertaId: 1, kode: 1 }, { pesertaId: 2, kode: 1 }] }).success).toBe(false);
    expect(kodeAnakSchema.safeParse({ kode: [{ pesertaId: 1, kode: 2 }, { pesertaId: 2, kode: 1 }, { pesertaId: 3, kode: null }] }).success).toBe(true);
  });
});

describe("jadwal konten — anak (HP)", () => {
  const anak = { pesertaId: 7, grupIds: [A] };
  it("cakupan: baris kode sendiri & grupnya boleh; anak lain / grup lain / belum dibagi tidak", () => {
    expect(milikAnak({ pesertaId: 7, grupId: null }, anak)).toBe(true);
    expect(milikAnak({ pesertaId: null, grupId: A }, anak)).toBe(true);
    expect(milikAnak({ pesertaId: 8, grupId: null }, anak)).toBe(false);
    expect(milikAnak({ pesertaId: null, grupId: B }, anak)).toBe(false);
    expect(milikAnak({ pesertaId: null, grupId: null }, anak)).toBe(false);
  });

  it("anak tidak bisa memasang status final / bukan anakBoleh, dan tidak bisa mengubah baris final", () => {
    const final = { id: 4, aktif: true, anakBoleh: false, final: true };
    const editing = { id: 3, aktif: true, anakBoleh: true, final: false };
    const khususPembina = { id: 5, aktif: true, anakBoleh: false, final: false };
    expect(cekUbahAnak({ final: false }, editing)).toBeNull();
    expect(cekUbahAnak({ final: false }, null)).toBeNull();
    expect(cekUbahAnak({ final: false }, final)).toMatch(/pembina/);
    expect(cekUbahAnak({ final: false }, khususPembina)).toMatch(/tidak bisa/);
    expect(cekUbahAnak({ final: false }, { ...editing, aktif: false })).toMatch(/tidak bisa/);
    expect(cekUbahAnak({ final: true }, editing)).toMatch(/divalidasi pembina/);
    expect(cekUbahAnak({ final: true }, null)).toMatch(/divalidasi pembina/);
  });

  it("validator anak hanya menerima judul, dua tautan, status", () => {
    expect(ubahKontenAnakSchema.safeParse({ judul: "Judul", linkFootage: "https://drive.google.com/a", statusId: 2 }).success).toBe(true);
    expect(ubahKontenAnakSchema.safeParse({ caption: "x" }).success).toBe(false);
    expect(ubahKontenAnakSchema.safeParse({ pesertaId: 3 }).success).toBe(false);
    expect(ubahKontenAnakSchema.safeParse({ linkEkspor: "file:///etc/passwd" }).success).toBe(false);
  });

  it("selesaiAt: final mengisi (tanggal lama dipertahankan), bukan final mengosongkan", () => {
    const lama = new Date("2026-11-03T10:00:00Z");
    const kini = new Date("2026-11-05T10:00:00Z");
    expect(selesaiAtBaru(true, null, kini)).toBe(kini);
    expect(selesaiAtBaru(true, lama, kini)).toBe(lama);
    expect(selesaiAtBaru(false, lama, kini)).toBeNull();
  });

  it("ganti hanya menghapus baris yang belum dikerjakan", () => {
    expect(bolehDiganti({ statusId: 1 }, 1)).toBe(true);
    expect(bolehDiganti({ statusId: 2 }, 1)).toBe(false);
    expect(bolehDiganti({ statusId: 1, judul: "Ada judul" }, 1)).toBe(false);
    expect(bolehDiganti({ statusId: 1, linkEkspor: "https://x.y" }, 1)).toBe(false);
    expect(bolehDiganti({ statusId: 1, judul: "  " }, 1)).toBe(true);
  });

  it("rute HP memeriksa sesi PIN, pemilik (owner 403) dan cakupan anak", () => {
    const get = readFileSync("app/api/public/portal/[token]/magang/konten/route.ts", "utf8");
    const patch = readFileSync("app/api/public/portal/[token]/magang/konten/[id]/route.ts", "utf8");
    expect(get).toMatch(/requirePortalSession\(/);
    expect(get).toMatch(/whereMilikAnak\(/);
    expect(patch).toMatch(/requirePortalOwner\(/);
    expect(patch).toMatch(/whereMilikAnak\(/);
    expect(patch).toMatch(/cekUbahAnak\(/);
    expect(patch).toMatch(/status: \{ final: false \}/); // kunci optimis: baris yang baru divalidasi tidak tertimpa
  });

  it("rute pembina memakai requireManager", () => {
    for (const f of ["route.ts", "[id]/route.ts", "buat/route.ts", "konsep/route.ts", "status/route.ts", "grup/route.ts", "kode/route.ts", "pola/route.ts", "platform/route.ts", "platform/[id]/route.ts", "platform/[id]/brief/route.ts", "platform/[id]/arsip/route.ts", "platform/[id]/buka-arsip/route.ts", "platform/urutan/route.ts", "setujui/route.ts"]) {
      expect(readFileSync(`app/api/magang/konten/${f}`, "utf8"), f).toMatch(/requireManager\(\)/);
    }
  });
});
