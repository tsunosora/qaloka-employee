import { randomBytes } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { upsertEnrollment } from "@/lib/services/fingerspot/sync";

/**
 * Perintah server -> mesin mode CLOUD (protokol realtime Fingerspot).
 *
 * Mesin mengecek perintah tiap ~20 detik (`receive_cmd`). Perintah yang menunggu dikirim di cek
 * berikutnya; mesin menjalankannya lalu melapor lewat `send_cmd_result` dengan trans_id yang sama.
 *
 * Dipakai tombol "Tarik dari mesin" di Direktori (18 Okt 2026): mesin di lapangan berhenti mengirim
 * sendiri data pendaftaran (realtime_enroll_data) sejak 30 Sep, jadi karyawan baru yang didaftarkan
 * di mesin tidak pernah sampai ke Direktori. Alurnya: GET_USER_ID_LIST (daftar PIN di mesin) ->
 * GET_USER_INFO untuk tiap PIN yang belum terdaftar -> karyawan dibuat dengan nama dari mesin.
 */

/**
 * HANYA perintah BACA. Perintah semacam CLEAR_ENROLL_DATA / CLEAR_LOG_DATA dijalankan mesin
 * seketika dan tidak bisa dibatalkan (menghapus seluruh sidik jari atau log) — jangan pernah
 * ditambahkan ke sini.
 */
export const PERINTAH_BOLEH = ["GET_USER_ID_LIST", "GET_USER_INFO"] as const;
export type KodePerintah = (typeof PERINTAH_BOLEH)[number];

/** Perintah terkirim tanpa jawaban sesudah ini dianggap gagal (mesin mati / putus internet). */
export const BATAS_TUNGGU_MS = 3 * 60_000;
/** Perintah menunggu yang tidak pernah diambil mesin dianggap gagal sesudah ini. */
export const BATAS_ANTRE_MS = 5 * 60_000;
/** Paling banyak GET_USER_INFO per tarikan — mesin dicek tiap ~20 detik, satu perintah per cek. */
export const MAKS_INFO_PER_TARIKAN = 40;

/** PIN mesin bisa datang berawalan nol ("00000009"); Direktori menyimpan "9". */
export function normalisasiPin(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

/**
 * Semua nilai `user_id` di mana pun di dalam jawaban, plus larik string di kunci ber-"user_id".
 * Kunci peta = PIN ternormalisasi (untuk dicocokkan ke Direktori); nilai = PIN APA ADANYA dari
 * mesin (untuk dikirim balik di GET_USER_INFO — mesin mungkin memakai bentuk berawalan nol).
 */
export function ambilPinMesin(data: unknown): Map<string, string> {
  const hasil = new Map<string, string>();
  const tambah = (x: string | number) => {
    const p = normalisasiPin(x);
    if (p && !hasil.has(p)) hasil.set(p, String(x).trim());
  };
  const jalan = (v: unknown, kunci = "") => {
    if (Array.isArray(v)) {
      for (const x of v) {
        if ((typeof x === "string" || typeof x === "number") && /user_?id/i.test(kunci)) tambah(x);
        else jalan(x, kunci);
      }
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, isi] of Object.entries(v as Record<string, unknown>)) {
        if (k === "user_id" && (typeof isi === "string" || typeof isi === "number")) tambah(isi);
        else jalan(isi, k);
      }
    }
  };
  jalan(data);
  return hasil;
}

/**
 * Pecah badan kiriman mesin: [4-byte LE panjang JSON][JSON][byte 0 opsional]([4-byte LE panjang][blob])*.
 * Blob ke-n dirujuk JSON sebagai "BIN_n" (mis. "user_id_array": "BIN_1"). Tahan rusak: berhenti
 * diam-diam di bingkai yang tidak masuk akal.
 */
export function pecahBlob(buf: Buffer): Buffer[] {
  if (buf.length < 4) return [];
  const pj = buf.readUInt32LE(0);
  let i = 4 + pj;
  if (pj <= 0 || i > buf.length) return [];
  const blob: Buffer[] = [];
  while (i + 4 <= buf.length) {
    if (buf[i] === 0 && blob.length === 0 && i + 5 <= buf.length) {
      // byte 0 penutup JSON (bentuk FkWeb) — lewati sekali bila panjang sesudahnya masuk akal
      const coba = buf.readUInt32LE(i + 1);
      if (coba > 0 && i + 5 + coba <= buf.length) i += 1;
    }
    const n = buf.readUInt32LE(i);
    if (n <= 0 || i + 4 + n > buf.length) break;
    blob.push(buf.subarray(i + 4, i + 4 + n));
    i += 4 + n;
  }
  return blob;
}

