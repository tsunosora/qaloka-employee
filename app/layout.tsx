import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-mono-x",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qaloka Employee",
  description: "Absensi, penilaian, dan kinerja karyawan.",
  // Aplikasi internal — jangan diindeks mesin pencari.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

// Runs before paint to apply the stored theme (default: dark) and avoid FOUC.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var dark=t?t==='dark':true;var c=document.documentElement.classList;c.toggle('dark',dark);c.toggle('light',!dark);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${jakarta.variable} ${inter.variable} ${mono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
