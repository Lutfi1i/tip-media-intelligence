import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "TIP Media Intelligence - Deteksi Dini & Respon Krisis",
  description: "Platform Intelijen Media Berbasis AI & Pendukung Keputusan Pimpinan",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between">
            <div>
              &copy; 2026 PT Technosoft Indo Prima. Hak cipta dilindungi.
            </div>
            <div className="mt-2 sm:mt-0 space-x-4">
              <span>Wilayah Pilot: DKI Jakarta & Bodetabek</span>
              <span>&bull;</span>
              <span>Versi 1.0 (MVP)</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
