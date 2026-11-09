import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PenahanPin,
  anakDalamCakupan,
  bentukTokenSah,
  buatSesiPantau,
  buatTokenPantau,
  hariKerjaAnak,
  hitungKehadiran,
  kerajinanGuru,
  milikSekolah,
  periksaPinPantau,
  rentangDariQuery,
  saringSekolah,
  sesiPantauSah,
  statusGuru,
  tautanBerlaku,
  type TautanPantau,
} from "@/lib/services/magang/pantau";
import { kunciSekolah } from "@/lib/services/magang/sekolah";
import { fiturUntuk, ATURAN_API, ATURAN_HALAMAN, bebasHanyaBaca } from "@/lib/lisensi/aturan-jalur";

const KUNCI = "rahasia-uji";
const HARI = "2026-11-20";
const now = new Date("2026-11-20T10:00:00").getTime();

function tautan(t: Partial<TautanPantau> = {}): TautanPantau {
  return {
    id: 7,
    token: "a".repeat(43),
    pinHash: "$2a$10$hashlama",
    aktif: true,
    dicabutAt: null,
    kedaluwarsa: null,
    sekolahKunci: kunciSekolah("SMK Contoh 1"),
    ...t,
  };
}

const anak = (id: number, sekolah: string | null, dihapus = false) => ({ id, sekolah, employee: { deletedAt: dihapus ? new Date() : null } });