/**
 * Daftar PIN dari blob GET_USER_ID_LIST: `user_id_count` rekaman berukuran `one_user_id_size` byte.
 * Bentuk tiap rekaman belum didokumentasikan; PIN dibaca sebagai teks ASCII di awal rekaman sampai
 * byte 0 (atau sebagai angka 4-byte LE kalau awalnya bukan teks). Kembalikan null kalau bentuknya
 * tidak cocok — pemanggil lalu menyimpan byte mentahnya untuk diperiksa.
 */
export function pinDariBlob(data: unknown, blob: Buffer[]): Map<string, string> | null {
  const o = (data ?? {}) as Record<string, unknown>;
  const ref = typeof o.user_id_array === "string" ? /^BIN_(\d+)$/.exec(o.user_id_array) : null;
  if (!ref) return null;
  const b = blob[Number(ref[1]) - 1];
  const ukuran = Number(o.one_user_id_size);
  const jumlah = Number(o.user_id_count);
  if (!b || !ukuran || !jumlah || b.length < ukuran * jumlah) return null;
  const hasil = new Map<string, string>();
  for (let k = 0; k < jumlah; k++) {
    const r = b.subarray(k * ukuran, (k + 1) * ukuran);
    let teks = "";
    for (const c of r) {
      if (c === 0) break;
      if (c < 0x20 || c > 0x7e) { teks = ""; break; }
      teks += String.fromCharCode(c);
    }
    const mentah = teks.trim() || (r.length >= 4 ? String(r.readUInt32LE(0)) : "");
    const pin = normalisasiPin(mentah);
    if (pin && !hasil.has(pin)) hasil.set(pin, mentah);
  }
  return hasil.size > 0 ? hasil : null;
}

/** PIN ternormalisasi dari jawaban daftar PIN. */
export function ambilDaftarPin(data: unknown): string[] {
  return [...ambilPinMesin(data).keys()];
}

/** `user_id` + `user_name` dari jawaban GET_USER_INFO (di tingkat mana pun). */
export function ambilInfoPengguna(data: unknown): { pin: string; nama: string | null } | null {
  let ketemu: { pin: string; nama: string | null } | null = null;
  const jalan = (v: unknown) => {
    if (ketemu || !v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(jalan);
    const o = v as Record<string, unknown>;
    const pin = normalisasiPin(o.user_id);
    if (pin) {
      const nama = typeof o.user_name === "string" && o.user_name.trim() ? o.user_name.trim() : null;
      ketemu = { pin, nama };
      return;
    }
    Object.values(o).forEach(jalan);
  };
  jalan(data);
  return ketemu;
}

/** Kode balasan mesin dianggap berhasil kalau kosong atau "OK". */
export function berhasil(kode: string | null | undefined): boolean {
  const k = (kode ?? "").trim().toUpperCase();
  return k === "" || k === "OK";
}

/**
 * Badan perintah: kosong kalau tanpa parameter, kalau ada = 4-byte LE panjang JSON + JSON UTF-8 +
 * satu byte 0. Bentuk ini yang terbukti diterima firmware FkWeb (implementasi rujukan 100xRahul/
 * biometric-attendance-server-nodejs, GET_USER_ID_LIST & GET_USER_INFO teruji di sana).
 */
export function badanPerintah(body: unknown): Buffer {
  if (body == null || (typeof body === "object" && Object.keys(body as object).length === 0)) return Buffer.alloc(0);
  const json = Buffer.from(JSON.stringify(body), "utf8");
  const awalan = Buffer.alloc(4);
  awalan.writeUInt32LE(json.length, 0);
  return Buffer.concat([awalan, json, Buffer.from([0])]);
}

/**
 * Jawaban HTTP untuk receive_cmd yang membawa perintah: response_code "OK" + cmd_code + trans_id
 * milik perintah. Firmware butuh Content-Length + Connection: close (tidak paham chunked).
 */
export function jawabanPerintah(cmdCode: string, transId: string, body: unknown): Response {
  const isi = badanPerintah(body);
  return new Response(new Uint8Array(isi), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(isi.length),
      "Connection": "close",
      "response_code": "OK",
      "cmd_code": cmdCode,
      "trans_id": transId,
    },
  });
}

