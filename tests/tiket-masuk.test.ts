// Tiket masuk (qm1) di sisi PENERIMA + token sesi aplikasi HP Owner.
// Aturannya di repo qendali, docs/lisensi.md → "Tiket masuk".
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import { hostDari, periksaTiketMasukMurni } from "@/lib/lisensi/tiket-masuk";
import { bacaTokenMurni, sidikSandi, terbitkanTokenMurni, tokenDariHeader } from "@/lib/hp/sesi";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const kunciPublik = { "prod-1": publicKey.export({ type: "spki", format: "pem" }).toString() };

function terbit(isi: Record<string, unknown> = {}, amplop = "qm1") {
  const sekarang = Date.now();
  const badan = `${amplop}.${Buffer.from(
    JSON.stringify({
      versi: 1, kid: "prod-1", tujuan: "absensi.tokobudi.com", klien: "tokobudi",
      email: "budi@tokobudi.com", nama: "Budi", peran: "pemilik", jti: randomBytes(24).toString("base64url"),
      terbitPada: new Date(sekarang).toISOString(), kedaluwarsaPada: new Date(sekarang + 60_000).toISOString(),
      ...isi,
    }),
  ).toString("base64url")}`;
  return `${badan}.${sign(null, Buffer.from(badan), privateKey).toString("base64url")}`;
}
const periksa = (t: string, o: { kidTerpasang?: string | null; alamatSaya?: string | null } = {}) =>
  periksaTiketMasukMurni(t, {
    kunciPublik,
    kidTerpasang: o.kidTerpasang === undefined ? "prod-1" : o.kidTerpasang,
    alamatSaya: o.alamatSaya === undefined ? "https://absensi.tokobudi.com" : o.alamatSaya,
  });

describe("tiket masuk qm1", () => {
  test("sah untuk instalasi ini", () => expect(periksa(terbit()).sah).toBe(true));
  test("alamat instalasi dibandingkan sebagai host", () => {
    expect(hostDari("https://Absensi.TokoBudi.com/")).toBe("absensi.tokobudi.com");
    expect(periksa(terbit(), { alamatSaya: "absensi.tokobudi.com" }).sah).toBe(true);
  });
  test("tujuan instalasi lain ditolak", () =>
    expect(periksa(terbit({ tujuan: "absensi.tokolain.com" }))).toMatchObject({ alasan: "bukan_untuk_instalasi_ini" }));
  test("alamat instalasi kosong = tolak", () =>
    expect(periksa(terbit(), { alamatSaya: null })).toMatchObject({ alasan: "alamat_instalasi_kosong" }));
  test("tanpa kunci lisensi terpasang = tolak", () =>
    expect(periksa(terbit(), { kidTerpasang: null })).toMatchObject({ alasan: "lisensi_belum_terpasang" }));
  test("kid yang dikenal tapi bukan kunci terpasang ditolak (kunci uji tidak bisa masuk ke produksi)", () =>
    expect(periksa(terbit(), { kidTerpasang: "uji-1" })).toMatchObject({ alasan: "kid_bukan_kunci_terpasang" }));
  test("tanda tangan dipalsukan ditolak", () => {
    const [a, , c] = terbit().split(".");
    const isiPalsu = Buffer.from(JSON.stringify({ versi: 1, kid: "prod-1", tujuan: "absensi.tokobudi.com" })).toString("base64url");
    expect(periksa(`${a}.${isiPalsu}.${c}`)).toMatchObject({ sah: false, alasan: "tanda_tangan_tidak_cocok" });
  });
  test("kedaluwarsa, umur > 5 menit, atau terbit di masa depan ditolak", () => {
    const t = Date.now();
    expect(periksa(terbit({ kedaluwarsaPada: new Date(t - 1).toISOString() }))).toMatchObject({ alasan: "kedaluwarsa" });
    expect(periksa(terbit({ terbitPada: new Date(t - 60_000).toISOString(), kedaluwarsaPada: new Date(t + 300_000).toISOString() })))
      .toMatchObject({ alasan: "umur_terlalu_panjang" });
    expect(periksa(terbit({ terbitPada: new Date(t + 120_000).toISOString(), kedaluwarsaPada: new Date(t + 150_000).toISOString() })))
      .toMatchObject({ alasan: "terbit_di_masa_depan" });
  });
  test("kunci lisensi (q1) dan tiket integrasi (qi1) bukan tiket masuk", () => {
    expect(periksa(terbit({}, "q1"))).toMatchObject({ alasan: "amplop_salah" });
    expect(periksa(terbit({}, "qi1"))).toMatchObject({ alasan: "amplop_salah" });
  });
  test("tiket tanpa jti atau email ditolak", () => {
    expect(periksa(terbit({ jti: "" }))).toMatchObject({ alasan: "jti_salah" });
    expect(periksa(terbit({ email: "" }))).toMatchObject({ alasan: "email_kosong" });
  });
});

describe("token sesi HP", () => {
  const kunci = randomBytes(32);
  const isi = { uid: 3, sidik: sidikSandi("$2a$10$hash"), exp: Date.now() + 60_000 };

  test("bolak-balik", () => expect(bacaTokenMurni(terbitkanTokenMurni(isi, kunci), kunci)).toEqual(isi));
  test("kunci lain, isi diubah, atau kedaluwarsa = null", () => {
    const t = terbitkanTokenMurni(isi, kunci);
    expect(bacaTokenMurni(t, randomBytes(32))).toBeNull();
    const [a, , c] = t.split(".");
    const ubah = Buffer.from(JSON.stringify({ ...isi, uid: 1 })).toString("base64url");
    expect(bacaTokenMurni(`${a}.${ubah}.${c}`, kunci)).toBeNull();
    expect(bacaTokenMurni(terbitkanTokenMurni({ ...isi, exp: Date.now() - 1 }, kunci), kunci)).toBeNull();
  });
  test("ganti sandi mengubah sidik", () => expect(sidikSandi("a")).not.toBe(sidikSandi("b")));
  test("header: hanya Bearer hp1.…", () => {
    expect(tokenDariHeader("Bearer hp1.a.b")).toBe("hp1.a.b");
    expect(tokenDariHeader("bearer   hp1.a.b")).toBe("hp1.a.b");
    expect(tokenDariHeader("Bearer eyJ.a.b")).toBeNull();
    expect(tokenDariHeader("Qaloka qi1.a.b")).toBeNull();
    expect(tokenDariHeader(null)).toBeNull();
  });
});
