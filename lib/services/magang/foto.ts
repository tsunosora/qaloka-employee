import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { jenisGambar } from "@/lib/services/absen-hp/aturan";

/**
 * Foto jurnal magang — pola sama dengan foto nota reimbursement: DI LUAR public/, nama acak dari
 * server, isi berkas diperiksa, hanya tersaji lewat rute ber-login (pengelola) / ber-PIN (anaknya).
 */
export function folderFoto(): string {
  return process.env.MAGANG_FOTO_DIR || path.join(process.cwd(), "storage", "magang");
}

export const FOTO_MAKS_BITA = 6 * 1024 * 1024;

export async function simpanFoto(bita: Uint8Array): Promise<string> {
  const jenis = jenisGambar(bita);
  if (!jenis) throw new Error("bukan_gambar");
  const relatif = path.posix.join(new Date().toISOString().slice(0, 7), `${randomUUID()}.${jenis}`);
  const tujuan = path.join(folderFoto(), relatif);
  await mkdir(path.dirname(tujuan), { recursive: true });
  await writeFile(tujuan, bita, { mode: 0o600 });
  return relatif;
}

function jalurAman(relatif: string): string | null {
  const akar = path.resolve(folderFoto());
  const penuh = path.resolve(akar, relatif);
  return penuh.startsWith(akar + path.sep) ? penuh : null;
}

export async function bacaFoto(relatif: string): Promise<{ bita: Buffer; tipe: string } | null> {
  const penuh = jalurAman(relatif);
  if (!penuh) return null;
  try {
    const bita = await readFile(penuh);
    const jenis = jenisGambar(bita);
    if (!jenis) return null;
    return { bita, tipe: jenis === "jpg" ? "image/jpeg" : `image/${jenis}` };
  } catch {
    return null;
  }
}

export async function hapusFoto(relatif: string | null | undefined): Promise<void> {
  if (!relatif) return;
  const penuh = jalurAman(relatif);
  if (penuh) await unlink(penuh).catch(() => undefined);
}

export function responsFoto(f: { bita: Buffer; tipe: string }): Response {
  return new Response(new Uint8Array(f.bita), {
    headers: { "Content-Type": f.tipe, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}

/** Ambil foto dari multipart (medan "foto", boleh berulang). Semua diperiksa DULU baru disimpan. */
export async function fotoDariForm(form: FormData, sisaSlot: number): Promise<{ ok: true; path: string[] } | { ok: false; error: string }> {
  const berkas = form.getAll("foto").filter((f): f is File => f instanceof File && f.size > 0);
  if (berkas.length > sisaSlot) return { ok: false, error: `Foto maksimal ${sisaSlot} lagi.` };
  const isi: Uint8Array[] = [];
  for (const f of berkas) {
    if (f.size > FOTO_MAKS_BITA) return { ok: false, error: "Foto terlalu besar (maks. 6 MB)." };
    const b = new Uint8Array(await f.arrayBuffer());
    if (!jenisGambar(b)) return { ok: false, error: "Berkas foto tidak dikenali. Kirim foto JPG, PNG, atau WebP." };
    isi.push(b);
  }
  const tersimpan: string[] = [];
  for (const b of isi) tersimpan.push(await simpanFoto(b));
  return { ok: true, path: tersimpan };
}
