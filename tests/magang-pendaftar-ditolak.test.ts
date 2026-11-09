import { describe, it, expect } from "vitest";
import { pesanDitolak } from "@/lib/services/magang/pendaftaran";

/** Temuan simulasi 7 Nov 2026: "…periode berikutnya Hubungi pengawas." — alasan tersambung tanpa titik. */
describe("pesan pendaftar ditolak", () => {
  it("alasan tanpa titik diberi titik sebelum 'Hubungi pengawas.'", () => {
    expect(pesanDitolak("Kuota PKL November sudah penuh")).toBe("Pendaftaran magangmu tidak disetujui: Kuota PKL November sudah penuh. Hubungi pengawas.");
  });
  it("alasan yang sudah bertanda akhir tidak diberi titik ganda", () => {
    expect(pesanDitolak("Kuota penuh!")).toBe("Pendaftaran magangmu tidak disetujui: Kuota penuh! Hubungi pengawas.");
    expect(pesanDitolak("  Data kurang lengkap.  ")).toBe("Pendaftaran magangmu tidak disetujui: Data kurang lengkap. Hubungi pengawas.");
  });
  it("tanpa alasan", () => {
    expect(pesanDitolak(null)).toBe("Pendaftaran magangmu tidak disetujui. Hubungi pengawas.");
  });
});
