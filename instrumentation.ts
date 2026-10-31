/**
 * Dijalankan sekali saat server Next menyala. Satu-satunya tugasnya sekarang: mulai menyegarkan
 * kunci lisensi Qaloka (saat menyala, lalu tiap 6 jam). Hanya di runtime Node — pembaca
 * lisensi memakai node:crypto dan node:fs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { mulaiPenyegaranBerkala } = await import("@/lib/lisensi/layanan");
    mulaiPenyegaranBerkala();
  }
}
