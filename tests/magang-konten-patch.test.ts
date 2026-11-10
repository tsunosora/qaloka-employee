/**
 * Regresi bug sunting-sebagian Jadwal Konten (fix/magang-konten-patch, 10 Nov 2026): kolom yang TIDAK dikirim
 * dalam PATCH dulu menjadi null (teksOpsional/tautanOpsional + `{...d}` di route) — sunting satu sel, ganti
 * status, atau "Tandai disetujui" menghapus judul/ref/caption/link/catatan baris itu. Juga `.partial()` zod 4
 * yang tetap mengisi `.default()` (konsep/status/grup).
 */
import { describe, it, expect } from "vitest";
import { dataUbahKonten, tanpaUndefined } from "@/lib/services/magang/konten";
import {
  ubahGrupKontenSchema,
  ubahKonsepSchema,
  ubahKontenAnakSchema,
  ubahKontenSchema,
  ubahStatusKontenSchema,
} from "@/lib/validators/magang-konten";

const TEKS = ["judul", "ref", "caption", "linkFootage", "linkEkspor", "catatan"] as const;

/** Baris tersimpan + update Prisma (kolom undefined = tidak ditulis, seperti Prisma). */
const BARIS = {
  konsepId: 1,
  pesertaId: 4,
  grupId: null as number | null,
  statusId: 1,
  judul: "Behind the scene mesin cetak",
  ref: "https://instagram.com/p/abc",
  caption: "Caption panjang #voliko",
  linkFootage: "https://drive.google.com/footage",
  linkEkspor: "https://drive.google.com/ekspor",
  catatan: "Pakai lighting kanan",
  usulan: true,
  selesaiAt: null as Date | null,
};
function terapkan(body: unknown, status: { final: boolean } | null = null) {
  const { tanggal: _t, ...d } = ubahKontenSchema.parse(body);
  void _t;
  const data = dataUbahKonten(d, status, BARIS.selesaiAt, new Date("2026-11-10T10:00:00Z"));
  return { ...BARIS, ...tanpaUndefined(data) };
}

describe("ubahKontenSchema — tidak dikirim = tidak diubah", () => {
  it("parse({statusId}) tidak membawa kolom teks", () => {
    const r = ubahKontenSchema.parse({ statusId: 2 });
    for (const k of TEKS) expect(r[k], k).toBeUndefined();
    expect(Object.keys(tanpaUndefined(r))).toEqual(["statusId"]);
  });
  it("parse({usulan:false}) hanya usulan", () => {
    expect(tanpaUndefined(ubahKontenSchema.parse({ usulan: false }))).toEqual({ usulan: false });
  });
  it("null / \"\" / spasi = dikosongkan; teks di-trim", () => {
    const r = ubahKontenSchema.parse({ judul: null, caption: "", catatan: "   ", ref: "  https://a.id/x  " });
    expect(r).toMatchObject({ judul: null, caption: null, catatan: null, ref: "https://a.id/x" });
  });
  it("tautan bukan http(s) tetap ditolak", () => {
    expect(ubahKontenSchema.safeParse({ linkEkspor: "drive.google.com/x" }).success).toBe(false);
  });
  it("anak + grup sekaligus tetap ditolak", () => {
    expect(ubahKontenSchema.safeParse({ pesertaId: 1, grupId: 2 }).success).toBe(false);
  });
});

