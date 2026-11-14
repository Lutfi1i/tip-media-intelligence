"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AuthUser,
  DATA_SYNCED_EVENT,
  checkBackendOnline,
  fetchCurrentUser,
  pollSources,
} from "@/lib/api";
import {
  ChevronDown,
  Flame,
  Hash,
  LayoutDashboard,
  MapPinned,
  Menu,
  Radio,
  ScrollText,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { BrandMark } from "./RadarUi";
import { ThemeToggle } from "./ThemeToggle";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";

type NavItem = {
  label: string;
  href: string;
  icon3dGradient: string;
  activeClass: string;
  hoverClass: string;
  icon: React.ReactNode;
  /** Menu yang belum dibangun: tampil redup dan tidak bisa diklik. */
  disabled?: boolean;
  [extra: string]: unknown;
};

type NavSection = { group: string; groupColor: string; items: NavItem[] };

function trendItem(label: string, href: string, Icon: typeof Flame, disabled = false): NavItem {
  return {
    label,
    href,
    disabled,
    icon3dGradient: "from-fuchsia-400 via-fuchsia-500 to-violet-700 shadow-fuchsia-500/35",
    activeClass: "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-500/25",
    hoverClass: "hover:bg-fuchsia-500/10 hover:text-fuchsia-600 dark:hover:text-fuchsia-400",
    icon: <Icon className="w-4 h-4" aria-hidden="true" />,
  };
}

// Menu Tren Sosial (docs/rencana-trend-intelligence.md). Tandai disabled bila menu belum dibangun.
const trendSection: NavSection = {
  group: "TREN SOSIAL",
  groupColor: "text-fuchsia-500 dark:text-fuchsia-400",
  items: [
    trendItem("Dashboard Tren", "/tren", LayoutDashboard),
    trendItem("Tren Wilayah", "/tren/wilayah", MapPinned),
    trendItem("Live Social Monitoring", "/tren/live", Radio),
    trendItem("Konten Viral", "/tren/viral", Flame),
    trendItem("Hashtag & Keyword", "/tren/hashtag", Hash),
    trendItem("Influencer & Akun", "/tren/akun", Users),
    trendItem("AI Trend Analysis", "/tren/ai", Sparkles),
    trendItem("Laporan & Insight", "/tren/laporan", ScrollText),
  ],
};

function isNavActive(href: string, pathname: string): boolean {
  // "/" dan "/tren" adalah induk menu lain, jadi harus cocok persis.
  if (href === "/" || href === "/tren") return pathname === href;
  return pathname.startsWith(href);
}

const navSections: NavSection[] = [
  trendSection,
  {
    group: "MONITORING LIVE",
    groupColor: "text-sky-500 dark:text-sky-400",
    items: [
      {
        label: "Dashboard Krisis",
        href: "/",
        pathDisplay: "radar.tipmedia.id/dashboard",
        iconColor: "text-sky-500",
        icon3dGradient: "from-sky-400 via-sky-500 to-blue-700 shadow-sky-500/35",
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
        icon3dGradient: "from-emerald-400 via-emerald-500 to-teal-700 shadow-emerald-500/35",
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
        icon3dGradient: "from-purple-400 via-purple-500 to-indigo-700 shadow-purple-500/35",
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
        icon3dGradient: "from-fuchsia-400 via-fuchsia-500 to-pink-700 shadow-fuchsia-500/35",
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
        icon3dGradient: "from-amber-400 via-amber-500 to-orange-700 shadow-amber-500/35",
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
        icon3dGradient: "from-rose-400 via-rose-500 to-red-700 shadow-rose-500/35",
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
        icon3dGradient: "from-cyan-400 via-sky-500 to-blue-700 shadow-cyan-500/35",
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
        icon3dGradient: "from-teal-400 via-emerald-500 to-teal-700 shadow-teal-500/35",
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
      {
        label: "Pengguna & RBAC",
        href: "/pengguna",
        pathDisplay: "radar.tipmedia.id/pengguna-rbac",
        iconColor: "text-indigo-500",
        icon3dGradient: "from-indigo-400 via-indigo-500 to-violet-700 shadow-indigo-500/35",
        activeClass: "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25",
        hoverClass: "hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400",
        badge: "RBAC",
        badgeColor: "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
    ],
  },
];

/** Menu yang butuh peran tertentu. Backend juga menolak akses; ini hanya menyembunyikan menu. */
const ROLE_ONLY: Record<string, string[]> = {
  "/pengguna": ["admin"],
};

function canSee(href: string, user: AuthUser | null): boolean {
  const roles = ROLE_ONLY[href];
  // Tanpa login (AUTH_REQUIRED=false) semua menu tampil, seperti perilaku backend.
  if (!roles || !user) return true;
  return roles.includes(user.role);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [crisisPref, setCrisisPref] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem("tip_nav_krisis");
      if (v === "1" || v === "0") setCrisisPref(v === "1");
    } catch {
      // abaikan
    }
  }, []);

  // Ctrl+K / Cmd+K membuka pencarian dari halaman mana pun.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tutup drawer mobile setiap pindah halaman.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Indikator koneksi: cek backend saat dibuka lalu tiap 60 detik.
  useEffect(() => {
    let alive = true;
    const check = () => checkBackendOnline().then((ok) => alive && setBackendOnline(ok));
    check();
    const id = window.setInterval(check, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!syncMessage) return;
    const id = window.setTimeout(() => setSyncMessage(null), 8000);
    return () => window.clearTimeout(id);
  }, [syncMessage]);

  useEffect(() => {
    if (pathname === "/login") return;
    fetchCurrentUser().then((res) => {
      setAuthUser(res.user);
      if (res.auth_required && !res.authenticated) {
        router.replace("/login");
      }
    });
  }, [pathname, router]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("tip_token");
    }
    setAuthUser(null);
    router.push("/login");
  };

  const visibleSections = navSections
    .map((sec) => ({ ...sec, items: sec.items.filter((i) => canSee(i.href, authUser)) }))
    .filter((sec) => sec.items.length > 0);
  const visibleItems = visibleSections.flatMap((sec) => sec.items);

  // Modul krisis lama dilipat agar menu Tren Sosial tetap ringkas; terbuka otomatis bila
  // halaman aktif ada di dalamnya, dan pilihan buka/tutup diingat.
  const crisisSections = visibleSections.filter((sec) => sec.group !== trendSection.group);
  const inCrisis = crisisSections.some((sec) => sec.items.some((i) => isNavActive(i.href, pathname)));
  const crisisOpen = crisisPref ?? inCrisis;
  const toggleCrisis = () => {
    const next = !crisisOpen;
    setCrisisPref(next);
    try {
      window.localStorage.setItem("tip_nav_krisis", next ? "1" : "0");
    } catch {
      // abaikan
    }
  };
  const shownSections = crisisOpen ? visibleSections : visibleSections.filter((sec) => sec.group === trendSection.group);
  const crisisCount = crisisSections.reduce((n, sec) => n + sec.items.length, 0);
  const crisisToggle = (
    <button
      type="button"
      onClick={toggleCrisis}
      aria-expanded={crisisOpen}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
    >
      <span>Modul monitoring krisis ({crisisCount})</span>
      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${crisisOpen ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
  );

  const handleSyncRealData = async () => {
    setIsPolling(true);
    setSyncMessage(null);
    try {
      const res = await pollSources(true);
      const totalBaru = res.total_baru ?? 0;
      const totalDibaca = res.total_dibaca ?? 0;
      setSyncMessage({
        tone: "ok",
        text: `Selesai: ${totalDibaca} artikel dibaca, ${totalBaru} berita baru masuk.`,
      });
      setBackendOnline(true);
      // Halaman yang terbuka memuat ulang datanya sendiri; filter dan posisi scroll tetap.
      window.dispatchEvent(new Event(DATA_SYNCED_EVENT));
    } catch (err: any) {
      setSyncMessage({ tone: "error", text: err.message || "Gagal menarik berita. Periksa koneksi ke backend." });
    } finally {
      setIsPolling(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 antialiased selection:bg-sky-500/20 transition-colors">
      {/* Top Tactical Command Header */}
      <header className="bg-white/95 dark:bg-black/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu"
            aria-expanded={drawerOpen}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
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
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Cari (Ctrl+K)"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-100 px-2.5 text-xs text-zinc-500 hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Cari isu...</span>
            <kbd className="hidden lg:inline rounded border border-zinc-300 px-1 text-3xs dark:border-zinc-700">Ctrl K</kbd>
          </button>

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
            <span className="hidden sm:inline">{isPolling ? "Menarik Feed..." : "Tarik Berita Nyata"}</span>
            <span className="sm:hidden">{isPolling ? "Menarik..." : "Tarik"}</span>
          </button>

          <NotificationBell userNama={authUser?.nama || "Pengguna tanpa login"} />

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {authUser ? (
            <button
              onClick={handleLogout}
              className="hidden sm:inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800"
              title={`Masuk sebagai ${authUser.email}`}
            >
              <span className="hidden sm:inline">{authUser.nama} </span>
              <span className="hidden md:inline text-zinc-500 dark:text-zinc-400 capitalize">({authUser.role}) </span>
              Keluar
            </button>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800"
            >
              Masuk
            </Link>
          )}

          <span
            role="status"
            title={
              backendOnline === false
                ? "Backend tidak menjawab. Data di layar mungkin sudah usang."
                : "Backend terhubung"
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border ${
              backendOnline === false
                ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                : backendOnline === null
                ? "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendOnline === false ? "bg-red-500" : backendOnline === null ? "bg-zinc-400" : "bg-emerald-500"
              }`}
            />
            <span className="hidden sm:inline">
              {backendOnline === false ? "Terputus" : backendOnline === null ? "Memeriksa" : "Terhubung"}
            </span>
          </span>
        </div>
      </header>

      {syncMessage && (
        <div
          role={syncMessage.tone === "error" ? "alert" : "status"}
          className={`text-xs px-6 py-2 flex items-center justify-between gap-3 border-b font-mono ${
            syncMessage.tone === "error"
              ? "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900"
              : "bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800"
          }`}
        >
          <span className="font-medium">{syncMessage.text}</span>
          <button
            type="button"
            onClick={() => setSyncMessage(null)}
            aria-label="Tutup pesan"
            className="opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Workspace with Left Colorful Radar Command Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Fixed Sidebar (Desktop) - Sesuai Gambar 1 */}
        <aside className="hidden md:flex md:w-60 lg:w-64 fixed left-0 top-14 bottom-0 bg-white dark:bg-[#07090E] border-r border-zinc-200 dark:border-zinc-800/80 flex-col justify-between shrink-0 select-none z-30 overflow-y-auto">
          <div className="p-4 space-y-6">
            <nav className="space-y-6" aria-label="Menu Navigasi">
              {shownSections.map((sec, si) => (
                <div key={sec.group} className="space-y-1.5">
                  {si === 1 && <div className="-mt-3 mb-3">{crisisToggle}</div>}
                  <div className="px-3 flex items-center justify-between">
                    <p className={`text-[10px] font-mono font-bold tracking-wider uppercase ${sec.groupColor}`}>
                      {sec.group}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {sec.items.map((item) => {
                      if (item.disabled) {
                        return (
                          <div
                            key={item.href}
                            aria-disabled="true"
                            title="Belum tersedia"
                            className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-zinc-100 dark:bg-zinc-900">
                                {item.icon}
                              </span>
                              <span>{item.label}</span>
                            </div>
                            <span className="text-[10px] font-semibold">Segera</span>
                          </div>
                        );
                      }
                      const isActive = isNavActive(item.href, pathname);
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
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white transition-transform duration-150 group-hover:-translate-y-0.5 ${
                                isActive
                                  ? "bg-white/20 ring-1 ring-white/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-2px_3px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.18)]"
                                  : `bg-gradient-to-br ${item.icon3dGradient} ring-1 ring-white/30 dark:ring-white/15 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.55),inset_0_-2px_3px_rgba(0,0,0,0.28)]`
                              }`}
                            >
                              <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">{item.icon}</span>
                            </span>
                            <span className={isActive ? "font-bold text-white" : "font-semibold"}>
                              {item.label}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!crisisOpen && crisisCount > 0 && <div className="-mt-3">{crisisToggle}</div>}
            </nav>
          </div>
        </aside>

        {/* Drawer navigasi mobile (< md) */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
            <nav className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] overflow-y-auto bg-white dark:bg-[#07090E] border-r border-zinc-200 dark:border-zinc-800 p-4 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Menu</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Tutup menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {shownSections.map((sec, si) => (
                <div key={sec.group} className="space-y-1">
                  {si === 1 && <div className="mb-2">{crisisToggle}</div>}
                  <p className={`px-3 text-[10px] font-mono font-bold tracking-wider uppercase ${sec.groupColor}`}>{sec.group}</p>
                  {sec.items.map((item) => {
                    if (item.disabled) {
                      return (
                        <div
                          key={item.href}
                          aria-disabled="true"
                          className="flex min-h-[44px] items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-zinc-400 dark:text-zinc-600"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-zinc-100 dark:bg-zinc-900">
                              {item.icon}
                            </span>
                            {item.label}
                          </span>
                          <span className="text-[10px]">Segera</span>
                        </div>
                      );
                    }
                    const isActive = isNavActive(item.href, pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex min-h-[44px] items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold ${
                          isActive ? item.activeClass : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white ${
                            isActive ? "bg-white/20" : `bg-gradient-to-br ${item.icon3dGradient}`
                          }`}
                        >
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
              {!crisisOpen && crisisCount > 0 && crisisToggle}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Tema</span>
                  <ThemeToggle />
                </div>
                {authUser ? (
                  <div className="px-3 space-y-2">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {authUser.nama} <span className="capitalize">({authUser.role})</span>
                    </p>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full min-h-[40px] rounded-md border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      Keluar
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="mx-3 flex min-h-[40px] items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-200"
                  >
                    Masuk
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}

        {/* Main Content Area (Offset with ml for fixed sidebar on md+) */}
        <main className="flex-1 min-w-0 md:ml-60 lg:ml-64 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        pages={visibleItems.filter((i) => !i.disabled).map((i) => ({ label: i.label, href: i.href }))}
      />
    </div>
  );
}

export { AppShell as Navigation };
