import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LAMPIRAN_MAKS_BITA,
  disposisiLampiran,
  jalurAman,
  jenisLampiran,
  namaAman,
  periksaLampiran,
} from "@/lib/services/leave/lampiran";
import { kelompokkanKiriman } from "@/components/portal/LampiranIzin";

// Lampiran izin (foto surat dokter / PDF): diperiksa dari ISI berkas, bukan dari tipe kiriman.

const bita = (...awal: number[]) => {
  const b = new Uint8Array(64);
  b.set(awal);
  return b;
};
const teks = (s: string) => bita(...Array.from(s, (c) => c.charCodeAt(0)));

const JPEG = bita(0xff, 0xd8, 0xff, 0xe0);
const PNG = bita(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = (() => {
  const b = teks("RIFF");
  b.set(Array.from("WEBP", (c) => c.charCodeAt(0)), 8);
  return b;
})();
const PDF = teks("%PDF-1.7\n");
const EXE = teks("MZ\x90\x00");
const HEIC = (() => {
  const b = new Uint8Array(64);
  b.set([0, 0, 0, 0x18]);
  b.set(Array.from("ftypheic", (c) => c.charCodeAt(0)), 4);
  return b;
})();
const SVG = teks('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const HTML = teks("<!doctype html><script>alert(1)</script>");

const masuk = (nama: string, b: Uint8Array) => ({ nama, ukuran: b.length, bita: b });

describe("jenisLampiran — magic bytes", () => {
  it("JPEG/PNG/WebP/PDF dikenali", () => {
    expect(jenisLampiran(JPEG)).toBe("image/jpeg");
    expect(jenisLampiran(PNG)).toBe("image/png");
    expect(jenisLampiran(WEBP)).toBe("image/webp");
    expect(jenisLampiran(PDF)).toBe("application/pdf");
  });
  it("EXE/HEIC/SVG/HTML/kosong ditolak", () => {
    for (const b of [EXE, HEIC, SVG, HTML, new Uint8Array(), teks("%PDF")]) expect(jenisLampiran(b)).toBeNull();
  });
});

describe("periksaLampiran", () => {
  it("menerima foto & PDF; tipe dari isi, nama diberi ekstensi sesuai isi", () => {
    const r = periksaLampiran([masuk("surat.jpg", JPEG), masuk("hasil lab.pdf", PDF), masuk("x.png", PNG)]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.berkas.map((b) => b.tipe)).toEqual(["image/jpeg", "application/pdf", "image/png"]);
    expect(r.berkas[1].nama).toBe("hasil lab.pdf");
  });
  it("PDF yang diberi nama .jpg tetap tercatat PDF", () => {
    const r = periksaLampiran([masuk("foto.jpg", PDF)]);
    expect(r.ok && r.berkas[0]).toMatchObject({ tipe: "application/pdf", nama: "foto.pdf" });
  });
  it.each([
    ["program.exe", EXE, /tidak bisa dipakai/],
    ["gambar.svg", SVG, /tidak bisa dipakai/],
    ["halaman.html", HTML, /tidak bisa dipakai/],
    ["foto.heic", HEIC, /HEIC.*Paling kompatibel/],
  ])("menolak %s", (nama, b, pesan) => {
    const r = periksaLampiran([masuk(nama, b)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(pesan);
  });
  it("menyamar: nama .pdf, tipe kiriman PDF, isinya HTML → ditolak", () => {
    expect(periksaLampiran([masuk("surat.pdf", HTML)]).ok).toBe(false);
  });
  it("batas ukuran 5 MB per berkas (dari bita, juga dari ukuran yang dilaporkan)", () => {
    const pas = new Uint8Array(LAMPIRAN_MAKS_BITA);
    pas.set(PDF.slice(0, 9));
    expect(periksaLampiran([masuk("pas.pdf", pas)]).ok).toBe(true);
    const lebih = new Uint8Array(LAMPIRAN_MAKS_BITA + 1);
    lebih.set(PDF.slice(0, 9));
    const r = periksaLampiran([masuk("besar.pdf", lebih)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/terlalu besar.*5 MB/);
    expect(periksaLampiran([{ nama: "a.pdf", ukuran: LAMPIRAN_MAKS_BITA + 1, bita: PDF }]).ok).toBe(false);
  });
  it("berkas kosong ditolak", () => {
    expect(periksaLampiran([masuk("kosong.jpg", new Uint8Array())]).ok).toBe(false);
  });
  it("batas jumlah 3 per pengajuan, termasuk yang sudah tersimpan", () => {
    expect(periksaLampiran([masuk("a.jpg", JPEG), masuk("b.jpg", JPEG), masuk("c.jpg", JPEG)]).ok).toBe(true);
    const empat = periksaLampiran([JPEG, JPEG, JPEG, JPEG].map((b, i) => masuk(`${i}.jpg`, b)));
    expect(empat.ok).toBe(false);
    if (!empat.ok) expect(empat.error).toMatch(/maksimal 3/);
    const sisa = periksaLampiran([masuk("a.jpg", JPEG), masuk("b.jpg", JPEG)], 2);
    expect(sisa.ok).toBe(false);
    if (!sisa.ok) expect(sisa.error).toMatch(/tinggal 1/);
    expect(periksaLampiran([masuk("a.jpg", JPEG)], 2).ok).toBe(true);
  });
  it("satu berkas buruk menggagalkan semuanya (tak ada yang lolos sebagian)", () => {
    expect(periksaLampiran([masuk("a.jpg", JPEG), masuk("b.exe", EXE)]).ok).toBe(false);
  });
});

describe("namaAman", () => {
  it("membuang folder, karakter kendali & karakter header", () => {
    expect(namaAman("../../etc/passwd", "application/pdf")).toBe("passwd.pdf");
    expect(namaAman("C:\\Users\\x\\surat dokter.JPG", "image/jpeg")).toBe("surat dokter.jpg");
    expect(namaAman('a"b;c\r\nd<e>.pdf', "application/pdf")).toBe("abcde.pdf");
    expect(namaAman("...tersembunyi.png", "image/png")).toBe("tersembunyi.png");
  });
  it("nama kosong → 'lampiran.<ext>'; panjang dipotong ≤150", () => {
    expect(namaAman("", "image/webp")).toBe("lampiran.webp");
    expect(namaAman(null, "application/pdf")).toBe("lampiran.pdf");
    const n = namaAman(`${"a".repeat(400)}.pdf`, "application/pdf");
    expect(n.length).toBeLessThanOrEqual(150);
    expect(n.endsWith(".pdf")).toBe(true);
  });
  it("huruf non-Latin dipertahankan", () => {
    expect(namaAman("surat-ü-日本.pdf", "application/pdf")).toBe("surat-ü-日本.pdf");
  });
});

describe("jalurAman — tidak bisa keluar dari folder lampiran", () => {
  const akar = path.resolve("/tmp/lampiran-uji");
  it("jalur relatif biasa diterima", () => {
    expect(jalurAman("2026-11/abc.jpg", akar)).toBe(path.join(akar, "2026-11", "abc.jpg"));
  });
  it.each(["../rahasia.txt", "2026-11/../../x", "/etc/passwd", "", ".", "a\0b.jpg"])("menolak %j", (rel) => {
    expect(jalurAman(rel, akar)).toBeNull();
  });
});

describe("disposisiLampiran", () => {
  it("foto inline, PDF attachment", () => {
    expect(disposisiLampiran("image/jpeg", "surat.jpg")).toMatch(/^inline; filename="surat\.jpg"/);
    expect(disposisiLampiran("application/pdf", "hasil lab.pdf")).toMatch(/^attachment; filename="hasil lab\.pdf"/);
  });
  it("tanda kutip, titik koma & baris baru tidak bisa menyuntik header", () => {
    const h = disposisiLampiran("application/pdf", 'x".pdf; filename="jahat.exe\r\nSet-Cookie: a=b');
    expect(h).not.toMatch(/[\r\n]/);
    expect(h.match(/"/g)).toHaveLength(2);
    expect(h).toContain("filename*=UTF-8''");
  });
  it("nama non-ASCII: filename ASCII pengganti + filename* UTF-8", () => {
    const h = disposisiLampiran("application/pdf", "surat'ü.pdf");
    expect(h).toContain('filename="surat\'_.pdf"');
    expect(h).toContain("filename*=UTF-8''surat%27%C3%BC.pdf");
  });
});

describe("kelompokkanKiriman — kiriman ≤9 MB (batas sangga proxy 10 MB)", () => {
  const MB = 1024 * 1024;
  const l = (mb: number) => ({ blob: { size: mb * MB } });
  it("foto kecil → satu kiriman", () => {
    expect(kelompokkanKiriman([l(0.4), l(0.3), l(0.5)])).toHaveLength(1);
  });
  it("tiga PDF 5 MB → tiga kiriman", () => {
    expect(kelompokkanKiriman([l(5), l(5), l(5)]).map((k) => k.length)).toEqual([1, 1, 1]);
  });
  it("4 + 4 MB satu kiriman, 5 MB berikutnya terpisah", () => {
    expect(kelompokkanKiriman([l(4), l(4), l(5)]).map((k) => k.length)).toEqual([2, 1]);
  });
});

describe("simpan/baca/hapus di disk (folder sementara)", () => {
  it("nama acak di dalam folder, isi diperiksa ulang saat dibaca, lalu terhapus", async () => {
    const { mkdtemp, rm, readdir } = await import("node:fs/promises");
    const os = await import("node:os");
    const { simpanLampiran, bacaLampiran, hapusLampiran } = await import("@/lib/services/leave/lampiran");
    const dir = await mkdtemp(path.join(os.tmpdir(), "izin-uji-"));
    const lama = process.env.LEAVE_LAMPIRAN_DIR;
    process.env.LEAVE_LAMPIRAN_DIR = dir;
    try {
      const cek = periksaLampiran([masuk("../../surat.pdf", PDF), masuk("foto.jpg", JPEG)]);
      if (!cek.ok) throw new Error(cek.error);
      const t = await simpanLampiran(cek.berkas);
      expect(t.map((x) => x.path)).toEqual([
        expect.stringMatching(/^\d{4}-\d{2}\/[0-9a-f-]{36}\.pdf$/),
        expect.stringMatching(/^\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/),
      ]);
      expect(t[0].nama).toBe("surat.pdf");
      expect((await bacaLampiran(t[0].path))?.tipe).toBe("application/pdf");
      expect(await bacaLampiran("../luar.pdf")).toBeNull();
      await hapusLampiran(t.map((x) => x.path));
      expect(await readdir(path.join(dir, t[0].path.split("/")[0]))).toEqual([]);
    } finally {
      if (lama === undefined) delete process.env.LEAVE_LAMPIRAN_DIR;
      else process.env.LEAVE_LAMPIRAN_DIR = lama;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
