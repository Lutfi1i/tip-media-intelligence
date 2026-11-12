import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "TIP Media Intelligence - Deteksi Dini & Respon Krisis",
  description:
    "Platform Intelijen Media Berbasis AI & Pendukung Keputusan Pimpinan",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
