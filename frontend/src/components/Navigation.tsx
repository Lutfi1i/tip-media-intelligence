"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { pollSources } from "@/lib/api";

const navItems = [
  { label: "Dashboard", href: "/", pathDisplay: "app.tipmedia.id/dashboard" },
  { label: "Peta Wilayah", href: "/peta", pathDisplay: "app.tipmedia.id/peta" },
  {
    label: "Monitoring",
    href: "/monitoring",
    pathDisplay: "app.tipmedia.id/monitoring",
  },
  {
    label: "Isu & Alert",
    href: "/isu",
    pathDisplay: "app.tipmedia.id/isu",
  },
  { label: "Kasus", href: "/kasus", pathDisplay: "app.tipmedia.id/kasus" },
  {
    label: "Laporan",
    href: "/laporan",
    pathDisplay: "app.tipmedia.id/laporan",
  },
  {
    label: "Audit & Evaluasi",
    href: "/audit",
    pathDisplay: "app.tipmedia.id/audit",
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState("Pimpinan");
  const [isPolling, setIsPolling] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const activeNav =
    navItems.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    ) || navItems[0];

  const handleSyncRealData = async () => {
    setIsPolling(true);
    setSyncMessage(null);
    try {
      const res = await pollSources(true);
      const baru = res.total_baru ?? 0;
      const dibaca = res.total_dibaca ?? 0;
      setSyncMessage(`Sinkronisasi berhasil: ${baru} berita baru dari ${dibaca} item feed resmi.`);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setSyncMessage(err.message || "Gagal menyinkronkan data berita nyata");
    } finally {
      setIsPolling(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] text-slate-900">
      {/* Top Context Bar matching PRD mockup header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="hidden sm:flex items-center space-x-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-xs sm:text-sm font-mono text-slate-500 truncate">
            {activeNav.pathDisplay}
          </span>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleSyncRealData}
            disabled={isPolling}
            className="min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPolling ? "bg-amber-300 animate-pulse" : "bg-emerald-400"
              }`}
            />
            {isPolling ? "Menarik Feed Nyata..." : "Tarik Berita Nyata"}
          </button>

          <div className="hidden md:flex items-center bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1">
            <label htmlFor="role-select" className="text-xs text-slate-500 mr-1.5">
              Peran:
            </label>
            <select
              id="role-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="Pimpinan">Pimpinan</option>
              <option value="Analis">Analis / Verifikator</option>
              <option value="Supervisor">Supervisor</option>
              <option value="PIC Unit">PIC Unit</option>
              <option value="Admin">Admin</option>
              <option value="Auditor">Auditor</option>
            </select>
          </div>

          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
            Feed Nyata Aktif
          </span>
        </div>
      </header>

      {syncMessage && (
        <div className="bg-slate-900 text-emerald-300 text-xs px-6 py-2 flex items-center justify-between border-b border-slate-800">
          <span>{syncMessage}</span>
          <span className="font-mono text-[11px] text-slate-400">Memperbarui tampilan...</span>
        </div>
      )}

      {/* Main Workspace with Left Dark Navy Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Vertical Sidebar (Desktop) */}
        <aside className="hidden md:flex md:w-56 lg:w-60 bg-[#0F172A] text-white flex-col justify-between shrink-0 select-none">
          <div className="p-5">
            {/* Brand Logo matching PRD Slide 8-11 */}
            <Link
              href="/"
              className="flex items-baseline space-x-1.5 px-3 pb-6 mb-4 border-b border-slate-800"
            >
              <span className="text-xl font-extrabold tracking-tight text-white">
                TIP
              </span>
              <span className="text-xl font-extrabold tracking-tight text-blue-400">
                MI
              </span>
            </Link>

            <nav className="space-y-1.5" aria-label="Menu Utama">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-[#2563EB] text-white"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-5 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Wilayah Pilot</div>
            <div>DKI Jakarta &amp; Bodetabek</div>
            <div className="pt-2 text-[11px] text-slate-500">
              PT Technosoft Indo Prima
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Bar (< md) */}
        <nav
          className="flex md:hidden overflow-x-auto bg-[#0F172A] px-3 py-2 space-x-1.5 border-b border-slate-800"
          aria-label="Menu Mobile"
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap min-h-[44px] inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-[#2563EB] text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell as Navigation };
