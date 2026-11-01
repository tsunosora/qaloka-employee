import { prisma } from "@/lib/prisma";

// PUBLIK (di-whitelist proxy) — penerima PUSH mesin Fingerspot.
// Format protokol mesin BELUM diketahui (lihat memory), jadi permisif:
// simpan apa pun ke FingerspotRawLog + coba ekstrak sn/pin/waktu bila ada.
export async function POST(req: Request) {
  // Opsional: verifikasi secret bila di-set.
  const secret = process.env.FINGERSPOT_WEBHOOK_SECRET;
  // sec-gate: wajib secret (fail-closed) — tak ada pemanggil publik yang sah.
  if (!secret) return Response.json({ ok: false, message: "FINGERSPOT_WEBHOOK_SECRET belum diset." }, { status: 503 });
  const provided = req.headers.get("x-webhook-secret") ?? new URL(req.url).searchParams.get("secret");
  if (provided !== secret) {
    return Response.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const text = await req.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const sn = (obj.sn ?? obj.SN ?? obj.cloud_id ?? null) as string | null;
  const pin = (obj.pin ?? obj.PIN ?? obj.userid ?? null) as string | null;
  const scanRaw = (obj.scan ?? obj.scan_date ?? obj.time ?? obj.datetime ?? null) as string | null;
  let scanAt: Date | null = null;
  if (scanRaw) {
    const d = new Date(scanRaw);
    if (!Number.isNaN(d.getTime())) scanAt = d;
  }

  await prisma.fingerspotRawLog.create({
    data: {
      snMachine: sn ? String(sn) : null,
      pin: pin ? String(pin) : null,
      scanAt,
      rawBody: (parsed ?? { raw: text }) as object,
      processed: false,
    },
  });

  // Balas cepat 200 supaya mesin tidak retry.
  return Response.json({ ok: true });
}
