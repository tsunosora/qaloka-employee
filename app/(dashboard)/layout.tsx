import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { keadaanLisensi } from "@/lib/lisensi/layanan";
import { LisensiProvider, PenjagaHalaman, SpandukLisensi } from "@/components/lisensi/Lisensi";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  // Gagal-terbuka: pembacaan lisensi yang gagal = tampilan tanpa saringan apa pun.
  const k = await keadaanLisensi().catch(() => null);
  const lisensi = k
    ? { ditegakkan: k.ditegakkan, status: k.status, hanyaBaca: k.hanyaBaca, alasan: k.alasan, fitur: k.fitur,
        sisaHari: k.sisaHari, sisaHariTenggang: k.sisaHariTenggang }
    : null;

  return (
    <LisensiProvider nilai={lisensi}>
    <div className="ambient relative flex min-h-screen bg-bg print:block print:min-h-0">
      {/* print:hidden — halaman cetak (mis. rapor magang) tanpa menu & kepala. */}
      <div className="contents print:hidden">
        <Sidebar role={session.user?.role} />
      </div>
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="contents print:hidden">
          <Header name={session.user?.name} role={session.user?.role} />
        </div>
        <main className="min-w-0 flex-1 p-4 sm:p-6 print:p-0">
          <SpandukLisensi />
          <PenjagaHalaman>{children}</PenjagaHalaman>
        </main>
      </div>
    </div>
    </LisensiProvider>
  );
}