describe("pantauan guru — cakupan per sekolah", () => {
  const daftar = [
    anak(1, "SMK Contoh 1"),
    anak(2, "smk  contoh 1 "),
    anak(3, "SMK CONTOH 1"),
    anak(4, "SMK Contoh 2"),
    anak(5, "SMK Contoh 1", true),
    anak(6, null),
  ];
  const kunci = kunciSekolah("SMK Contoh 1");

  it("tulisan nama sekolah yang berbeda huruf/spasi tetap satu sekolah", () => {
    expect(saringSekolah(daftar, kunci).map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("anak sekolah lain / karyawan terhapus / tanpa sekolah → null (rute 404)", () => {
    expect(anakDalamCakupan(daftar, kunci, 2)?.id).toBe(2);
    expect(anakDalamCakupan(daftar, kunci, 4)).toBeNull();
    expect(anakDalamCakupan(daftar, kunci, 5)).toBeNull();
    expect(anakDalamCakupan(daftar, kunci, 6)).toBeNull();
    expect(anakDalamCakupan(daftar, kunci, 999)).toBeNull();
  });

  it("kunci sekolah kosong tidak pernah cocok dengan anak tanpa sekolah", () => {
    expect(milikSekolah(anak(6, null), "")).toBe(false);
    expect(milikSekolah(anak(6, "  "), "")).toBe(false);
  });
});

describe("pantauan guru — tautan & sesi", () => {
  it("token acak base64url ≥32 bita, unik", () => {
    const a = buatTokenPantau();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(bentukTokenSah(a)).toBe(true);
    expect(buatTokenPantau()).not.toBe(a);
    expect(bentukTokenSah("tidak-ada")).toBe(false);
    expect(bentukTokenSah("../../etc/passwd")).toBe(false);
  });

  it("PIN guru 6–8 angka", () => {
    expect(periksaPinPantau("123456")).toBeNull();
    expect(periksaPinPantau("12345678")).toBeNull();
    expect(periksaPinPantau("12345")).not.toBeNull();
    expect(periksaPinPantau("123456789")).not.toBeNull();
    expect(periksaPinPantau("12ab56")).not.toBeNull();
  });

  it("dicabut / nonaktif / lewat kedaluwarsa → tidak berlaku; hari kedaluwarsa itu sendiri masih berlaku", () => {
    expect(tautanBerlaku(tautan(), HARI)).toBe(true);
    expect(tautanBerlaku(tautan({ aktif: false }), HARI)).toBe(false);
    expect(tautanBerlaku(tautan({ dicabutAt: new Date() }), HARI)).toBe(false);
    expect(tautanBerlaku(tautan({ kedaluwarsa: new Date("2026-11-19T00:00:00") }), HARI)).toBe(false);
    expect(tautanBerlaku(tautan({ kedaluwarsa: new Date("2026-11-20T00:00:00") }), HARI)).toBe(true);
  });

  it("cookie sah hanya untuk tautan, token, dan PIN yang sama", () => {
    const t = tautan();
    const c = buatSesiPantau(t, KUNCI, now);
    expect(sesiPantauSah(c, t, KUNCI, now, HARI)).toBe(true);
    // ganti tautan → token baru (dan id baru)
    expect(sesiPantauSah(c, tautan({ token: "b".repeat(43) }), KUNCI, now, HARI)).toBe(false);
    expect(sesiPantauSah(c, tautan({ id: 8, token: "b".repeat(43) }), KUNCI, now, HARI)).toBe(false);
    // ubah PIN → pinHash baru
    expect(sesiPantauSah(c, tautan({ pinHash: "$2a$10$hashbaru" }), KUNCI, now, HARI)).toBe(false);
    // dicabut / kedaluwarsa sesudah masuk
    expect(sesiPantauSah(c, tautan({ aktif: false, dicabutAt: new Date() }), KUNCI, now, HARI)).toBe(false);
    expect(sesiPantauSah(c, tautan({ kedaluwarsa: new Date("2026-11-19T00:00:00") }), KUNCI, now, HARI)).toBe(false);
  });

  it("cookie dipalsukan / kunci lain / habis umur / rusak → ditolak", () => {
    const t = tautan();
    const c = buatSesiPantau(t, KUNCI, now);
    const [id, ...sisa] = c.split(".");
    expect(sesiPantauSah([String(Number(id) + 1), ...sisa].join("."), t, KUNCI, now, HARI)).toBe(false);
    expect(sesiPantauSah(c, t, "kunci-lain", now, HARI)).toBe(false);
    expect(sesiPantauSah(c, t, KUNCI, now + 9 * 3600 * 1000, HARI)).toBe(false);
    expect(sesiPantauSah("sampah", t, KUNCI, now, HARI)).toBe(false);
    expect(sesiPantauSah(undefined, t, KUNCI, now, HARI)).toBe(false);
  });

  it("cookie tidak memuat token maupun pinHash asli", () => {
    const t = tautan();
    const c = buatSesiPantau(t, KUNCI, now);
    expect(c).not.toContain(t.token);
    expect(c).not.toContain(t.pinHash);
  });
});

describe("pantauan guru — penahan tebakan PIN", () => {
  it("5 PIN salah dari satu IP → terkunci 15 menit; IP lain masih boleh", () => {
    const p = new PenahanPin();
    for (let i = 0; i < 5; i++) {
      expect(p.boleh("tok", "1.1.1.1", now)).toBe(true);
      p.gagal("tok", "1.1.1.1", now);
    }
    expect(p.boleh("tok", "1.1.1.1", now)).toBe(false);
    expect(p.boleh("tok", "2.2.2.2", now)).toBe(true);
    expect(p.boleh("tok", "1.1.1.1", now + 15 * 60 * 1000 + 1)).toBe(true);
  });

  it("batas per token: 20 salah dari banyak IP mengunci token itu untuk semua IP", () => {
    const p = new PenahanPin();
    for (let i = 0; i < 20; i++) p.gagal("tok", `10.0.0.${i}`, now);
    expect(p.boleh("tok", "9.9.9.9", now)).toBe(false);
    expect(p.boleh("tok-lain", "9.9.9.9", now)).toBe(true);
  });

  it("PIN benar menghapus hitungan IP itu, bukan hitungan per token", () => {
    const p = new PenahanPin(5, 6);
    for (let i = 0; i < 4; i++) p.gagal("tok", "1.1.1.1", now);
    p.berhasil("tok", "1.1.1.1");
    expect(p.boleh("tok", "1.1.1.1", now)).toBe(true);
    p.gagal("tok", "1.1.1.1", now);
    p.gagal("tok", "1.1.1.1", now);
    expect(p.boleh("tok", "3.3.3.3", now)).toBe(false); // 6 kegagalan total untuk token
  });
});

describe("pantauan guru — kehadiran", () => {
  // Nov 2026: 1 = Minggu, 2 = Senin. Libur 10 Nov.
  const libur = new Set(["2026-11-10"]);

  it("hari sebelum mulai magang, Minggu, dan libur tidak dihitung", () => {
    const hari = hariKerjaAnak({ dari: "2026-11-01", sampai: "2026-11-14" }, { mulai: "2026-11-09", selesai: null }, "2026-11-30", libur);
    expect(hari).toEqual(["2026-11-09", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]);
  });

  it("dipotong hari ini dan tanggal selesai", () => {
    expect(hariKerjaAnak({ dari: "2026-11-09", sampai: "2026-11-30" }, { mulai: "2026-11-02", selesai: null }, "2026-11-11", libur)).toEqual(["2026-11-09", "2026-11-11"]);
    expect(hariKerjaAnak({ dari: "2026-11-09", sampai: "2026-11-30" }, { mulai: "2026-11-02", selesai: "2026-11-09" }, "2026-11-30", libur)).toEqual(["2026-11-09"]);
    expect(hariKerjaAnak({ dari: "2026-11-01", sampai: "2026-11-05" }, { mulai: "2026-11-09", selesai: null }, "2026-11-30", libur)).toEqual([]);
  });

  it("persen = hadir / hari kerja; scan di hari Minggu/sebelum mulai tidak menambah", () => {
    const hari = hariKerjaAnak({ dari: "2026-11-01", sampai: "2026-11-14" }, { mulai: "2026-11-09", selesai: null }, "2026-11-30", libur);
    const hadir = new Set(["2026-11-02", "2026-11-08", "2026-11-09", "2026-11-11", "2026-11-12"]);
    const izin = new Set(["2026-11-13"]);
    expect(hitungKehadiran(hari, hadir, izin)).toEqual({ hariKerja: 5, hadir: 3, izin: 1, alpa: 1, persen: 60 });
    expect(hitungKehadiran([], hadir, izin).persen).toBeNull();
    // hari ini tanpa absen belum dihitung; sesudah absen dihitung hadir
    expect(hitungKehadiran(hari, hadir, izin, "2026-11-14")).toEqual({ hariKerja: 4, hadir: 3, izin: 1, alpa: 0, persen: 75 });
    expect(hitungKehadiran(hari, new Set([...hadir, "2026-11-14"]), izin, "2026-11-14").hariKerja).toBe(5);
  });

  it("jurnal: hari ini yang belum diisi tidak dihitung", () => {
    const hari = ["2026-11-12", "2026-11-13", "2026-11-14"];
    expect(kerajinanGuru(["2026-11-12"], hari, "2026-11-14")).toEqual({ terisi: 1, dari: 2, persen: 50 });
    expect(kerajinanGuru(["2026-11-12", "2026-11-14"], hari, "2026-11-14")).toEqual({ terisi: 2, dari: 3, persen: 67 });
  });

  it("status hari untuk guru", () => {
    expect(statusGuru("on_time", true)).toBe("hadir");
    expect(statusGuru("longshift", true)).toBe("hadir");
    expect(statusGuru("late", true)).toBe("terlambat");
    expect(statusGuru("Sakit", true)).toBe("sakit");
    expect(statusGuru("Cuti", true)).toBe("izin");
    expect(statusGuru("absent", true)).toBe("alpa");
    expect(statusGuru("absent", false)).toBe("libur");
  });

  it("rentang dari query: tak sah → bawaan; terbalik → ditukar", () => {
    const b = { dari: "2026-11-09", sampai: "2026-11-20" };
    expect(rentangDariQuery(null, null, b)).toEqual(b);
    expect(rentangDariQuery("x", "2026-11-12", b)).toEqual({ dari: "2026-11-09", sampai: "2026-11-12" });
    expect(rentangDariQuery("2026-11-15", "2026-11-10", b)).toEqual({ dari: "2026-11-10", sampai: "2026-11-15" });
  });
});

describe("pantauan guru — rute", () => {
  function berkas(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? berkas(p) : n === "route.ts" ? [p] : [];
    });
  }

  it("semua rute data guru memeriksa sesi PIN DAN cakupan sekolah", () => {
    const rute = berkas("app/api/public/pantau/[token]/anak");
    expect(rute.length).toBeGreaterThanOrEqual(5);
    for (const r of rute) {
      const isi = readFileSync(r, "utf8");
      expect(isi, r).toContain("requireSesiPantau(");
      if (r.includes("[id]")) expect(isi, r).toContain("anakAtau404(");
    }
  });

  it("lampiran izin hanya bila diizinkan admin", () => {
    const isi = readFileSync("app/api/public/pantau/[token]/anak/[id]/izin/[izinId]/lampiran/[lampiranId]/route.ts", "utf8");
    expect(isi).toContain("if (!t.tampilLampiranIzin) return tidakAda();");
  });

  it("jalur pantau punya keputusan lisensi; masuk/keluar boleh saat hanya-baca", () => {
    expect(fiturUntuk("/api/public/pantau/x/anak/1", ATURAN_API)).toBe("hr.assessment");
    expect(fiturUntuk("/pantau/x", ATURAN_HALAMAN)).toBe("hr.assessment");
    expect(bebasHanyaBaca("/api/public/pantau/x/masuk")).toBe(true);
    expect(bebasHanyaBaca("/api/public/pantau/x/anak")).toBe(false);
  });

  it("proxy membebaskan /pantau/ dari login", () => {
    const isi = readFileSync("proxy.ts", "utf8");
    expect(isi).toContain('pathname.startsWith("/pantau/")');
    expect(isi).toContain('pathname.startsWith("/api/public/pantau/")');
  });
});
