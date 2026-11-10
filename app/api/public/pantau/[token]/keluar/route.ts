import { cookies } from "next/headers";
import { route } from "@/lib/http";
import { PANTAU_COOKIE } from "@/lib/services/magang/pantau";
import { responsPantau } from "@/lib/services/magang/pantau-db";

/** PUBLIK — keluar (hapus cookie sesi guru). */
export const POST = route(async () => {
  (await cookies()).delete(PANTAU_COOKIE);
  return responsPantau({ ok: true });
});
