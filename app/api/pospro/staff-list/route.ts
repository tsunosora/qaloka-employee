import { requireManager, json, route } from "@/lib/http";
import { fetchPosproStaffList, posproConfigured } from "@/lib/services/pospro/client";

/**
 * Daftar akun PosPro untuk memetakan karyawan (Direktori → Edit → Akun PosPro).
 * `configured: false` = POSPRO_API_URL/QENDALI_LISENSI_TOKEN belum diisi di .env;
 * `reachable: false` = konfigurasi ada tapi PosPro tak bisa dihubungi saat ini.
 */
export const GET = route(async () => {
  await requireManager();
  if (!posproConfigured()) return json({ configured: false, reachable: false, staff: [] });

  const staff = await fetchPosproStaffList();
  if (!staff) return json({ configured: true, reachable: false, staff: [] });
  return json({ configured: true, reachable: true, staff });
});
