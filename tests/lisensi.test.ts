// Lisensi Qaloka Employee: verifikasi kunci, keadaan, batas, dan peta jalur → fitur.
// Bagian murni diuji langsung; penegakannya (route()) dijaga secara struktural di bawah.
import { generateKeyPairSync, sign } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import kontrak from "@/kontrak/lisensi.json";
import { nilaiKeadaan, PRODUK_APLIKASI, bolehFitur } from "@/lib/lisensi/keadaan-lisensi";
import { statusMasaBerlaku } from "@/lib/lisensi/periksa-kunci";
import { putusanBatas, KODE_BATAS_DITEGAKKAN } from "@/lib/lisensi/aturan-batas";
import { ATURAN_API, ATURAN_HALAMAN, bebasHanyaBaca, fiturUntuk } from "@/lib/lisensi/aturan-jalur";

const HARI = 86_400_000;
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PEM = publicKey.export({ type: "spki", format: "pem" }).toString();

function kunci(isi: Record<string, unknown>): string {
  const p1 = Buffer.from(JSON.stringify({ versi: 1, kid: "tes", ...isi })).toString("base64url");
  const sig = sign(null, Buffer.from(`q1.${p1}`), privateKey).toString("base64url");
  return `q1.${p1}.${sig}`;
}
const isiDasar = (lain: Record<string, unknown> = {}) => ({
  klien: "contoh",
  produk: "qendali_employee",
  paket: "karyawan_absensi",
  fitur: ["hr.employees", "hr.attendance"],
  batas: { "limit.employees": 30 },
  alamatSah: [],
  terbitPada: new Date().toISOString(),
  berlakuSampai: new Date(Date.now() + 30 * HARI).toISOString(),
  tenggangHari: 14,
  ...lain,
});
const keadaan = (isi: Record<string, unknown>) =>
  nilaiKeadaan({ kunci: kunci(isi), kunciPublik: { tes: PEM } });

describe("keadaan lisensi", () => {
  test("produk aplikasi ini qendali_employee", () => {
    expect(PRODUK_APLIKASI).toBe("qendali_employee");
  });

  test("tanpa kunci = gagal-terbuka: tidak ditegakkan, semua fitur boleh", () => {
    const k = nilaiKeadaan({ kunci: null, kunciPublik: { tes: PEM } });
    expect(k.ditegakkan).toBe(false);
    expect(bolehFitur(k, "hr.points")).toBe(true);
  });

  test("kunci sah: fitur di kunci boleh, yang lain tidak", () => {
    const k = keadaan(isiDasar());
    expect(k.status).toBe("aktif");
    expect(bolehFitur(k, "hr.attendance")).toBe(true);
    expect(bolehFitur(k, "hr.points")).toBe(false);
  });

  test("kunci produk lain (kasir) ditolak jadi hanya-baca", () => {
    const k = keadaan(isiDasar({ produk: "qendali" }));
    expect(k.hanyaBaca).toBe(true);
    expect(k.alasan).toBe("produk_tidak_cocok");
  });

  test("tanda tangan palsu → hanya-baca, BUKAN terbuka", () => {
    const asli = kunci(isiDasar());
    const [a, b] = asli.split(".");
    const palsu = `${a}.${Buffer.from(JSON.stringify({ ...isiDasar(), versi: 1, kid: "tes", fitur: ["hr.points"] })).toString("base64url")}.${asli.split(".")[2]}`;
    expect(b).toBeTruthy();
    const k = nilaiKeadaan({ kunci: palsu, kunciPublik: { tes: PEM } });
    expect(k.hanyaBaca).toBe(true);
  });

  test("masa tenggang masih boleh menulis; kedaluwarsa jadi hanya-baca", () => {
    const tenggang = keadaan(isiDasar({ berlakuSampai: new Date(Date.now() - 2 * HARI).toISOString() }));
    expect(tenggang.status).toBe("tenggang");
    expect(tenggang.hanyaBaca).toBe(false);
    const habis = keadaan(isiDasar({ berlakuSampai: new Date(Date.now() - 20 * HARI).toISOString() }));
    expect(habis.hanyaBaca).toBe(true);
  });

  // Salinan POS masih `status !== 'aktif'`; acuannya (qaloka.com) `=== 'kedaluwarsa'`.
  test("statusMasaBerlaku.hanyaBaca ikut qaloka.com: tenggang BUKAN hanya-baca", () => {
    const m = statusMasaBerlaku(
      { berlakuSampai: new Date(Date.now() - HARI).toISOString(), tenggangHari: 14 } as never,
      {},
    );
    expect(m.status).toBe("tenggang");
    expect(m.hanyaBaca).toBe(false);
  });
});

