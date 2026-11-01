/**
 * Klien integrasi PosPro (kasir) — dipakai untuk menarik KPI kinerja karyawan.
 *
 * Endpoint di sisi PosPro: `/integrations/staff-list` & `/integrations/staff-kpi`,
 * dijaga tiket integrasi `qi1` dari qendali.com (lihat backend/src/auth/api-key.guard.ts di repo
 * POS). Integrasi MATI bila POSPRO_API_URL / QENDALI_LISENSI_TOKEN belum diisi — semua fungsi
 * mengembalikan null, dan pemanggil harus tetap jalan tanpa data ini.
 */
import { tiketUntuk } from "@/lib/lisensi/tiket-integrasi";
import { kunciLamaDiizinkan } from "@/lib/lisensi/kunci-lama";

export type PosproStaff = {
  userId: number;
  name: string;
  email: string;
  branchId: number | null;
  isActive: boolean;
};

export type PosproCsRating = {
  count: number;
  avgStars: number;
  satisfiedCount: number;
  satisfactionRate: number;
};

export type PosproTasks = {
  assigned: number;
  done: number;
  late: number;
  completionRate: number;
};

export type PosproSales = {
  transactions: number;
  grandTotal: number;
  averageTicket: number;
};

export type PosproStaffKpi = {
  userId: number;
  name: string;
  branchId: number | null;
  isActive: boolean;
  csRating: PosproCsRating;
  tasks: PosproTasks;
  sales: PosproSales;
};

export type PosproKpiResponse = {
  from: string;
  to: string;
  branchId: number | null;
  staff: PosproStaffKpi[];
  unmatchedCashierNames: string[];
};

/** Batas tunggu panggilan ke PosPro — jangan sampai portal karyawan ikut menggantung. */
const TIMEOUT_MS = 6000;

/** Kunci API lama — cuma dipakai kalau jalan mundur QENDALI_INTEGRASI_KUNCI_LAMA=true menyala. */
function kunciLama(): string | undefined {
  return kunciLamaDiizinkan() ? process.env.POSPRO_API_KEY || undefined : undefined;
}

/**
 * Tersambung ke POS kalau alamatnya ada DAN ada cara membuktikan diri: token lisensi Qaloka
 * (untuk meminta tiket integrasi ke qaloka.com), atau kunci lama selama jalan mundur menyala.
 */
export function posproConfigured(): boolean {
  const tokenQaloka = Boolean((process.env.QENDALI_LISENSI_TOKEN || "").trim());
  return Boolean(process.env.POSPRO_API_URL && (tokenQaloka || kunciLama()));
}

async function call<T>(path: string, body?: unknown): Promise<T | null> {
  if (!posproConfigured()) return null;
  const base = process.env.POSPRO_API_URL!.replace(/\/+$/, "");
  // Tiket integrasi. Kunci API lama TIDAK pernah keluar dari server ini kecuali jalan mundur
  // QENDALI_INTEGRASI_KUNCI_LAMA=true menyala (lihat lib/lisensi/kunci-lama.ts).
  const tiket = await tiketUntuk("qendali");
  const kunci = kunciLama();
  if (!tiket && !kunci) {
    console.error(`[pospro] ${path} dilewati: tiket integrasi tidak tersedia`);
    return null;
  }

  try {
    const res = await fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(kunci ? { "x-api-key": kunci } : {}),
        ...(tiket ? { authorization: `Qendali ${tiket}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[pospro] ${path} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    // PosPro mati / jaringan putus bukan alasan untuk menggagalkan halaman pemanggil.
    console.error(`[pospro] ${path} gagal:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Daftar akun PosPro untuk dropdown pemetaan karyawan. */
export function fetchPosproStaffList(): Promise<PosproStaff[] | null> {
  return call<PosproStaff[]>("/integrations/staff-list");
}

/** KPI seluruh staf pada satu rentang tanggal (YYYY-MM-DD). */
export function fetchPosproKpi(
  fromStr: string,
  toStr: string,
  branchId?: number | null
): Promise<PosproKpiResponse | null> {
  const qs = new URLSearchParams({ from: fromStr, to: toStr });
  if (branchId) qs.set("branchId", String(branchId));
  return call<PosproKpiResponse>(`/integrations/staff-kpi?${qs.toString()}`);
}

/** KPI satu karyawan berdasarkan pemetaan `posproUserId`; null bila tak ada/tak cocok. */
export async function fetchPosproKpiForUser(
  posproUserId: number | null,
  fromStr: string,
  toStr: string
): Promise<PosproStaffKpi | null> {
  if (!posproUserId) return null;
  const data = await fetchPosproKpi(fromStr, toStr);
  return data?.staff.find((s) => s.userId === posproUserId) ?? null;
}

/**
 * Apakah karyawan ini punya PIN di PosPro (PIN desainer/piket) yang bisa dipakai
 * untuk masuk ke portal? false bila belum dipetakan, tak punya PIN, atau PosPro mati.
 */
export async function posproPinAvailable(posproUserId: number | null): Promise<boolean> {
  if (!posproUserId) return false;
  const res = await call<{ hasPin: boolean }>(`/integrations/staff-pin?userId=${posproUserId}`);
  return res?.hasPin === true;
}

/**
 * Verifikasi PIN PosPro milik karyawan. PIN-nya sendiri tak pernah diambil ke sini —
 * PosPro hanya menjawab benar/salah. false bila PosPro mati (portal jatuh ke PIN lokal).
 */
export async function verifyPosproPin(
  posproUserId: number | null,
  pin: string
): Promise<boolean> {
  if (!posproUserId || !pin) return false;
  const res = await call<{ ok: boolean }>("/integrations/staff-pin/verify", {
    userId: posproUserId,
    pin,
  });
  return res?.ok === true;
}

export type PosproDailyRow = {
  date: string;
  transactions: number;
  /** Omzet sebagai kasir (nota yang dia tutup). */
  omzet: number;
  designJobs: number;
  /** Omzet sebagai desainer (nilai nota dari order yang dia desain). */
  designOmzet: number;
  /** Jasa desain yang terjual, dipecah per jenjang (Easy A/B, Standar, Medium, Hard). */
  designServices: { level: string; qty: number; value: number }[];
  designServiceCount: number;
  /** Nilai jasa desainnya saja — ukuran bobot kesulitan pekerjaan. */
  designServiceValue: number;
  operatorJobs: number;
  /** Omzet sebagai operator (nilai item produksi, dibagi bobot kerja bersama). */
  operatorOmzet: number;
  /** Task/piket selesai tepat waktu hari itu. */
  tasksOnTime: number;
  /** Task/piket selesai tapi lewat tenggat. */
  tasksLate: number;
  /** Jumlah ketiga omzet. */
  totalOmzet: number;
};

export type PosproDaily = {
  userId: number;
  name: string;
  from: string;
  to: string;
  days: PosproDailyRow[];
  totals: Omit<PosproDailyRow, "date">;
};

/**
 * Angka harian satu karyawan (omzet kasir, order desain, kartu produksi) —
 * dipakai menampilkan "hari itu saya menghasilkan berapa" di samping absensi.
 */
export function fetchPosproDaily(
  posproUserId: number | null,
  fromStr: string,
  toStr: string
): Promise<PosproDaily | null> {
  if (!posproUserId) return Promise.resolve(null);
  const qs = new URLSearchParams({ userId: String(posproUserId), from: fromStr, to: toStr });
  return call<PosproDaily>(`/integrations/staff-daily?${qs.toString()}`);
}
