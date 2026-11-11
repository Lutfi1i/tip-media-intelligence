import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/Navigation";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

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
    <html lang="id" className={plusJakartaSans.variable}>
      <body className={`${plusJakartaSans.className} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
