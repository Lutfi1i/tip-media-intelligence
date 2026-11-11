"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  LayoutDashboard, 
  MapPin, 
  Sliders, 
  AlertTriangle, 
  KanbanSquare, 
  FileText, 
  ShieldCheck, 
  Play, 
  CheckCircle2, 
  UserCheck 
} from "lucide-react";
import { triggerFloodScenario } from "@/lib/api";

export function Navigation() {
  const pathname = usePathname();
  const [role, setRole] = useState("Pimpinan");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Peta Wilayah", href: "/peta", icon: MapPin },
    { label: "Monitoring", href: "/monitoring", icon: Sliders },
    { label: "Isu & Alert", href: "/isu", icon: AlertTriangle },
    { label: "Kasus", href: "/kasus", icon: KanbanSquare },
    { label: "Laporan", href: "/laporan", icon: FileText },
    { label: "Audit & Evaluasi", href: "/audit", icon: ShieldCheck },
  ];

  const handleTriggerSimulation = async () => {
    setIsSimulating(true);
    setSimMessage(null);
    try {
      const res = await triggerFloodScenario();
      setSimMessage(res.message || "Skenario Banjir Kemang terpasang.");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setSimMessage(err.message || "Gagal memicu simulasi");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <header className="bg-navy-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white tracking-wider shadow-sm">
                TIP
              </div>
              <div>
                <div className="text-base font-bold tracking-tight text-white leading-none">
                  TIP Media Intelligence
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  Sistem Deteksi Dini & Respon Krisis
                </div>
              </div>
            </Link>

            {/* Pilot Tag */}
            <div className="hidden lg:flex items-center text-xs bg-slate-800/80 text-blue-300 px-2.5 py-1 rounded-full border border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              Pilot: DKI Jakarta & Bodetabek
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions & Role Switcher */}
          <div className="flex items-center space-x-3">
            {/* Scenario Demo Trigger */}
            <button
              onClick={handleTriggerSimulation}
              disabled={isSimulating}
              className="hidden sm:inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-sm disabled:opacity-50"
              title="Jalankan skenario uji Banjir Jakarta Selatan 05:40 - 09:00"
            >
              <Play className="w-3.5 h-3.5 mr-1 fill-current" />
              {isSimulating ? "Menyiapkan..." : "Skenario Demo"}
            </button>

            {/* Role Switcher */}
            <div className="flex items-center text-xs bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
                aria-label="Pilih Peran Pengguna"
              >
                <option value="Pimpinan" className="bg-slate-800 text-white">Peran: Pimpinan</option>
                <option value="Analis" className="bg-slate-800 text-white">Peran: Analis / Verifikator</option>
                <option value="Supervisor" className="bg-slate-800 text-white">Peran: Supervisor</option>
                <option value="PIC Unit" className="bg-slate-800 text-white">Peran: PIC Unit (Dinas SDA)</option>
                <option value="Admin" className="bg-slate-800 text-white">Peran: Admin Sistem</option>
                <option value="Auditor" className="bg-slate-800 text-white">Peran: Auditor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center whitespace-nowrap px-2.5 py-1 rounded text-xs font-medium ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {simMessage && (
          <div className="bg-blue-950 border border-blue-800 text-blue-200 text-xs px-3 py-1.5 rounded my-1 flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2" />
              {simMessage}
            </div>
            <span className="text-slate-400 font-mono text-[11px]">Auto refresh...</span>
          </div>
        )}
      </div>
    </header>
  );
}