export function transIdBaru(): string {
  return `qd${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** Gagalkan perintah yang terlalu lama tidak dijawab / tidak diambil. */
export async function kedaluwarsakan(prisma: Db, sekarang = new Date()) {
  await prisma.fingerspotPerintah.updateMany({
    where: { status: "terkirim", dikirimAt: { lt: new Date(sekarang.getTime() - BATAS_TUNGGU_MS) } },
    data: { status: "gagal", catatan: "Mesin tidak menjawab perintah.", selesaiAt: sekarang },
  });
  await prisma.fingerspotPerintah.updateMany({
    where: { status: "menunggu", createdAt: { lt: new Date(sekarang.getTime() - BATAS_ANTRE_MS) } },
    data: { status: "gagal", catatan: "Mesin tidak mengambil perintah (mati atau tidak tersambung internet).", selesaiAt: sekarang },
  });
}

/** Antre GET_USER_ID_LIST untuk tiap mesin cloud. Mesin yang tarikannya masih berjalan dilewati. */
export async function antreTarikPengguna(prisma: PrismaClient, userId: number | null) {
  await kedaluwarsakan(prisma);
  const mesin = await prisma.machine.findMany({ where: { mode: "cloud" }, select: { id: true, name: true } });
  const diantre: string[] = [];
  const sedangJalan: string[] = [];
  for (const m of mesin) {
    const aktif = await prisma.fingerspotPerintah.count({ where: { machineId: m.id, status: { in: ["menunggu", "terkirim"] } } });
    if (aktif > 0) {
      sedangJalan.push(m.name);
      continue;
    }
    await prisma.fingerspotPerintah.create({
      data: { machineId: m.id, transId: transIdBaru(), cmdCode: "GET_USER_ID_LIST", body: {}, dibuatOleh: userId },
    });
    diantre.push(m.name);
  }
  return { diantre, sedangJalan };
}

/**
 * Dipanggil saat mesin `receive_cmd`: ambil SATU perintah menunggu untuk mesin ini dan tandai
 * terkirim. Klaim lewat updateMany bersyarat supaya dua cek yang berbarengan tidak mengirim
 * perintah yang sama dua kali.
 */
export async function ambilPerintahUntukMesin(prisma: PrismaClient, machineId: number) {
  const calon = await prisma.fingerspotPerintah.findFirst({
    where: { machineId, status: "menunggu" },
    orderBy: { id: "asc" },
  });
  if (!calon) return null;
  const { count } = await prisma.fingerspotPerintah.updateMany({
    where: { id: calon.id, status: "menunggu" },
    data: { status: "terkirim", dikirimAt: new Date() },
  });
  return count === 1 ? calon : null;
}

/**
 * Dipanggil saat mesin `send_cmd_result`. Catat jawabannya; jawaban daftar PIN memicu
 * GET_USER_INFO untuk PIN yang belum terdaftar, jawaban info pengguna membuat karyawannya.
 * Null kalau trans_id bukan perintah kita.
 */
export async function terimaHasil(
  prisma: PrismaClient,
  machineId: number,
  transId: string | null,
  kodeBalasan: string | null,
  data: unknown,
  mentah?: Buffer,
) {
  if (!transId) return null;
  const p = await prisma.fingerspotPerintah.findUnique({ where: { transId } });
  if (!p || p.machineId !== machineId) return null;
  const ok = berhasil(kodeBalasan);
  const blob = mentah ? pecahBlob(mentah) : [];
  // Simpan blob (maks 4 KB, base64) bersama JSON-nya: bentuk rekaman mesin belum terdokumentasi,
  // jadi byte aslinya perlu bisa diperiksa kalau pembacaan PIN meleset.
  const disimpan = {
    ...((data ?? {}) as Record<string, unknown>),
    ...(blob.length ? { _blob: blob.map((b) => b.subarray(0, 4096).toString("base64")) } : {}),
  };
  await prisma.fingerspotPerintah.update({
    where: { id: p.id },
    data: {
      status: ok ? "selesai" : "gagal",
      kodeBalasan: kodeBalasan ?? null,
      hasil: disimpan as Prisma.InputJsonValue,
      selesaiAt: new Date(),
      catatan: ok ? null : `Mesin menolak perintah (${kodeBalasan}).`,
    },
  });
  if (!ok) return { cmdCode: p.cmdCode, ok };

  if (p.cmdCode === "GET_USER_ID_LIST") {
    const dariBlob = pinDariBlob(data, blob);
    const pins = dariBlob ?? ambilPinMesin(data);
    const jumlahDiMesin = Number((data as { user_id_count?: unknown } | null)?.user_id_count);
    if (pins.size === 0 && jumlahDiMesin > 0) {
      await prisma.fingerspotPerintah.update({
        where: { id: p.id },
        data: { status: "gagal", catatan: `Mesin punya ${jumlahDiMesin} user, tapi daftar PIN-nya belum bisa dibaca. Laporkan ke Qaloka.` },
      });
      return { cmdCode: p.cmdCode, ok: false };
    }
    const terdaftar = new Set(
      (await prisma.machineEnrollment.findMany({ where: { machineId }, select: { pin: true } })).map((e) => e.pin),
    );
    const baru = [...pins.entries()].filter(([pin]) => !terdaftar.has(pin)).slice(0, MAKS_INFO_PER_TARIKAN);
    for (const [, mentah] of baru) {
      await prisma.fingerspotPerintah.create({
        data: { machineId, transId: transIdBaru(), cmdCode: "GET_USER_INFO", body: { user_id: mentah }, dibuatOleh: p.dibuatOleh },
      });
    }
    await prisma.fingerspotPerintah.update({
      where: { id: p.id },
      data: { catatan: `${pins.size} PIN di mesin, ${baru.length} belum ada di Direktori.` },
    });
    return { cmdCode: p.cmdCode, ok, pin: pins.size, baru: baru.length };
  }

  if (p.cmdCode === "GET_USER_INFO") {
    const diminta = normalisasiPin((p.body as { user_id?: unknown } | null)?.user_id);
    const info = ambilInfoPengguna(data);
    const pin = info?.pin ?? diminta;
    if (!pin) return { cmdCode: p.cmdCode, ok };
    const hasil = await upsertEnrollment(machineId, pin, info?.nama ?? null);
    const catatan =
      hasil === "created" ? `Karyawan dibuat untuk PIN ${pin}.`
      : hasil === "renamed" ? `Nama PIN ${pin} diperbarui.`
      : `PIN ${pin} tidak dibuat (sudah ada, atau batas karyawan di langganan penuh).`;
    await prisma.fingerspotPerintah.update({ where: { id: p.id }, data: { catatan } });
    return { cmdCode: p.cmdCode, ok, hasil };
  }
  return { cmdCode: p.cmdCode, ok };
}

export type RingkasanTarikan = {
  mesin: string;
  status: "berjalan" | "selesai" | "gagal";
  mulai: Date;
  pinDiMesin: number | null;
  belumAda: number;
  dibuat: number;
  catatan: string | null;
};

/** Ringkasan tarikan terakhir per mesin (60 menit terakhir) untuk layar Direktori. */
export async function ringkasanTarikan(prisma: PrismaClient): Promise<RingkasanTarikan[]> {
  await kedaluwarsakan(prisma);
  const sejak = new Date(Date.now() - 60 * 60_000);
  const daftar = await prisma.fingerspotPerintah.findMany({
    where: { createdAt: { gte: sejak } },
    include: { machine: { select: { name: true } } },
    orderBy: { id: "asc" },
  });
  const perMesin = new Map<number, typeof daftar>();
  for (const p of daftar) {
    // Tarikan baru dimulai di tiap GET_USER_ID_LIST: buang riwayat sebelumnya untuk mesin itu.
    if (p.cmdCode === "GET_USER_ID_LIST") perMesin.set(p.machineId, []);
    perMesin.get(p.machineId)?.push(p);
  }
  const hasil: RingkasanTarikan[] = [];
  for (const rangkaian of perMesin.values()) {
    if (rangkaian.length === 0) continue;
    const kepala = rangkaian[0];
    const info = rangkaian.slice(1);
    const jumlah = Number((kepala.hasil as { user_id_count?: unknown } | null)?.user_id_count);
    const pinDiMesin = kepala.status === "selesai" ? (jumlah > 0 ? jumlah : ambilDaftarPin(kepala.hasil).length) : null;
    // Tarikan lama (sebelum blob dibaca, 18 Okt) tercatat "selesai" tanpa satu PIN pun terbaca;
    // jangan sampai terbaca "semuanya sudah ada". Tandanya: catatan "0 PIN di mesin" padahal mesin
    // melaporkan punya user.
    const tidakTerbaca = kepala.status === "selesai" && jumlah > 0 && /^0 PIN di mesin/.test(kepala.catatan ?? "");
    const dibuat = info.filter((x) => x.catatan?.startsWith("Karyawan dibuat")).length;
    const berjalan = rangkaian.some((x) => x.status === "menunggu" || x.status === "terkirim");
    hasil.push({
      mesin: kepala.machine.name,
      status: berjalan ? "berjalan" : kepala.status === "gagal" || tidakTerbaca ? "gagal" : "selesai",
      mulai: kepala.createdAt,
      pinDiMesin,
      belumAda: info.length,
      dibuat,
      catatan: tidakTerbaca
        ? `Mesin punya ${jumlah} user, tapi daftar PIN-nya belum terbaca. Tekan Tarik dari mesin lagi.`
        : kepala.status === "gagal" ? kepala.catatan : null,
    });
  }
  return hasil;
}
