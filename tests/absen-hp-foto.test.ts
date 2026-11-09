// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { kecilkan, pesanFotoGagal } from "@/components/absen/peramban";
import { barisLogTolak } from "@/lib/services/absen-hp/aturan";

// 9 Nov 2026: peserta magang tidak bisa absen ("foto tidak diterima") — tak ada jejak di server.
// jsdom tidak punya createImageBitmap/Image.decode/canvas → persis keadaan "peramban gagal mendekode".

const berkas = (tipe: string, bita: number) => new File([new Uint8Array(bita)], "f", { type: tipe });

describe("kecilkan — tidak buntu bila peramban gagal mendekode foto", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("createImageBitmap & <img> gagal → JPEG asli ≤6 MB tetap dikirim", async () => {
    vi.stubGlobal("createImageBitmap", () => Promise.reject(new Error("decode")));
    const f = berkas("image/jpeg", 1000);
    expect(await kecilkan(f)).toBe(f);
  });
  it("HEIC → galat foto_jenis + pesan HEIC yang jelas", async () => {
    const f = berkas("image/heic", 1000);
    const e = await kecilkan(f).catch((x) => x);
    expect(e.kode).toBe("foto_jenis");
    expect(pesanFotoGagal(e, f)).toMatch(/HEIC/);
  });
  it("JPEG > 6 MB yang tidak bisa diperkecil → foto_besar", async () => {
    const f = berkas("image/jpeg", 6 * 1024 * 1024 + 1);
    const e = await kecilkan(f).catch((x) => x);
    expect(e.kode).toBe("foto_besar");
    expect(pesanFotoGagal(e, f)).toMatch(/terlalu besar/);
  });
});

describe("barisLogTolak — bukti penolakan tanpa data pribadi", () => {
  it("memuat kode, jarak, akurasi, foto; tanpa koordinat", () => {
    const b = barisLogTolak({ employeeId: 34, kode: "di_luar", jarakM: 812.4, akurasiM: 35.6, lokasi: "Toko Pusat", fotoBita: 120000, fotoTipe: "image/jpeg", nowMs: 0 });
    expect(b).toBe('[absen-hp] TOLAK karyawan=34 kode=di_luar lokasi="Toko Pusat" jarak=812m akurasi=36m foto=120000B tipe=image/jpeg 1970-01-01T00:00:00.000Z');
  });
  it("akurasi kosong (NaN) tidak ditulis", () => {
    expect(barisLogTolak({ employeeId: 1, kode: "lokasi_kosong", akurasiM: NaN, nowMs: 0 })).not.toMatch(/akurasi/);
  });
  it("rute absen mencatat tiap penolakan & halaman menangani sesi habis", () => {
    const rute = readFileSync("app/api/public/absen/[token]/absen/route.ts", "utf8");
    for (const k of ["keputusan.kode", "luar:", '"tanpa_foto"', '"foto_besar"', '"bukan_gambar"']) expect(rute).toContain(`tolak(${k.startsWith("luar") ? "`luar:" : k}`);
    const hal = readFileSync("app/(public)/absen/[token]/page.tsx", "utf8");
    expect(hal).toContain("r.status === 401");
    expect(hal).toContain("pesanFotoGagal(err, f)");
  });
});
