import { PenjagaPublik } from "@/components/lisensi/PenjagaPublik";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PenjagaPublik jalur="/pantau">{children}</PenjagaPublik>;
}
