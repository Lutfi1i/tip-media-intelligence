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
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
