// @vitest-environment node
// Peralihan ke tiket qi1 selesai: kunci API bersama lama (HR_API_KEY masuk, POSPRO_API_KEY keluar)
// MATI secara bawaan, dan cuma hidup lagi lewat jalan mundur QENDALI_INTEGRASI_KUNCI_LAMA=true.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/lisensi/tiket-integrasi", async (asli) => ({
  ...(await asli<typeof import("@/lib/lisensi/tiket-integrasi")>()),
  // Pemeriksaan & penerbitan tiket punya tesnya sendiri (tiket-integrasi.test.ts); di sini ditiru.
  periksaTiketIntegrasi: vi.fn(async () => ({ sah: true, isi: {} })),
  tiketUntuk: vi.fn(async () => "tiket-uji"),
}));

import { tiketUntuk } from "@/lib/lisensi/tiket-integrasi";
import { requireIntegrationKey } from "@/lib/services/integrations/guard";
import { fetchPosproStaffList, posproConfigured } from "@/lib/services/pospro/client";

const ENV = { ...process.env };
beforeEach(() => {
  process.env.HR_API_KEY = "kunci-uji";
  process.env.POSPRO_API_KEY = "kunci-uji";
  process.env.POSPRO_API_URL = "http://127.0.0.1:3001";
  process.env.QENDALI_LISENSI_TOKEN = "token-uji";
  delete process.env.QENDALI_INTEGRASI_KUNCI_LAMA;
  delete process.env.HR_API_ALLOW_REMOTE;
  vi.mocked(tiketUntuk).mockResolvedValue("tiket-uji");
});
afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

/** Permintaan dari loopback dengan kunci yang BENAR — persis yang dulu selalu diterima. */
const denganKunci = () =>
  new Request("http://127.0.0.1:3007/api/integrations/hr-summary", { headers: { "x-api-key": "kunci-uji" } });

async function status(p: Promise<unknown>): Promise<number | "lolos"> {
  try {
    await p;
    return "lolos";
  } catch (e) {
    if (e instanceof Response) return e.status;
    throw e;
  }
}

describe("penjaga /api/integrations/* (masuk)", () => {
  test("MATI secara bawaan: kunci benar dari loopback tetap ditolak", async () => {
    let tolak: unknown;
    await requireIntegrationKey(denganKunci()).catch((e) => (tolak = e));
    expect(tolak).toBeInstanceOf(Response);
    expect((tolak as Response).status).toBe(401);
    expect(((await (tolak as Response).json()) as { message: string }).message).toMatch(/cuma menerima tiket/);
  });

  test('nilai selain "true" tidak menyalakan jalan mundur', async () => {
    for (const v of ["1", "yes", "TRUE", " true", ""]) {
      process.env.QENDALI_INTEGRASI_KUNCI_LAMA = v;
      expect(await status(requireIntegrationKey(denganKunci()))).toBe(401);
    }
  });

  test("tiket tetap diterima saat pintu lama mati", async () => {
    const req = new Request("http://x/api/integrations/hr-summary", { headers: { authorization: "Qendali abc" } });
    expect(await status(requireIntegrationKey(req))).toBe("lolos");
  });

  test("jalan mundur (flag true): kunci benar dari loopback diterima", async () => {
    process.env.QENDALI_INTEGRASI_KUNCI_LAMA = "true";
    expect(await status(requireIntegrationKey(denganKunci()))).toBe("lolos");
  });

  test("jalan mundur tetap menolak yang datang lewat Cloudflare", async () => {
    process.env.QENDALI_INTEGRASI_KUNCI_LAMA = "true";
    const req = new Request("http://x/api/integrations/hr-summary", {
      headers: { "x-api-key": "kunci-uji", "cf-ray": "abc" },
    });
    expect(await status(requireIntegrationKey(req))).toBe(401);
  });
});

describe("klien POS (keluar)", () => {
  function fetchPalsu() {
    const f = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", f);
    return f;
  }
  const kepala = (f: ReturnType<typeof fetchPalsu>) =>
    (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;

  test("mengirim TIKET saja — POSPRO_API_KEY yang masih terisi tidak keluar dari server", async () => {
    const f = fetchPalsu();
    await fetchPosproStaffList();
    expect(kepala(f).authorization).toBe("Qendali tiket-uji");
    expect(kepala(f)["x-api-key"]).toBeUndefined();
  });

  test("tiket tidak tersedia → POS tidak dipanggil sama sekali", async () => {
    vi.mocked(tiketUntuk).mockResolvedValue(null);
    const f = fetchPalsu();
    expect(await fetchPosproStaffList()).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  test("kunci lama saja tidak lagi membuat integrasi terhitung tersambung", () => {
    delete process.env.QENDALI_LISENSI_TOKEN;
    expect(posproConfigured()).toBe(false);
    process.env.QENDALI_INTEGRASI_KUNCI_LAMA = "true";
    expect(posproConfigured()).toBe(true);
  });

  test("jalan mundur (flag true): kunci lama ikut dikirim di samping tiket", async () => {
    process.env.QENDALI_INTEGRASI_KUNCI_LAMA = "true";
    const f = fetchPalsu();
    await fetchPosproStaffList();
    expect(kepala(f)["x-api-key"]).toBe("kunci-uji");
    expect(kepala(f).authorization).toBe("Qendali tiket-uji");
  });
});