describe("dataUbahKonten — kolom lain baris tetap", () => {
  const tetapTeks = (hasil: Record<string, unknown>) => {
    for (const k of TEKS) expect(hasil[k], k).toBe(BARIS[k]);
  };
  it("hanya statusId (bukan final) → teks tetap, selesaiAt kosong", () => {
    const h = terapkan({ statusId: 2 }, { final: false });
    tetapTeks(h);
    expect(h).toMatchObject({ statusId: 2, selesaiAt: null, konsepId: 1, pesertaId: 4, usulan: true });
  });
  it("statusId final → selesaiAt diisi, teks tetap", () => {
    const h = terapkan({ statusId: 3 }, { final: true });
    tetapTeks(h);
    expect(h.selesaiAt).toEqual(new Date("2026-11-10T10:00:00Z"));
  });
  it("hanya konsepId → teks, status, anak tetap", () => {
    const h = terapkan({ konsepId: 2 });
    tetapTeks(h);
    expect(h).toMatchObject({ konsepId: 2, statusId: 1, pesertaId: 4, grupId: null });
    expect("selesaiAt" in dataUbahKonten({ konsepId: 2 }, null, null)).toBe(false);
  });
  it("Tandai disetujui ({usulan:false}) → hanya usulan berubah", () => {
    const h = terapkan({ usulan: false });
    tetapTeks(h);
    expect(h.usulan).toBe(false);
  });
  it("pesertaId → grupId dikosongkan, teks tetap", () => {
    const h = terapkan({ pesertaId: 7 });
    tetapTeks(h);
    expect(h).toMatchObject({ pesertaId: 7, grupId: null });
  });
  it("grupId → pesertaId dikosongkan; tanpa keduanya → anak/grup tidak disentuh", () => {
    expect(terapkan({ grupId: 2 })).toMatchObject({ grupId: 2, pesertaId: null });
    const d = dataUbahKonten(ubahKontenSchema.parse({ judul: "x" }), null, null);
    expect(d).toEqual({ judul: "x" });
  });
  it("satu sel teks → hanya kolom itu", () => {
    const h = terapkan({ caption: "Caption baru" });
    expect(h.caption).toBe("Caption baru");
    for (const k of TEKS.filter((k) => k !== "caption")) expect(h[k], k).toBe(BARIS[k]);
  });
  it("null / \"\" eksplisit → dikosongkan", () => {
    const h = terapkan({ judul: "", linkFootage: null });
    expect(h).toMatchObject({ judul: null, linkFootage: null, caption: BARIS.caption, linkEkspor: BARIS.linkEkspor });
  });
});

describe("ubahKontenAnakSchema (HP anak)", () => {
  it("hanya statusId → judul & tautan tidak ikut", () => {
    expect(tanpaUndefined(ubahKontenAnakSchema.parse({ statusId: 2 }))).toEqual({ statusId: 2 });
  });
  it("null / \"\" mengosongkan; kolom pembina tetap ditolak", () => {
    expect(ubahKontenAnakSchema.parse({ judul: "", linkFootage: null, linkEkspor: " https://a.id/e " })).toEqual({
      judul: null,
      linkFootage: null,
      linkEkspor: "https://a.id/e",
    });
    expect(ubahKontenAnakSchema.safeParse({ caption: "x" }).success).toBe(false);
  });
});

describe("skema ubah konsep / status / grup — tanpa nilai bawaan", () => {
  it("konsep: PATCH {referensi} (panel brief) tidak mengubah warna/aktif/sub", () => {
    expect(tanpaUndefined(ubahKonsepSchema.parse({ referensi: [] }))).toEqual({ referensi: [] });
    expect(tanpaUndefined(ubahKonsepSchema.parse({ nama: "Promo" }))).toEqual({ nama: "Promo" });
    expect(ubahKonsepSchema.parse({ sub: "" }).sub).toBeNull();
  });
  it("status: PATCH {nama} tidak menyetel warna/aktif/anakBoleh/final", () => {
    expect(tanpaUndefined(ubahStatusKontenSchema.parse({ nama: "Revisi" }))).toEqual({ nama: "Revisi" });
  });
  it("grup: PATCH {nama} tidak mengosongkan anggota", () => {
    const r = ubahGrupKontenSchema.parse({ nama: "GRUB A" });
    expect(r.anggota).toBeUndefined();
    expect(tanpaUndefined(r)).toEqual({ nama: "GRUB A" });
    expect(ubahGrupKontenSchema.parse({ anggota: [] }).anggota).toEqual([]);
  });
});
