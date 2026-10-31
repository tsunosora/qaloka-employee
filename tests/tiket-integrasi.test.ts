// Tiket integrasi (qi1) di sisi PENERIMA — cermin lib/tiket-integrasi.mjs repo qendali.
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import kontrak from "@/kontrak/lisensi.json";
import { BOLEH_DARI, periksaTiketMurni, tiketDariHeader } from "@/lib/lisensi/tiket-integrasi";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const kunciPublik = { tes: publicKey.export({ type: "spki", format: "pem" }).toString() };

function terbit(isi: Record<string, unknown> = {}, amplop = "qi1") {
  const badan = `${amplop}.${Buffer.from(
    JSON.stringify({
      versi: 1, kid: "tes", klien: "tokobudi", dari: "qendali", ke: "qendali_employee",
      kedaluwarsaPada: new Date(Date.now() + 300_000).toISOString(), ...isi,
    }),
  ).toString("base64url")}`;
  return `${badan}.${sign(null, Buffer.from(badan), privateKey).toString("base64url")}`;
}
const periksa = (t: string, klienSaya: string | null = "tokobudi") =>
  periksaTiketMurni(t, { kunciPublik, produkSaya: "qendali_employee", klienSaya });

describe("tiket integrasi", () => {
  test("sah untuk usaha yang sama", () => expect(periksa(terbit()).sah).toBe(true));
  test("usaha lain ditolak walau tanda tangannya sah", () =>
    expect(periksa(terbit({ klien: "lain" }))).toMatchObject({ sah: false, alasan: "usaha_lain" }));
  test("tanpa kunci lisensi = tolak (gagal-tertutup)", () =>
    expect(periksa(terbit(), null)).toMatchObject({ alasan: "lisensi_belum_terpasang" }));
  test("kedaluwarsa ditolak", () =>
    expect(periksa(terbit({ kedaluwarsaPada: new Date(Date.now() - 1).toISOString() }))).toMatchObject({ alasan: "kedaluwarsa" }));
  test("untuk produk lain ditolak", () =>
    expect(periksa(terbit({ ke: "qendali" }))).toMatchObject({ alasan: "bukan_untuk_produk_ini" }));
  test("kunci lisensi (q1) bukan tiket", () =>
    expect(periksa(terbit({}, "q1"))).toMatchObject({ alasan: "amplop_salah" }));
  test("pemanggil yang tidak terdaftar ditolak", () =>
    expect(periksa(terbit({ dari: "qendali_event" }))).toMatchObject({ alasan: "pasangan_tidak_didukung" }));
  test("header Authorization: Qendali dibaca, Bearer tidak", () => {
    expect(tiketDariHeader(new Request("http://x", { headers: { authorization: "Qendali abc" } }))).toBe("abc");
    expect(tiketDariHeader(new Request("http://x", { headers: { authorization: "Bearer abc" } }))).toBeNull();
  });
  // Daftar yang boleh memanggil aplikasi ini harus SAMA dengan yang diterbitkan qaloka.com.
  test("BOLEH_DARI cocok dengan kontrak", () => {
    const pemanggil = Object.entries((kontrak as unknown as { integrasi: Record<string, string[]> }).integrasi)
      .filter(([, ke]) => ke.includes("qendali_employee"))
      .map(([dari]) => dari)
      .sort();
    expect([...BOLEH_DARI].sort()).toEqual(pemanggil);
  });
});
