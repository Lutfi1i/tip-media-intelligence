"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchSocialPulseOverview,
  fetchSocialTrends,
  fetchSocialPlatforms,
  fetchSocialCorrelations,
  fetchSocialWatchlist,
  fetchSocialFacets,
  fetchAgencyBoard,
  fetchSocialBrief,
  fetchSocialAlertEvents,
  escalateSocialSurges,
  generateSocialReport,
  getReportViewUrl,
  pollSources,
  SocialPulseOverview,
  SocialTrendingTopic,
  SocialPlatformMetric,
  SocialCorrelation,
  SocialWatchlist,
  SocialHealthState,
  SocialFacets,
  SocialAgencyBoard as AgencyBoardData,
  SocialSort,
  SocialBrief,
} from "@/lib/api";
import { SocialWatchedAccounts } from "@/components/SocialWatchedAccounts";
import { SocialContentSearch } from "@/components/SocialContentSearch";
import { LiveSocialFeed } from "@/components/LiveSocialFeed";
import { SocialHashtagCooccurrence } from "@/components/SocialHashtagCooccurrence";
import { SocialSpreadTrace } from "@/components/SocialSpreadTrace";
import { SocialFilterBar } from "@/components/SocialFilterBar";
import { SocialAgencyBoard } from "@/components/SocialAgencyBoard";
import { SocialPeriodPicker } from "@/components/SocialPeriodPicker";
import { SocialBriefCard } from "@/components/SocialBriefCard";
import { SocialPeriodComparison } from "@/components/SocialPeriodComparison";
import { SocialAlertRules } from "@/components/SocialAlertRules";
import { NOTE_STATUS_STYLE, SocialTopicNotes } from "@/components/SocialTopicNotes";
import { MediaAvatarStack, RealBrandIcon } from "@/components/SourceLogos";
import { GeographicScopeSelector } from "@/components/GeographicScopeSelector";
import { GeographicComparisonTable } from "@/components/GeographicComparisonTable";
import { SocialWatchlistPanel } from "@/components/SocialWatchlistPanel";
import { Sparkline, VelocityBadge, VolumeTimeline, formatCompact, formatWib } from "@/components/SocialCharts";

type Tab = "live" | "tren" | "cari" | "alert" | "instansi" | "akun" | "bandingkan" | "watchlist" | "perbandingan" | "platform" | "korelasi";
type ScopeMode = "context" | "strict" | "regional";


const PLATFORM_FILTERS = ["Semua", "X (Twitter)", "TikTok", "YouTube", "Threads", "Instagram", "Reddit", "Telegram"];

const HEALTH_STYLE: Record<SocialHealthState, string> = {
  aktif: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400",
  terlambat: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400",
  kosong: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400",
  gagal: "bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-400",
  belum_ditarik: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/30 dark:text-zinc-400",
  nonaktif: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/30 dark:text-zinc-400",
  tanpa_sumber: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/30 dark:text-zinc-400",
};

const HEALTH_LABEL: Record<SocialHealthState, string> = {
  aktif: "Aktif",
  terlambat: "Terlambat",
  kosong: "Tanpa konten terkini",
  gagal: "Gagal",
  belum_ditarik: "Belum ditarik",
  nonaktif: "Nonaktif",
  tanpa_sumber: "Belum ada sumber",
};

const WATCH_STORAGE_KEY = "tip.socialPulse.extraTerms";