describe("batas", () => {
  test("null = tanpa batas, boleh", () => {
    expect(putusanBatas({ kode: "limit.employees", batas: null, pemakaian: 999 }).boleh).toBe(true);
  });
  test("penuh ditolak, dengan jalan keluar", () => {
    const p = putusanBatas({ kode: "limit.employees", batas: 30, pemakaian: 30 });
    expect(p.boleh).toBe(false);
    expect(p.pesan).toContain("nonaktifkan karyawan");
  });
  test("yang sudah lewat batas diberi tahu datanya tetap jalan", () => {
    expect(putusanBatas({ kode: "limit.machines", batas: 1, pemakaian: 3 }).pesan).toContain("tetap jalan");
  });
  // Rute publik lewat penjaga yang sama — nama paket di galat membocorkan tingkat langganan klien.
  test("pesan TIDAK PERNAH menyebut nama paket", () => {
    for (const kode of KODE_BATAS_DITEGAKKAN)
      for (const [batas, pemakaian] of [[0, 0], [5, 5], [5, 9]]) {
        const pesan = putusanBatas({ kode, batas, pemakaian }).pesan ?? "";
        expect(pesan).not.toMatch(/paket (absensi|kinerja|karyawan)/i);
        expect(pesan).not.toMatch(/karyawan_(absensi|kinerja)/);
      }
  });
  test("tiap batas yang ditegakkan ada di kontrak", () => {
    const dikenal = new Set(kontrak.batas.map((b) => b.kode));
    for (const kode of KODE_BATAS_DITEGAKKAN) expect(dikenal.has(kode), kode).toBe(true);
  });
});

describe("peta jalur → fitur", () => {
  test("awalan terpanjang menang", () => {
    expect(fiturUntuk("/api/employees/12/portal-pin", ATURAN_API)).toBe("hr.portal");
    expect(fiturUntuk("/api/employees/12", ATURAN_API)).toBe("hr.employees");
    expect(fiturUntuk("/api/attendance/leave-link", ATURAN_API)).toBe("hr.leave");
    expect(fiturUntuk("/api/attendance/day", ATURAN_API)).toBe("hr.attendance");
    expect(fiturUntuk("/api/reports/employee/3/public-feedbacks", ATURAN_API)).toBe("hr.guest_rating");
  });
  test("awalan tidak mencocokkan sebagian nama segmen", () => {
    expect(fiturUntuk("/api/employeesX", ATURAN_API)).toBeNull();
    expect(fiturUntuk("/mesin", ATURAN_HALAMAN)).toBeNull();
  });
  // Salah ketik kode = jalurnya tertutup untuk SEMUA klien tanpa satu baris log pun.
  test("tiap kode di peta DIJUAL untuk qendali_employee menurut kontrak", () => {
    const dijual = new Set((kontrak.fiturDijual as Record<string, string[]>).qendali_employee);
    for (const a of [...ATURAN_API, ...ATURAN_HALAMAN]) expect(dijual.has(a.fitur), a.awalan).toBe(true);
  });
  test("hanya-baca tetap membuka masuk, lisensi, dan sesi portal", () => {
    expect(bebasHanyaBaca("/api/auth/callback/credentials")).toBe(true);
    expect(bebasHanyaBaca("/api/lisensi/segarkan")).toBe(true);
    expect(bebasHanyaBaca("/api/public/portal/abc/session")).toBe(true);
    expect(bebasHanyaBaca("/api/employees")).toBe(false);
  });
});

// ── Penjaga struktural ──────────────────────────────────────────────────────────────────
// Halaman/rute baru TIDAK otomatis aman: kalau tidak dipetakan, ia terbuka untuk semua paket.
// Jadi tiap jalur wajib dipetakan ATAU terdaftar sengaja-terbuka di sini, dengan alasannya.

