"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { pollSources } from "@/lib/api";
import { BrandMark } from "./RadarUi";

const navSections = [
  {
    group: "MONITOR",
    items: [
      {
        label: "Dashboard",
        href: "/",
        pathDisplay: "radar.tipmedia.id/dashboard",
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
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "ANALISIS & RESPON",
    items: [
      {
        label: "Isu & Alert",
        href: "/isu",
        pathDisplay: "radar.tipmedia.id/antrean-isu",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      },
      {
        label: "Papan Kasus",
        href: "/kasus",
        pathDisplay: "radar.tipmedia.id/papan-kasus",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "OUTPUT & TATA KELOLA",
    items: [
      {
        label: "Laporan",
        href: "/laporan",
        pathDisplay: "radar.tipmedia.id/laporan-eksekutif",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        label: "Audit & Evaluasi",
        href: "/audit",
        pathDisplay: "radar.tipmedia.id/audit-governance",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState("Pimpinan");
  const [isPolling, setIsPolling] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const allItems = navSections.flatMap((s) => s.items);
  const activeNav =
    allItems.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    ) || allItems[0];

  const handleSyncRealData = async () => {
    setIsPolling(true);
    setSyncMessage(null);
    try {
      const res = await pollSources(true);
      const baru = res.total_baru ?? 0;
      const dibaca = res.total_dibaca ?? 0;
      setSyncMessage(
        `Sinkronisasi berhasil: ${baru} berita baru dari ${dibaca} item feed resmi.`
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
    <div className="min-h-screen flex flex-col bg-[#0A0F1F] text-slate-100 antialiased selection:bg-sky-500/25 selection:text-sky-200">
      {/* Top Tactical Command Header */}
      <header className="bg-[#0C1226]/95 backdrop-blur border-b border-[#1E2A4A] px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative p-1.5 rounded-lg bg-[#10172E] border border-[#1E2A4A] text-sky-400 group-hover:border-sky-500/40 transition-colors">
              <BrandMark className="w-5 h-5 text-sky-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-radarblip" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wider text-white uppercase">
                  RADAR
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  MEDIA INTELLIGENCE
                </span>
              </div>
            </div>
          </Link>

          <span className="text-slate-600 hidden sm:inline">|</span>

          <span className="text-xs font-mono text-slate-400 truncate hidden md:inline">
            {activeNav.pathDisplay}
          </span>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleSyncRealData}
            disabled={isPolling}
            className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isPolling ? "bg-amber-300 animate-pulse" : "bg-emerald-300"
              }`}
            />
            {isPolling ? "Menarik Feed..." : "Tarik Berita Nyata"}
          </button>

          <div className="hidden md:flex items-center bg-[#10172E] border border-[#1E2A4A] rounded-lg px-2.5 py-1">
            <label htmlFor="role-select" className="text-xs text-slate-400 mr-1.5 font-medium">
              Peran:
            </label>
            <select
              id="role-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="Pimpinan" className="bg-[#10172E] text-slate-200">Pimpinan</option>
              <option value="Analis" className="bg-[#10172E] text-slate-200">Analis / Verifikator</option>
              <option value="Supervisor" className="bg-[#10172E] text-slate-200">Supervisor</option>
              <option value="PIC Unit" className="bg-[#10172E] text-slate-200">PIC Unit</option>
              <option value="Admin" className="bg-[#10172E] text-slate-200">Admin</option>
              <option value="Auditor" className="bg-[#10172E] text-slate-200">Auditor</option>
            </select>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Feed Nyata Aktif</span>
            <span className="sm:hidden">Live</span>
          </span>
        </div>
      </header>

      {syncMessage && (
        <div className="bg-[#10172E] text-sky-300 text-xs px-6 py-2 flex items-center justify-between border-b border-[#1E2A4A]">
          <span className="font-medium">{syncMessage}</span>
          <span className="font-mono text-[11px] text-slate-400">Memperbarui tampilan...</span>
        </div>
      )}

      {/* Main Workspace with Left Radar Command Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Vertical Sidebar (Desktop) */}
        <aside className="hidden md:flex md:w-56 lg:w-60 bg-[#0C1226] border-r border-[#1E2A4A] flex-col justify-between shrink-0 select-none">
          <div className="p-4 space-y-6">
            <div className="px-3 pt-1">
              <p className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500">
                PUSAT KOMANDO
              </p>
              <p className="text-xs font-extrabold text-slate-200 mt-0.5">
                DKI Jakarta &amp; Bodetabek
              </p>
            </div>

            <nav className="space-y-5" aria-label="Menu Pusat Komando">
              {navSections.map((sec) => (
                <div key={sec.group} className="space-y-1">
                  <p className="px-3 text-[10px] font-mono font-bold tracking-wider uppercase text-slate-500">
                    {sec.group}
                  </p>
                  <div className="space-y-0.5">
                    {sec.items.map((item) => {
                      const isActive =
                        item.href === "/"
                          ? pathname === "/"
                          : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                            isActive
                              ? "bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-xs"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                          }`}
                        >
                          <span className={isActive ? "text-sky-400" : "text-slate-500"}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="p-4 border-t border-[#1E2A4A] bg-[#0A0F1F]/60 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Jalur Radar</span>
              <span className="font-mono text-emerald-400 font-bold">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Kemendagri</span>
              <span className="font-mono text-slate-300">11 Wilayah</span>
            </div>
            <div className="pt-2 border-t border-[#1E2A4A]/60 text-[10px] text-slate-400 font-mono">
              PT Technosoft Indo Prima
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Bar (< md) */}
        <nav
          className="flex md:hidden overflow-x-auto bg-[#0C1226] px-3 py-2 space-x-1.5 border-b border-[#1E2A4A]"
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
                className={`whitespace-nowrap min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell as Navigation };
