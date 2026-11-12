"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { pollSources } from "@/lib/api";
import { BrandMark } from "./RadarUi";
import { ThemeToggle } from "./ThemeToggle";

const navSections = [
  {
    group: "MONITORING LIVE",
    groupColor: "text-sky-500 dark:text-sky-400",
    items: [
      {
        label: "Dashboard",
        href: "/",
        pathDisplay: "radar.tipmedia.id/dashboard",
        iconColor: "text-sky-500",
        activeClass: "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25",
        hoverClass: "hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400",
        badge: "LIVE",
        badgeColor: "bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
      },
      {
        label: "Peta Wilayah",
        href: "/peta",
        pathDisplay: "radar.tipmedia.id/peta-sebaran",
        iconColor: "text-emerald-500",
        activeClass: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25",
        hoverClass: "hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400",
        badge: "PIXEL",
        badgeColor: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        ),
      },
      {
        label: "Monitoring Feed",
        href: "/monitoring",
        pathDisplay: "radar.tipmedia.id/listening-rules",
        iconColor: "text-purple-500",
        activeClass: "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25",
        hoverClass: "hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400",
        badge: "RULES",
        badgeColor: "bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
      {
        label: "Social Pulse",
        href: "/social-pulse",
        pathDisplay: "radar.tipmedia.id/social-pulse",
        iconColor: "text-fuchsia-500",
        activeClass: "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md shadow-fuchsia-500/25",
        hoverClass: "hover:bg-fuchsia-500/10 hover:text-fuchsia-600 dark:hover:text-fuchsia-400",
        badge: "PULSE",
        badgeColor: "bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "ANALISIS & RESPON",
    groupColor: "text-amber-500 dark:text-amber-400",
    items: [
      {
        label: "Isu",
        href: "/isu",
        pathDisplay: "radar.tipmedia.id/antrean-isu",
        iconColor: "text-amber-500",
        activeClass: "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25",
        hoverClass: "hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400",
        badge: "ANOMALI",
        badgeColor: "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      },
      {
        label: "Papan Kasus",
        href: "/kasus",
        pathDisplay: "radar.tipmedia.id/penanganan-kasus",
        iconColor: "text-rose-500",
        activeClass: "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/25",
        hoverClass: "hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400",
        badge: "SLA",
        badgeColor: "bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        label: "Laporan Eksekutif",
        href: "/laporan",
        pathDisplay: "radar.tipmedia.id/briefing-pimpinan",
        iconColor: "text-cyan-500",
        activeClass: "bg-gradient-to-r from-cyan-500 to-blue-700 text-white shadow-md shadow-cyan-500/25",
        hoverClass: "hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400",
        badge: "BRIEF",
        badgeColor: "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "TATA KELOLA",
    groupColor: "text-teal-500 dark:text-teal-400",
    items: [
      {
        label: "Audit Trail",
        href: "/audit",
        pathDisplay: "radar.tipmedia.id/integritas-log",
        iconColor: "text-teal-500",
        activeClass: "bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/25",
        hoverClass: "hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-400",
        badge: "AUDIT",
        badgeColor: "bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
    ],
  },
];

const allItems = navSections.flatMap((s) => s.items);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState("Pimpinan");
  const [isPolling, setIsPolling] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const activeNav =
    allItems.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))) ||
    allItems[0];

  const handleSyncRealData = async () => {
    setIsPolling(true);
    setSyncMessage(null);
    try {
      const res = await pollSources(true);
      const totalBaru = res.total_baru ?? 0;
      const totalDibaca = res.total_dibaca ?? 0;
      setSyncMessage(
        `Sinkronisasi tuntas: ${totalDibaca} artikel dibaca dari feed, ${totalBaru} berita baru terintegrasi ke database.`
      );
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
    <div className="min-h-screen flex flex-col bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 antialiased selection:bg-sky-500/20 transition-colors">
      {/* Top Tactical Command Header */}
      <header className="bg-white/95 dark:bg-black/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative p-1.5 rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/40 text-sky-500 group-hover:border-sky-500 transition-colors shadow-xs">
              <BrandMark className="w-5 h-5 text-sky-500" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-radarblip" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wider bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent uppercase">
                  RADAR
                </span>
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  MEDIA INTELLIGENCE
                </span>
              </div>
            </div>
          </Link>

          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate hidden md:inline">
            {activeNav.pathDisplay}
          </span>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleSyncRealData}
            disabled={isPolling}
            className="min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-mono font-bold bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-sky-500/20"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPolling ? "bg-amber-300 animate-pulse" : "bg-emerald-300"
              }`}
            />
            {isPolling ? "Menarik Feed..." : "Tarik Berita Nyata"}
          </button>

          <div className="hidden md:flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-2.5 py-1">
            <label htmlFor="role-select" className="text-xs text-zinc-500 dark:text-zinc-400 mr-1.5 font-medium font-mono">
              Peran:
            </label>
            <select
              id="role-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-transparent text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="Pimpinan" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Pimpinan</option>
              <option value="Analis" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Analis / Verifikator</option>
              <option value="Supervisor" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Supervisor</option>
              <option value="PIC Unit" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">PIC Unit</option>
              <option value="Admin" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Admin</option>
              <option value="Auditor" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Auditor</option>
            </select>
          </div>

          <ThemeToggle />

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Feed Live</span>
            <span className="sm:hidden">Live</span>
          </span>
        </div>
      </header>

      {syncMessage && (
        <div className="bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 text-xs px-6 py-2 flex items-center justify-between border-b border-sky-200 dark:border-sky-800 font-mono">
          <span className="font-medium">{syncMessage}</span>
          <span className="text-[11px] text-sky-600 dark:text-sky-400">Memperbarui tampilan...</span>
        </div>
      )}

      {/* Main Workspace with Left Colorful Radar Command Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Fixed Sidebar (Desktop) - Sesuai Gambar 1 */}
        <aside className="hidden md:flex md:w-60 lg:w-64 fixed left-0 top-14 bottom-0 bg-white dark:bg-[#07090E] border-r border-zinc-200 dark:border-zinc-800/80 flex-col justify-between shrink-0 select-none z-30 overflow-y-auto">
          <div className="p-4 space-y-6">
            <div className="px-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                <p className="text-[10px] font-mono font-black tracking-widest uppercase text-sky-600 dark:text-sky-400">
                  PUSAT KOMANDO
                </p>
              </div>
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                DKI Jakarta &amp; Bodetabek
              </p>
            </div>

            <nav className="space-y-6" aria-label="Menu Pusat Komando">
              {navSections.map((sec) => (
                <div key={sec.group} className="space-y-1.5">
                  <div className="px-3 flex items-center justify-between">
                    <p className={`text-[10px] font-mono font-bold tracking-wider uppercase ${sec.groupColor}`}>
                      {sec.group}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {sec.items.map((item) => {
                      const isActive =
                        item.href === "/"
                          ? pathname === "/"
                          : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                            isActive
                              ? item.activeClass
                              : `text-zinc-600 dark:text-zinc-400 ${item.hoverClass} hover:bg-zinc-100 dark:hover:bg-zinc-900/60`
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={isActive ? "text-white" : item.iconColor}>
                              {item.icon}
                            </span>
                            <span className={isActive ? "font-bold text-white" : "font-semibold"}>
                              {item.label}
                            </span>
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                isActive
                                  ? "bg-white/20 text-white"
                                  : item.badgeColor
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 bg-white/40 dark:bg-zinc-950/40 text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 font-mono">Radar Status</span>
              <span className="font-mono text-emerald-500 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500 font-mono">Kemendagri</span>
              <span className="font-mono text-sky-500 font-bold">14 Wilayah Aktif</span>
            </div>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/60 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
              PT Technosoft Indo Prima
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Bar (< md) */}
        <nav
          className="flex md:hidden overflow-x-auto bg-white dark:bg-black px-3 py-2 space-x-1.5 border-b border-zinc-200 dark:border-zinc-800"
          aria-label="Menu Mobile"
        >
          {allItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  isActive
                    ? item.activeClass
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span className={isActive ? "text-white" : item.iconColor}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main Content Area (Offset with ml for fixed sidebar on md+) */}
        <main className="flex-1 md:ml-60 lg:ml-64 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell as Navigation };