const API_TERBUKA: Record<string, string> = {
  "/api/auth": "masuk & keluar",
  "/api/account/password": "ganti sandi sendiri",
  "/api/dashboard": "beranda, ada di semua paket",
  "/api/hp/tiket-masuk": "masuk aplikasi HP Owner dengan tiket qaloka.com",
  "/api/hp/ringkasan": "beranda Tim aplikasi HP Owner, setara /api/dashboard",
  "/api/lisensi": "keadaan & penyegaran lisensi — jalan keluarnya",
  "/api/notifications": "notifikasi aplikasi",
  "/api/settings": "pengaturan umum",
  "/api/users": "akun pengguna (dibatasi limit.users, bukan fitur)",
  "/api/fingerspot/cron-pull": "penarik mesin LAN, tidak lewat route() — absensi tidak boleh berhenti",
  "/api/fingerspot/process": "penerima mesin, tidak lewat route()",
  "/api/fingerspot/realtime": "penerima mesin, tidak lewat route()",
  "/api/fingerspot/webhook": "penerima mesin, tidak lewat route()",
};
const HALAMAN_TERBUKA: Record<string, string> = {
  "/login": "masuk",
  "/masuk-qendali": "masuk dengan tiket dari portal qaloka.com",
  "/dashboard": "beranda",
  "/settings": "pengaturan umum (kartu mesin & libur memanggil API yang dijaga sendiri)",
  "/settings/users": "akun pengguna",
  "/settings/langganan": "jalan keluar — tidak boleh pernah diblokir",
  "/link-expired": "pemberitahuan tautan kedaluwarsa",
};

function berkas(dir: string, nama: string): string[] {
  const hasil: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) hasil.push(...berkas(p, nama));
    else if (n === nama) hasil.push(p);
  }
  return hasil;
}
// app/(grup)/a/[id]/page.tsx → /a/1   (segmen dinamis diganti contoh, grup dibuang)
const keJalur = (p: string, nama: string) =>
  "/" +
  relative("app", p)
    .replace(/\\/g, "/")
    .replace(new RegExp(`/?${nama}$`), "")
    .split("/")
    .filter((s) => s && !/^\(.*\)$/.test(s))
    .map((s) => (/^\[.*\]$/.test(s) ? "1" : s))
    .join("/");
const terbuka = (jalur: string, daftar: Record<string, string>) =>
  Object.keys(daftar).some((a) => jalur === a || jalur.startsWith(a + "/"));

describe("tiap jalur punya keputusan lisensi", () => {
  test("rute API", () => {
    const yatim = berkas("app/api", "route.ts")
      .map((p) => keJalur(p, "route.ts"))
      .filter((j) => !fiturUntuk(j, ATURAN_API) && !terbuka(j, API_TERBUKA));
    expect(yatim).toEqual([]);
  });
  test("halaman", () => {
    const yatim = berkas("app", "page.tsx")
      .map((p) => keJalur(p, "page.tsx"))
      .filter((j) => j !== "/" && !fiturUntuk(j, ATURAN_HALAMAN) && !terbuka(j, HALAMAN_TERBUKA));
    expect(yatim).toEqual([]);
  });
  test("route() menegakkan lisensi SEBELUM handler dijalankan", () => {
    const http = readFileSync("lib/http.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const tolak = http.indexOf("await tolakOlehLisensi(req)");
    expect(tolak).toBeGreaterThan(-1);
    expect(tolak).toBeLessThan(http.indexOf("await handler(req, ctx)"));
  });
  // Kunci tidak sah membawa daftar fitur KOSONG; tanpa urutan ini mode hanya-baca menolak
  // MEMBACA juga (GET /api/employees → 403) — ketahuan di aplikasi yang jalan, 11 Okt 2026.
  test("saat hanya-baca, penjaga fitur dimatikan (membaca selalu boleh)", () => {
    const p = readFileSync("lib/lisensi/penjaga.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const mati = p.indexOf("if (keadaan.hanyaBaca) return null;");
    expect(mati).toBeGreaterThan(-1);
    expect(mati).toBeLessThan(p.indexOf("fiturUntuk(jalur, ATURAN_API)"));
  });
  test("pesan hanya-baca menyebut sebab yang sebenarnya", async () => {
    const { pesanHanyaBaca } = await import("@/lib/lisensi/penjaga");
    expect(pesanHanyaBaca("masa_berlaku_habis")).toContain("habis masa berlakunya");
    expect(pesanHanyaBaca("alamat_tidak_sah")).not.toContain("habis");
  });
  test("halaman Langganan tidak pernah dipetakan ke fitur", () => {
    expect(fiturUntuk("/settings/langganan", ATURAN_HALAMAN)).toBeNull();
  });
});