function readStoredTerms(): string[] {
  try {
    const raw = window.localStorage.getItem(WATCH_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function storeTerms(terms: string[]) {
  try {
    window.localStorage.setItem(WATCH_STORAGE_KEY, JSON.stringify(terms));
  } catch {
    // Penyimpanan peramban tidak tersedia: kata kunci tetap berlaku sampai halaman ditutup.
  }
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Unduh tabel tren sebagai CSV (dibuat di peramban dari data yang sedang tampil). */
function downloadTrendsCsv(trends: SocialTrendingTopic[], label: string) {
  const header = [
    "peringkat", "topik", "jenis", "konten", "status_laju", "skor_laju", "pertumbuhan_pct", "rasio_baseline",
    "kategori", "instansi", "platform", "platform_pertama", "negatif_pct", "akun_unik", "isu_radar", "pertama_terdeteksi_utc", "terakhir_utc",
  ];
  const rows = trends.map((t) => [
    t.rank, t.topic, t.topic_type, t.mention_count, t.velocity_status, t.velocity_score, t.growth_pct ?? "",
    t.velocity.baseline_windows ? t.velocity.ratio : "", t.categories.map((c) => c.label).join(" | "),
    t.agencies.map((a) => a.label).join(" | "), t.platforms.join(" | "), t.propagation.origin ?? "", t.sentiment_pct.negatif,
    t.accounts.unique_accounts, t.correlated_issue?.kode_referensi ?? "", t.first_detected, t.last_seen,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `social-pulse-tren-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function growthText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Belum ada pembanding";
  return `${value >= 0 ? "+" : ""}${value}%`;
}

/** Selisih menit sebagai "+2 j 15 m", "+3 hr 4 j", atau "+40 m". */
function lagText(minutes: number): string {
  if (minutes < 60) return `+${minutes} m`;
  if (minutes < 1440) {
    const m = minutes % 60;
    return `+${Math.floor(minutes / 60)} j${m ? ` ${m} m` : ""}`;
  }
  const h = Math.floor((minutes % 1440) / 60);
  return `+${Math.floor(minutes / 1440)} hr${h ? ` ${h} j` : ""}`;
}

export default function SocialPulsePage() {
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("Semua");
  const [category, setCategory] = useState<string>("");
  const [agency, setAgency] = useState<string>("");
  const [sort, setSort] = useState<SocialSort>("laju");
  const [facets, setFacets] = useState<SocialFacets | null>(null);
  const [agencyBoard, setAgencyBoard] = useState<AgencyBoardData | null>(null);
  const [brief, setBrief] = useState<SocialBrief | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const refreshUnread = useCallback(() => {
    fetchSocialAlertEvents("baru", 1)
      .then((r) => setUnreadAlerts(r.unread))
      .catch(() => undefined);
  }, []);

  const [scopeKode, setScopeKode] = useState<string>("ID");
  const [scopeName, setScopeName] = useState<string>("Seluruh Indonesia");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("context");
  const [multiCodes, setMultiCodes] = useState<string[]>([]);
  const [isMultiSelect, setIsMultiSelect] = useState<boolean>(false);

  const [overview, setOverview] = useState<SocialPulseOverview | null>(null);
  const [trends, setTrends] = useState<SocialTrendingTopic[]>([]);
  const [platforms, setPlatforms] = useState<SocialPlatformMetric[]>([]);
  const [correlations, setCorrelations] = useState<SocialCorrelation[]>([]);
  const [watchlist, setWatchlist] = useState<SocialWatchlist | null>(null);
  const [extraTerms, setExtraTerms] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<SocialTrendingTopic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isEscalating, setIsEscalating] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("live");

  const [ready, setReady] = useState(false);

  // Filter dibaca dari URL sekali saat halaman dibuka, agar tampilan bisa dibagikan lewat tautan.
  useEffect(() => {
    setExtraTerms(readStoredTerms());
    const q = new URLSearchParams(window.location.search);
    const periode = q.get("periode");
    if (periode) setTimeRange(periode);
    if (q.get("kategori")) setCategory(q.get("kategori") as string);
    if (q.get("instansi")) setAgency(q.get("instansi") as string);
    const urut = q.get("urut");
    if (urut && ["laju", "terbaru", "volume", "negatif"].includes(urut)) setSort(urut as SocialSort);
    if (q.get("kanal")) setSelectedPlatform(q.get("kanal") as string);
    const tab = q.get("tab");
    if (tab && ["live", "tren", "cari", "alert", "instansi", "akun", "bandingkan", "watchlist", "perbandingan", "platform", "korelasi"].includes(tab)) setActiveTab(tab as Tab);
    const wilayah = q.get("wilayah");
    if (wilayah) {
      setScopeKode(wilayah);
      setScopeName(q.get("nama") || wilayah);
      const mode = q.get("mode");
      if (mode === "context" || mode === "strict" || mode === "regional") setScopeMode(mode);
    }
    setReady(true);
  }, []);

  const multiParam = multiCodes.length > 0 ? multiCodes.join(",") : undefined;
  // Label periode dari backend ("24 jam terakhir", "2026-11-01 s.d. 2026-11-03").
  const windowLabel = overview?.period.label ?? "";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const filters = { category: category || undefined, agency: agency || undefined };
      const plat = selectedPlatform === "Semua" ? undefined : selectedPlatform;
      const [ovData, trData, pfData, crData, wlData, fcData, agData, brData] = await Promise.all([
        fetchSocialPulseOverview(timeRange, scopeKode, scopeMode, multiParam, filters),
        fetchSocialTrends(plat, timeRange, 30, scopeKode, scopeMode, multiParam, filters, sort),
        fetchSocialPlatforms(scopeKode, scopeMode, multiParam, timeRange),
        fetchSocialCorrelations(scopeKode, scopeMode, multiParam),
        fetchSocialWatchlist(timeRange, scopeKode, scopeMode, multiParam, extraTerms, filters),
        fetchSocialFacets(timeRange, scopeKode, scopeMode, multiParam, plat, filters),
        fetchAgencyBoard(timeRange, scopeKode, scopeMode, multiParam, category || undefined),
        fetchSocialBrief(timeRange, scopeKode, scopeMode, multiParam, filters),
      ]);
      setBrief(brData);
      refreshUnread();
      setFacets(fcData);
      setAgencyBoard(agData);
      setOverview(ovData);
      setTrends(trData);
      setPlatforms(pfData);
      setCorrelations(crData);
      setWatchlist(wlData);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Gagal memuat data lonjakan medsos:", err);
      setLoadError("Data lonjakan medsos gagal dimuat. Periksa apakah backend berjalan, lalu muat ulang.");
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, selectedPlatform, scopeKode, scopeMode, multiParam, extraTerms, category, agency, sort, refreshUnread]);

  useEffect(() => {
    if (ready) loadData();
  }, [loadData, ready]);

  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams();
    if (timeRange !== "24h") q.set("periode", timeRange);
    if (category) q.set("kategori", category);
    if (agency) q.set("instansi", agency);
    if (sort !== "laju") q.set("urut", sort);
    if (selectedPlatform !== "Semua") q.set("kanal", selectedPlatform);
    if (activeTab !== "tren") q.set("tab", activeTab);
    if (scopeKode !== "ID") {
      q.set("wilayah", scopeKode);
      q.set("nama", scopeName);
      q.set("mode", scopeMode);
    }
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [ready, timeRange, category, agency, sort, selectedPlatform, activeTab, scopeKode, scopeName, scopeMode]);

  const handleApplyScope = (newKode: string, newName: string, newMode: ScopeMode, newMultiList?: string[]) => {
    setScopeKode(newKode);
    setScopeName(newName);
    setScopeMode(newMode);
    if (newMultiList) {
      setMultiCodes(newMultiList);
      setIsMultiSelect(true);
    } else {
      setMultiCodes([]);
      setIsMultiSelect(false);
    }
  };

  const handleManualPoll = async () => {
    setIsRefreshing(true);
    setActionMessage(null);
    setReportLink(null);
    try {
      const res = await pollSources(false);
      const esc = res?.eskalasi_medsos;
      setActionMessage(
        `Tarik data selesai: ${res?.total_baru ?? 0} konten baru, ${res?.total_gagal ?? 0} sumber gagal.` +
          (esc && (esc.created.length || esc.updated.length)
            ? ` Lonjakan medsos dieskalasi: ${esc.created.length} isu baru, ${esc.updated.length} diperbarui.`
            : "")
      );
      await loadData();
    } catch (e) {
      console.error("Gagal sinkronisasi data sosial:", e);
      setActionMessage("Tarik data gagal. Coba lagi beberapa saat.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEscalate = async () => {
    // Eskalasi hanya untuk jendela terkini; periode panjang atau kustom memakai 24 jam terakhir.
    const range = ["1h", "6h", "24h"].includes(timeRange) ? timeRange : "24h";
    setIsEscalating(true);
    setActionMessage(null);
    setReportLink(null);
    try {
      const res = await escalateSocialSurges(range);
      const parts = [
        res.created.length ? `${res.created.length} isu baru (${res.created.join(", ")})` : null,
        res.updated.length ? `${res.updated.length} isu diperbarui (${res.updated.join(", ")})` : null,
        res.skipped.length ? `${res.skipped.length} dilewati karena ditolak analis` : null,
      ].filter(Boolean);
      setActionMessage(
        parts.length
          ? `Eskalasi jendela ${range}: ${parts.join(", ")}. Isu masuk antrean verifikasi analis.`
          : `Tidak ada topik berstatus LONJAKAN TINGGI pada jendela ${range}.`
      );
      await loadData();
    } catch (e) {
      console.error(e);
      setActionMessage("Eskalasi gagal dijalankan.");
    } finally {
      setIsEscalating(false);
    }
  };

  const [reportLink, setReportLink] = useState<string | null>(null);
  const handleReport = async () => {
    setActionMessage(null);
    setReportLink(null);
    try {
      const rep = await generateSocialReport(timeRange, scopeKode);
      setReportLink(getReportViewUrl(rep.id));
      setActionMessage(`Laporan "${rep.judul}" sudah disusun.`);
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Laporan gagal disusun.");
    }
  };

  const addTerm = (term: string) => {
    if (extraTerms.some((t) => t.toLowerCase() === term.toLowerCase())) return;
    const next = [...extraTerms, term];
    setExtraTerms(next);
    storeTerms(next);
  };

  const removeTerm = (term: string) => {
    const next = extraTerms.filter((t) => t !== term);
    setExtraTerms(next);
    storeTerms(next);
  };

  const healthSummary = useMemo(() => {
    const withSource = platforms.filter((p) => p.health_state !== "tanpa_sumber");
    return {
      aktif: withSource.filter((p) => p.health_state === "aktif").length,
      total: withSource.length,
      bermasalah: withSource.filter((p) => ["gagal", "terlambat", "kosong"].includes(p.health_state)),
    };
  }, [platforms]);

  const baseline = overview?.baseline;
  const baselineIncomplete = baseline && baseline.windows_available < baseline.windows_target;
  const surgingCount = trends.filter((t) => t.velocity_status === "LONJAKAN TINGGI").length;

  const tabGroups: { group: string; tabs: { id: Tab; label: string }[] }[] = [
    {
      group: "Pantau",
      tabs: [
        { id: "live", label: "Live Medsos Lokasi" },
        { id: "tren", label: `Topik Tren (${trends.length})` },
        { id: "cari", label: "Cari Konten" },
        { id: "akun", label: "Akun Pantauan" },
      ],
    },
    {
      group: "Analisis",
      tabs: [
        { id: "instansi", label: `Instansi (${agencyBoard?.agencies.filter((a) => a.mention_count > 0).length ?? 0})` },
        { id: "korelasi", label: `Korelasi Isu RADAR (${correlations.length})` },
      ],
    },
    {
      group: "Bandingkan",
      tabs: [
        { id: "bandingkan", label: "Antar Periode" },
        { id: "perbandingan", label: "Antar Wilayah" },
      ],
    },
    {
      group: "Pengaturan",
      tabs: [
        { id: "alert", label: unreadAlerts ? `Aturan Alert (${unreadAlerts} baru)` : "Aturan Alert" },
        { id: "watchlist", label: `Watchlist (${watchlist?.active_terms ?? 0}/${watchlist?.total_terms ?? 0})` },
        { id: "platform", label: `Status Platform (${healthSummary.aktif}/${healthSummary.total})` },
      ],
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-950 p-6 text-white shadow-xl ring-1 ring-white/10">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-fuchsia-600/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs font-semibold text-fuchsia-300 ring-1 ring-fuchsia-500/30">
                <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
                MEDSOS
              </span>
              <span className="text-xs text-zinc-400">
                Diperbarui: {lastRefreshed ? lastRefreshed.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }) : "-"} WIB
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">Lonjakan Medsos</h1>
            <p className="max-w-2xl text-sm text-zinc-300">
              Pantau topik yang sedang naik di X, TikTok, YouTube, Threads, Instagram, Reddit, dan Telegram. Laju dihitung terhadap baseline periode
              sebelumnya, dan lonjakan bisa diteruskan ke antrean verifikasi analis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleManualPoll}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-900 shadow-md transition-all hover:bg-zinc-100 disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${isRefreshing ? "animate-spin text-fuchsia-600" : "text-zinc-700"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isRefreshing ? "Menarik data..." : "Tarik Data Baru"}
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-5">
          <SocialPeriodPicker value={timeRange} onChange={setTimeRange} />
        </div>

        <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <span className="mr-2 text-xs font-medium text-zinc-400">Filter kanal (tabel tren):</span>
          {PLATFORM_FILTERS.map((plat) => {
            const isSel = selectedPlatform === plat;
            return (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                aria-pressed={isSel}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isSel
                    ? "bg-fuchsia-500/25 text-white ring-1 ring-fuchsia-400"
                    : "bg-zinc-800/60 text-zinc-300 ring-1 ring-white/5 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {plat !== "Semua" && <RealBrandIcon name={plat} className="h-3.5 w-3.5" />}
                {plat}
              </button>
            );
          })}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {loadError}
        </div>
      )}
      {actionMessage && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          <span>
            {actionMessage}
            {reportLink && (
              <>
                {" "}
                <a href={reportLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                  Buka laporan
                </a>
              </>
            )}
          </span>
          <button onClick={() => { setActionMessage(null); setReportLink(null); }} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100">
            Tutup
          </button>
        </div>
      )}

      <GeographicScopeSelector
        currentScopeKode={scopeKode}
        currentScopeName={scopeName}
        currentScopeMode={scopeMode}
        multiCodes={multiCodes}
        isMultiSelect={isMultiSelect}
        onApplyScope={handleApplyScope}
        onToggleMultiSelect={setIsMultiSelect}
        dataCoverage={overview?.data_coverage}
      />

      <SocialFilterBar
        facets={facets}
        category={category}
        agency={agency}
        sort={sort}
        onCategory={setCategory}
        onAgency={setAgency}
        onSort={setSort}
      />

      {baselineIncomplete && (
        <div className="rounded-xl border border-violet-300/60 bg-violet-50 px-4 py-3 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
          <strong>Baseline masih dibangun:</strong> {baseline.windows_available} dari {baseline.windows_target} periode pembanding sebelumnya
          sudah punya data
          {baseline.coverage_since ? ` (pengumpulan medsos sejak ${formatWib(baseline.coverage_since)} WIB)` : ""}. Topik tanpa pembanding
          berstatus BARU dan belum dieskalasi otomatis. Hasil akan makin akurat setelah penarikan berkala berjalan beberapa periode.
        </div>
      )}

      {unreadAlerts > 0 && activeTab !== "alert" && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <span>
            <strong>{unreadAlerts} alert medsos baru</strong> dari aturan yang Anda buat.
          </span>
          <button onClick={() => setActiveTab("alert")} className="text-xs font-semibold underline">
            Lihat alert
          </button>
        </div>
      )}

      <SocialBriefCard brief={brief} isLoading={isLoading} />

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Percakapan</div>
          <div className="text-2xs text-zinc-500">{windowLabel}</div>
          <div className="mt-3 text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
            {isLoading && !overview ? "..." : (overview?.total_mentions ?? 0).toLocaleString("id-ID")}
          </div>
          <div className="mt-2 text-xs">
            <span
              className={`font-semibold ${
                overview?.mention_growth_pct === null || overview?.mention_growth_pct === undefined
                  ? "text-zinc-400"
                  : overview.mention_growth_pct >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500"
              }`}
            >
              {growthText(overview?.mention_growth_pct)}
            </span>
            {overview?.previous_mentions !== null && overview?.previous_mentions !== undefined && (
              <span className="ml-1 text-zinc-500 dark:text-zinc-400">vs {overview.previous_mentions} periode lalu</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Topik Terkelompok</div>
          <div className="mt-3 text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
            {isLoading && !overview ? "..." : overview?.trending_topics_count ?? 0}
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Topik dengan 2 konten atau lebih{overview?.new_trends_count ? `, ${overview.new_trends_count} tanpa pembanding` : ""}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Lonjakan &amp; Kenaikan</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
              {isLoading && !overview ? "..." : overview?.surging_trends_count ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">lonjakan tinggi</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            +{Math.max(0, (overview?.emerging_trends_count ?? 0) - (overview?.surging_trends_count ?? 0))} meningkat. Ambang: rasio &gt;= 3x atau z-score &gt;= 3,
            minimal {baseline?.min_surge_volume ?? 3} konten
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Sentimen Negatif</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">{overview ? `${overview.negative_ratio_pct}%` : "..."}</span>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">{overview?.sentiment_breakdown?.negatif ?? 0}</div>
          <div className="mt-2 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="img"
            aria-label={`Positif ${overview?.sentiment_breakdown?.positif ?? 0}, netral ${overview?.sentiment_breakdown?.netral ?? 0}, negatif ${overview?.sentiment_breakdown?.negatif ?? 0}`}>
            {(["positif", "netral", "negatif"] as const).map((k) => (
              <div
                key={k}
                title={`${k}: ${overview?.sentiment_breakdown?.[k] ?? 0}`}
                style={{ width: `${overview?.total_mentions ? ((overview.sentiment_breakdown?.[k] ?? 0) / overview.total_mentions) * 100 : 0}%` }}
                className={k === "positif" ? "bg-emerald-500" : k === "netral" ? "bg-zinc-400" : "bg-rose-500"}
              />
            ))}
          </div>
          {overview && overview.emotion_breakdown.length > 0 && (
            <p className="mt-2 text-2xs text-zinc-500" title="Persentase konten yang memuat kata emosi tersebut">
              Emosi: {overview.emotion_breakdown.slice(0, 3).map((e) => `${e.label.toLowerCase()} ${e.pct}%`).join(", ")}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Kanal &amp; Akun</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">{overview?.active_platforms_count ?? 0}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">kanal, {overview?.unique_accounts ?? 0} akun</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {Object.keys(overview?.platform_distribution ?? {}).map((p) => (
              <RealBrandIcon key={p} name={p} className="h-4 w-4" />
            ))}
            <span className="text-2xs text-zinc-500">
              Nama akun tersedia di {overview?.author_coverage_pct ?? 0}% konten
              {overview?.engagement.views ? `, ${formatCompact(overview.engagement.views)} tayangan tercatat` : ""}
            </span>
          </div>
        </div>
      </div>

      {overview && overview.timeline.length > 0 && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <VolumeTimeline data={overview.timeline} baselinePerBucket={null} title={`Volume percakapan medsos, ${windowLabel} (WIB)`} />
          {healthSummary.bermasalah.length > 0 && (
            <p className="mt-3 text-2xs text-amber-700 dark:text-amber-400">
              Perhatian: {healthSummary.bermasalah.map((p) => `${p.name} (${HEALTH_LABEL[p.health_state].toLowerCase()})`).join(", ")}. Volume dari kanal
              ini bisa lebih rendah dari kenyataan.
            </p>
          )}
        </div>
      )}

      {/* TABS */}
      <div className="flex items-end overflow-x-auto border-b border-zinc-200 dark:border-zinc-800" role="tablist" aria-label="Bagian Lonjakan Medsos">
        {tabGroups.map((g, gi) => (
          <div
            key={g.group}
            className={`flex shrink-0 flex-col ${gi > 0 ? "ml-2 border-l border-zinc-200 pl-2 dark:border-zinc-800" : ""}`}
          >
            <span className="px-4 pt-1 text-3xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{g.group}</span>
            <div className="flex">
              {g.tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                    activeTab === t.id
                      ? "border-fuchsia-600 text-fuchsia-600 dark:border-fuchsia-400 dark:text-fuchsia-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* TAB: LIVE MEDSOS LOKASI */}
      {activeTab === "live" && (
        <LiveSocialFeed
          timeRange={timeRange}
          scopeKode={scopeKode}
          scopeName={scopeName}
          scopeMode={scopeMode}
          selectedPlatform={selectedPlatform}
          onSelectPlatform={setSelectedPlatform}
          facets={facets}
          onNewPostsCount={() => {
            refreshUnread();
          }}
        />
      )}

      {/* TAB: TREN */}
      {activeTab === "tren" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Topik Tren: {scopeName}
                {category && facets && ` · ${facets.categories.find((c) => c.id === category)?.label ?? category}`}
                {agency && facets && ` · ${facets.agencies.find((a) => a.id === agency)?.label ?? agency}`}
              </h2>
              <p className="max-w-2xl text-xs text-zinc-500 dark:text-zinc-400">
                Topik dikelompokkan dari hashtag, frasa dua kata yang berulang, dan kategori isu. Urutan berdasarkan skor laju, yang
                menggabungkan z-score, rasio terhadap baseline, dan volume.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={handleReport}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Buat Laporan
            </button>
            <button
              onClick={() => downloadTrendsCsv(trends, timeRange)}
              disabled={trends.length === 0}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Unduh CSV
            </button>
            <button
              onClick={handleEscalate}
              disabled={isEscalating || surgingCount === 0}
              title={surgingCount === 0 ? "Tidak ada topik berstatus LONJAKAN TINGGI" : undefined}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isEscalating ? "Mengeskalasi..." : `Eskalasi ${surgingCount} Lonjakan ke Analis`}
            </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50/75 text-2xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 font-bold">Topik</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-right">Konten</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Laju</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Pola Waktu</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Kanal</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Sentimen</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Akun</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Isu RADAR</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-right">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {isLoading && trends.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-500">
                        Mengelompokkan percakapan untuk {scopeName}...
                      </td>
                    </tr>
                  ) : trends.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-500">
                        Tidak ada percakapan medsos untuk {scopeName} pada periode {windowLabel}
                        {category || agency ? " dengan filter kategori atau instansi ini" : ""}. Coba rentang waktu lebih panjang, hapus
                        filter, atau tarik data baru.
                      </td>
                    </tr>
                  ) : (
                    trends.map((item) => (
                      <tr key={item.topic_key} className="group align-top transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-mono text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {item.rank}
                            </span>
                            <div className="min-w-0 space-y-1">
                              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{item.topic}</h3>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-2xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  {item.topic_type}
                                </span>
                                {item.hashtags.filter((h) => h !== item.topic).slice(0, 2).map((ht) => (
                                  <span key={ht} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-2xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                    {ht}
                                  </span>
                                ))}
                                {item.analyst_note && (
                                  <span
                                    className={`rounded-md px-1.5 py-0.5 text-2xs font-bold ${NOTE_STATUS_STYLE[item.analyst_note.status] ?? ""}`}
                                    title={`${item.analyst_note.aktor}, ${formatWib(item.analyst_note.created_at)} WIB${item.analyst_note.catatan ? `: ${item.analyst_note.catatan}` : ""}`}
                                  >
                                    {item.analyst_note.status_label}
                                  </span>
                                )}
                                {item.coordination.flagged && (
                                  <span
                                    className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-2xs font-bold text-amber-700 dark:text-amber-300"
                                    title="Ada teks hampir identik dari 3 akun atau lebih dalam 2 jam"
                                  >
                                    Indikasi teks kembar
                                  </span>
                                )}
                              </div>
                              {item.related_phrases.length > 0 && (
                                <p className="text-2xs text-zinc-500">Terkait: {item.related_phrases.join(", ")}</p>
                              )}
                              {(item.categories.length > 0 || item.agencies.length > 0) && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {item.categories.filter((c) => c.label !== item.topic).slice(0, 2).map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={() => setCategory(c.id)}
                                      title={`Filter kategori ${c.label}`}
                                      className="rounded-full bg-sky-500/10 px-2 py-0.5 text-2xs font-medium text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
                                    >
                                      {c.label}
                                    </button>
                                  ))}
                                  {item.agencies.slice(0, 2).map((a) => (
                                    <button
                                      key={a.id}
                                      onClick={() => setAgency(a.id)}
                                      title={`Filter instansi ${a.label}`}
                                      className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                                    >
                                      {a.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{item.mention_count}</div>
                          <div
                            className={`text-2xs font-semibold ${
                              item.growth_pct === null ? "text-zinc-400" : item.growth_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
                            }`}
                          >
                            {item.growth_pct === null ? "tanpa pembanding" : `${item.growth_pct >= 0 ? "+" : ""}${item.growth_pct}%`}
                          </div>
                          {item.engagement.views !== null && (
                            <div className="text-2xs text-zinc-500" title={`Dari ${item.engagement.posts_with_data} konten yang datanya tersedia`}>
                              {formatCompact(item.engagement.views)} tayangan
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <VelocityBadge status={item.velocity_status} />
                            <span className="text-2xs text-zinc-500">
                              Skor <strong className="font-mono text-zinc-800 dark:text-zinc-200">{item.velocity_score}</strong>
                              {item.velocity.baseline_windows > 0 && <> · {item.velocity.ratio}x</>}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Sparkline data={item.timeline} label={`Pola waktu ${item.topic}`} />
                        </td>
                        <td className="px-4 py-4">
                          <MediaAvatarStack sources={item.platforms} max={3} size="md" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="w-24 space-y-1">
                            <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                              <div style={{ width: `${item.sentiment_pct.positif}%` }} className="bg-emerald-500" title={`Positif ${item.sentiment_pct.positif}%`} />
                              <div style={{ width: `${item.sentiment_pct.netral}%` }} className="bg-zinc-400" title={`Netral ${item.sentiment_pct.netral}%`} />
                              <div style={{ width: `${item.sentiment_pct.negatif}%` }} className="bg-rose-500" title={`Negatif ${item.sentiment_pct.negatif}%`} />
                            </div>
                            <div className="text-2xs text-zinc-500">Negatif {item.sentiment_pct.negatif}%</div>
                            {item.emotions[0] && (
                              <div className="text-2xs text-zinc-500" title={item.emotions.map((e) => `${e.label} ${e.pct}%`).join(", ")}>
                                Dominan: {item.emotions[0].label.toLowerCase()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-2xs text-zinc-600 dark:text-zinc-300">
                          {item.accounts.unique_accounts > 0 ? (
                            <>
                              <div className="font-semibold">{item.accounts.unique_accounts} akun</div>
                              <div className="text-zinc-500">{item.accounts.top_accounts[0]?.handle}</div>
                            </>
                          ) : (
                            <span className="text-zinc-400" title="Sumber tidak menyediakan nama akun">Tidak tersedia</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {item.correlated_issue ? (
                            <Link
                              href={`/isu/${item.correlated_issue.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 font-mono text-xs font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                            >
                              {item.correlated_issue.kode_referensi}
                            </Link>
                          ) : (
                            <span className="text-2xs text-zinc-400">Belum tertaut</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => setSelectedTopic(item)}
                            className="rounded-lg bg-fuchsia-50 px-2.5 py-1.5 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/50"
                          >
                            Lihat
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <SocialHashtagCooccurrence
            timeRange={timeRange}
            scopeKode={scopeKode}
            scopeMode={scopeMode}
            multiCodes={multiParam}
            platform={selectedPlatform}
            filters={{ category: category || undefined, agency: agency || undefined }}
          />
        </div>
      )}

      {activeTab === "alert" && <SocialAlertRules facets={facets} scopeKode={scopeKode} onEventsChanged={refreshUnread} />}

      {activeTab === "instansi" && (
        <SocialAgencyBoard
          data={agencyBoard}
          isLoading={isLoading}
          onFocusAgency={(id) => {
            setAgency(id);
            setActiveTab("tren");
          }}
        />
      )}

      {activeTab === "cari" && <SocialContentSearch timeRange={timeRange} scopeKode={scopeKode} scopeMode={scopeMode} facets={facets} />}

      {activeTab === "akun" && (
        <SocialWatchedAccounts timeRange={timeRange} scopeKode={scopeKode} scopeMode={scopeMode} multiCodes={multiParam} />
      )}

      {activeTab === "bandingkan" && (
        <SocialPeriodComparison
          timeRange={timeRange}
          scopeKode={scopeKode}
          scopeMode={scopeMode}
          multiCodes={multiParam}
          platform={selectedPlatform}
        />
      )}

      {activeTab === "watchlist" && (
        <SocialWatchlistPanel data={watchlist} isLoading={isLoading} extraTerms={extraTerms} onAddTerm={addTerm} onRemoveTerm={removeTerm} />
      )}

      {activeTab === "perbandingan" && <GeographicComparisonTable timeRange={timeRange} />}

      {/* TAB: PLATFORM */}
      {activeTab === "platform" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Status Konektor Platform</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Status diambil dari hasil tarikan terakhir setiap sumber. Volume dihitung untuk {scopeName}, {windowLabel}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {platforms.map((plat) => (
              <div key={plat.code} className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <RealBrandIcon name={plat.icon} className="h-8 w-8" />
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{plat.name}</h3>
                      <p className="text-2xs text-zinc-500 dark:text-zinc-400">{plat.type}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold ring-1 ${HEALTH_STYLE[plat.health_state]}`}>
                    {HEALTH_LABEL[plat.health_state]}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div>
                    <dt className="text-2xs text-zinc-500">Konten</dt>
                    <dd className="font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">{plat.mention_count}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-zinc-500">Negatif</dt>
                    <dd className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{plat.mention_count ? `${plat.negative_sentiment_pct}%` : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-zinc-500">Interaksi</dt>
                    <dd className="text-lg font-bold text-zinc-900 dark:text-zinc-100" title={plat.engagement.interactions === null ? "Sumber tidak menyediakan data interaksi" : undefined}>
                      {formatCompact(plat.engagement.interactions)}
                    </dd>
                  </div>
                </dl>

                {plat.sources.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    {plat.sources.map((s) => (
                      <li key={s.id} className="text-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-zinc-700 dark:text-zinc-300" title={s.nama}>{s.nama}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ring-1 ${HEALTH_STYLE[s.state]}`}>{HEALTH_LABEL[s.state]}</span>
                        </div>
                        <div className="text-zinc-500">
                          Tarikan terakhir: {formatWib(s.last_fetch_at)} WIB
                          {s.last_fetch_count !== null && `, ${s.last_fetch_count} konten terkini`}
                        </div>
                        {s.last_error && <div className="text-rose-600 dark:text-rose-400">Galat: {s.last_error}</div>}
                      </li>
                    ))}
                  </ul>
                )}

                {plat.note && <p className="mt-3 text-2xs leading-relaxed text-zinc-500 dark:text-zinc-400">{plat.note}</p>}

                <div className="mt-auto flex items-center justify-between pt-4 text-2xs text-zinc-500">
                  <span>Konten terbaru: {plat.last_data_at ? `${formatWib(plat.last_data_at)} WIB` : "belum ada"}</span>
                  {plat.sources.length > 0 && (
                    <button onClick={handleManualPoll} disabled={isRefreshing} className="font-semibold text-fuchsia-600 hover:text-fuchsia-700 disabled:opacity-50 dark:text-fuchsia-400">
                      Tarik ulang
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: KORELASI */}
      {activeTab === "korelasi" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Topik Medsos yang Tertaut ke Isu RADAR ({scopeName})</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Hanya topik 7 hari terakhir yang kontennya benar-benar tertaut ke sebuah isu, lewat pengelompokan isu atau eskalasi lonjakan.
            </p>
          </div>

          {correlations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Belum ada topik medsos yang tertaut ke isu RADAR untuk cakupan ini. Topik berstatus LONJAKAN TINGGI bisa dieskalasi dari tab
              Topik Tren.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {correlations.map((c) => (
                <div key={`${c.topic_key}-${c.issue.id}`} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-2">
                    <VelocityBadge status={c.velocity_status} />
                    <span className="text-2xs text-zinc-500">
                      Isu {c.issue.level} · skor {c.issue.skor}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{c.social_topic}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <MediaAvatarStack sources={c.platforms} max={4} size="sm" />
                    <span className="text-xs text-zinc-500">
                      {c.linked_posts} dari {c.mention_count} konten tertaut ke isu
                    </span>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3.5 ring-1 ring-zinc-200 dark:bg-zinc-800/60 dark:ring-zinc-700">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">Isu RADAR</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{c.issue.kode_referensi}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">{c.issue.judul}</p>
                    <div className="mt-2 flex items-center justify-between text-2xs text-zinc-500">
                      <span>
                        Status: <strong className="capitalize text-zinc-700 dark:text-zinc-300">{c.issue.status}</strong>
                      </span>
                      <Link href={`/isu/${c.issue.id}`} className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                        Buka isu &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTopic && (
        <TopicDetailModal
          topic={selectedTopic}
          scopeName={scopeName}
          windowLabel={windowLabel}
          timeRange={timeRange}
          scopeKode={scopeKode}
          scopeMode={scopeMode}
          onClose={() => setSelectedTopic(null)}
          onNoteSaved={loadData}
        />
      )}
    </div>
  );
}

function TopicDetailModal({
  topic,
  scopeName,
  windowLabel,
  timeRange,
  scopeKode,
  scopeMode,
  onClose,
  onNoteSaved,
}: {
  topic: SocialTrendingTopic;
  scopeName: string;
  windowLabel: string;
  timeRange: string;
  scopeKode: string;
  scopeMode: string;
  onClose: () => void;
  onNoteSaved: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const v = topic.velocity;
  const eng = topic.engagement;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-white/10"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <VelocityBadge status={topic.velocity_status} />
              <span className="text-xs text-zinc-500">
                {topic.mention_count} konten di {scopeName}, {windowLabel}
              </span>
            </div>
            <h3 id="topic-detail-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {topic.topic}
            </h3>
            {topic.locations.length > 0 && <p className="text-xs text-zinc-500">Lokasi terdeteksi: {topic.locations.join(", ")}</p>}
          </div>
          <button onClick={onClose} aria-label="Tutup rincian" className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "Skor laju", val: `${topic.velocity_score}/100` },
              { k: "Pertumbuhan", val: growthText(topic.growth_pct) },
              { k: "Rasio / z-score", val: v.baseline_windows ? `${v.ratio}x / ${v.z_score}` : "-" },
              { k: "Baseline", val: v.baseline_windows ? `${v.baseline_mean} per periode (${v.baseline_windows} periode)` : "Belum tersedia" },
            ].map((s) => (
              <div key={s.k} className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/60">
                <dt className="text-2xs text-zinc-500">{s.k}</dt>
                <dd className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{s.val}</dd>
              </div>
            ))}
          </dl>

          {topic.emotions.length > 0 && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold">Emosi:</span>{" "}
              {topic.emotions.map((e) => `${e.label} ${e.pct}%`).join(", ")}
              <span className="text-zinc-500"> (persentase konten yang memuat kata emosi tersebut)</span>
            </p>
          )}

          <VolumeTimeline
            data={topic.timeline}
            baselinePerBucket={topic.baseline_per_bucket}
            title={`Volume per interval${topic.peak_at ? `, puncak ${formatWib(topic.peak_at)} WIB` : ""}`}
          />

          {/* Topik kategori menggabungkan banyak isu, jadi urutan platformnya tidak menggambarkan penyebaran. */}
          {topic.propagation.steps.length > 1 && (topic.topic_type === "hashtag" || topic.topic_type === "frasa") && (
            <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Jalur penyebaran</h4>
              <ol className="mt-3 space-y-2.5">
                {topic.propagation.steps.map((s, i) => (
                  <li key={s.platform} className="flex items-start gap-3 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 font-mono text-2xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{s.platform}</span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-300">{formatWib(s.first_at)} WIB</span>
                        <span className="font-mono text-zinc-500">{i === 0 ? "pertama" : lagText(s.lag_minutes)}</span>
                      </div>
                      <div className="truncate text-2xs text-zinc-500">
                        {s.posts} konten
                        {s.first_author && <>, pertama oleh {s.first_author}</>}
                        {s.first_url && (
                          <>
                            {" "}
                            <a href={s.first_url} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline dark:text-sky-300">
                              buka
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-2xs text-zinc-500">
                Urutan menurut waktu terbit konten pertama di tiap platform. Platform tanpa sumber aktif tidak tercatat, jadi topik ini bisa
                saja sudah muncul lebih dulu di tempat lain.
              </p>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Akun paling aktif</h4>
              {topic.accounts.unique_accounts === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Sumber tidak menyediakan nama akun untuk konten topik ini.</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-1.5">
                    {topic.accounts.top_accounts.map((a) => (
                      <li key={a.handle} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-zinc-800 dark:text-zinc-200">{a.handle}</span>
                        <span className="shrink-0 text-zinc-500">
                          {a.posts} konten{a.followers !== null ? ` · ${formatCompact(a.followers)} pengikut` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-2xs text-zinc-500">
                    {topic.accounts.unique_accounts} akun, nama akun tersedia di {topic.accounts.author_coverage_pct}% konten. Akun teratas
                    menyumbang {topic.accounts.top_account_share_pct}% konten.
                  </p>
                </>
              )}
            </section>

            <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Interaksi</h4>
              {eng.posts_with_data === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Sumber konten topik ini tidak menyediakan jumlah like, repost, atau tayangan.</p>
              ) : (
                <>
                  <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
                    {[
                      ["Like", eng.likes],
                      ["Repost", eng.shares],
                      ["Balasan", eng.replies],
                      ["Tayangan", eng.views],
                    ].map(([label, val]) => (
                      <div key={label as string}>
                        <dt className="text-2xs text-zinc-500">{label}</dt>
                        <dd className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatCompact(val as number | null)}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-2xs text-zinc-500">Dari {eng.posts_with_data} konten yang datanya tersedia ({eng.coverage_pct}%).</p>
                </>
              )}
            </section>
          </div>

          <SocialSpreadTrace timeRange={timeRange} scopeKode={scopeKode} scopeMode={scopeMode} topicKey={topic.topic_key} />

          <SocialTopicNotes topicKey={topic.topic_key} topicLabel={topic.topic} onSaved={onNoteSaved} />

          {topic.coordination.clusters.length > 0 && (
            <section
              className={`rounded-xl p-4 ${
                topic.coordination.flagged ? "border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                {topic.coordination.flagged ? "Indikasi teks kembar dari banyak akun" : "Teks berulang"}
              </h4>
              <p className="mt-1 text-2xs text-zinc-600 dark:text-zinc-400">
                {topic.coordination.duplicate_share_pct}% konten punya teks hampir identik dengan konten lain. Ini bisa berasal dari siaran resmi
                yang dikutip ulang, jadi periksa sumbernya sebelum menyimpulkan.
              </p>
              <ul className="mt-2 space-y-2">
                {topic.coordination.clusters.map((c, i) => (
                  <li key={i} className="text-xs text-zinc-700 dark:text-zinc-300">
                    <span className="font-semibold">
                      {c.posts} konten, {c.distinct_accounts} akun, rentang {c.span_minutes} menit
                    </span>
                    {c.accounts.length > 0 && <span className="text-zinc-500"> ({c.accounts.join(", ")})</span>}
                    <div className="mt-0.5 italic text-zinc-500">&quot;{c.sample_text}&quot;</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500">Konten asli ({topic.sample_mentions.length} teratas)</h4>
            <div className="space-y-3">
              {topic.sample_mentions.map((sm) => (
                <article key={sm.id} className="rounded-xl border border-zinc-200 p-3.5 dark:border-zinc-800">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-2xs text-zinc-500">
                    <div className="flex items-center gap-2">
                      <RealBrandIcon name={sm.platform} className="h-4 w-4" />
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">{sm.penulis ?? "Akun tidak diketahui"}</span>
                      <span>{sm.platform}</span>
                      {sm.emosi?.map((e) => (
                        <span key={e} className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-3xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {e}
                        </span>
                      ))}
                    </div>
                    {sm.geo_context && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {sm.geo_context} · keyakinan {sm.geo_confidence ?? "-"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">{sm.isi}</p>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 text-2xs text-zinc-500 dark:border-zinc-800">
                    <span className="font-mono">
                      {formatWib(sm.published_at)} WIB
                      {sm.engagement && (sm.engagement.likes !== null || sm.engagement.views !== null) && (
                        <>
                          {" · "}
                          {sm.engagement.likes !== null && `${formatCompact(sm.engagement.likes)} like`}
                          {sm.engagement.shares !== null && `, ${formatCompact(sm.engagement.shares)} repost`}
                          {sm.engagement.views !== null && `, ${formatCompact(sm.engagement.views)} tayangan`}
                        </>
                      )}
                    </span>
                    {sm.url && (
                      <a href={sm.url} target="_blank" rel="noopener noreferrer" className="font-bold text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                        Buka sumber asli &rarr;
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {topic.correlated_issue && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              {topic.correlated_issue.linked_posts ?? 0} konten topik ini tertaut ke isu{" "}
              <Link href={`/isu/${topic.correlated_issue.id}`} className="font-mono font-semibold text-blue-600 hover:underline dark:text-blue-400">
                {topic.correlated_issue.kode_referensi}
              </Link>{" "}
              ({topic.correlated_issue.status}).
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button onClick={onClose} className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
