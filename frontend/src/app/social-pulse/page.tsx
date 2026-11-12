"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchSocialPulseOverview,
  fetchSocialTrends,
  fetchSocialPlatforms,
  fetchSocialCorrelations,
  pollSources,
  SocialPulseOverview,
  SocialTrendingTopic,
  SocialPlatformMetric,
  SocialCorrelation,
} from "@/lib/api";
import { MediaAvatarStack, RealBrandIcon } from "@/components/SourceLogos";
import { GeographicScopeSelector } from "@/components/GeographicScopeSelector";
import { GeographicComparisonTable } from "@/components/GeographicComparisonTable";

export default function SocialPulsePage() {
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("Semua");

  // Geographic Scope State (FR-GEO-01 s/d FR-GEO-08)
  const [scopeKode, setScopeKode] = useState<string>("ID");
  const [scopeName, setScopeName] = useState<string>("Seluruh Indonesia");
  const [scopeMode, setScopeMode] = useState<"context" | "strict" | "regional">("context");
  const [multiCodes, setMultiCodes] = useState<string[]>([]);
  const [isMultiSelect, setIsMultiSelect] = useState<boolean>(false);

  const [overview, setOverview] = useState<SocialPulseOverview | null>(null);
  const [trends, setTrends] = useState<SocialTrendingTopic[]>([]);
  const [platforms, setPlatforms] = useState<SocialPlatformMetric[]>([]);
  const [correlations, setCorrelations] = useState<SocialCorrelation[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<SocialTrendingTopic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"tren" | "platform" | "korelasi" | "perbandingan">("tren");

  const loadData = async (
    range: string,
    plat: string,
    sKode: string,
    sMode: "context" | "strict" | "regional",
    mCodes?: string[]
  ) => {
    try {
      setIsLoading(true);
      const multiParam = mCodes && mCodes.length > 0 ? mCodes.join(",") : undefined;
      const [ovData, trData, pfData, crData] = await Promise.all([
        fetchSocialPulseOverview(range, sKode, sMode, multiParam),
        fetchSocialTrends(plat === "Semua" ? undefined : plat, range, 20, sKode, sMode, multiParam),
        fetchSocialPlatforms(sKode, sMode, multiParam),
        fetchSocialCorrelations(sKode, sMode, multiParam),
      ]);
      setOverview(ovData);
      setTrends(trData);
      setPlatforms(pfData);
      setCorrelations(crData);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Gagal memuat data Social Pulse:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(timeRange, selectedPlatform, scopeKode, scopeMode, multiCodes);
  }, [timeRange, selectedPlatform, scopeKode, scopeMode, multiCodes]);

  const handleApplyScope = (
    newKode: string,
    newName: string,
    newMode: "context" | "strict" | "regional",
    newMultiList?: string[]
  ) => {
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
    try {
      await pollSources(false);
      await loadData(timeRange, selectedPlatform, scopeKode, scopeMode, multiCodes);
    } catch (e) {
      console.error("Gagal sinkronisasi data sosial:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* HEADER & CONTEXT BAR */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-950 p-6 text-white shadow-xl ring-1 ring-white/10">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-fuchsia-600/15 blur-3xl pointer-events-none" />
        <div className="absolute right-48 -bottom-16 h-48 w-48 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs font-semibold text-fuchsia-300 ring-1 ring-fuchsia-500/30">
                <span className="h-2 w-2 rounded-full bg-fuchsia-400 animate-pulse" />
                REALTIME SOCIAL INTELLIGENCE
              </span>
              <span className="text-xs text-zinc-400">
                Diperbarui: {lastRefreshed.toLocaleTimeString("id-ID")} WIB
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
              RADAR Social Pulse
            </h1>
            <p className="max-w-2xl text-sm text-zinc-300">
              Instrumen deteksi dini percakapan warganet lintas platform (Threads, X, YouTube, TikTok). Pantau percepatan tren, sentimen publik, dan korelasi langsung ke sistem penanganan isu RADAR.
            </p>
          </div>

          {/* Action controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Time range selector */}
            <div className="inline-flex rounded-xl bg-zinc-800/80 p-1 ring-1 ring-white/10 backdrop-blur-xs">
              {[
                { label: "1 Jam", value: "1h" },
                { label: "6 Jam", value: "6h" },
                { label: "24 Jam", value: "24h" },
                { label: "7 Hari", value: "7d" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTimeRange(t.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    timeRange === t.value
                      ? "bg-fuchsia-600 text-white shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Poll manual button */}
            <button
              onClick={handleManualPoll}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-900 shadow-md transition-all hover:bg-zinc-100 disabled:opacity-50"
            >
              <svg
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-fuchsia-600" : "text-zinc-700"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isRefreshing ? "Menyinkronkan..." : "Tarik Data Baru"}
            </button>
          </div>
        </div>

        {/* Platform filter tabs */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <span className="text-xs font-medium text-zinc-400 mr-2">Filter Kanal:</span>
          {["Semua", "Threads", "X (Twitter)", "YouTube", "TikTok"].map((plat) => {
            const isSel = selectedPlatform === plat;
            return (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isSel
                    ? "bg-fuchsia-500/25 text-white ring-1 ring-fuchsia-400"
                    : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white ring-1 ring-white/5"
                }`}
              >
                {plat === "Threads" && <RealBrandIcon name="threads" className="w-3.5 h-3.5" />}
                {plat === "X (Twitter)" && <RealBrandIcon name="x" className="w-3.5 h-3.5" />}
                {plat === "YouTube" && <RealBrandIcon name="youtube" className="w-3.5 h-3.5" />}
                {plat === "TikTok" && <RealBrandIcon name="tiktok" className="w-3.5 h-3.5" />}
                {plat}
              </button>
            );
          })}
        </div>
      </div>

      {/* GEOGRAPHIC SCOPE SELECTOR (FR-GEO-01 S/D FR-GEO-08) */}
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

      {/* EXECUTIVE KPI CARDS (TERFILTER GEOGRAFIS) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* KPI 1: Total Mentions */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Total Percakapan</span>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-bold text-blue-600 dark:text-blue-400">
              {timeRange}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
              {isLoading ? "..." : (overview?.total_mentions ?? 0).toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">mentions</span>
          </div>
          <div className="mt-2 flex items-center text-xs">
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                (overview?.mention_growth_pct ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
              }`}
            >
              {(overview?.mention_growth_pct ?? 0) >= 0 ? "+" : ""}
              {overview?.mention_growth_pct ?? 0}%
            </span>
            <span className="ml-1 text-zinc-500 dark:text-zinc-400">vs periode lalu</span>
          </div>
        </div>

        {/* KPI 2: Trending Topics */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Topik Tren Lokal</span>
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
              {isLoading ? "..." : overview?.trending_topics_count ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">klaster narasi</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {scopeKode === "ID" ? "Tren nasional publik" : `Tren wilayah ${scopeName}`}
          </p>
        </div>

        {/* KPI 3: Emerging / Lonjakan Baru */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Lonjakan Baru</span>
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-bold text-rose-600 dark:text-rose-400 animate-pulse">
              SURGING
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
              {isLoading ? "..." : overview?.emerging_trends_count ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">isu melonjak</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Akselerasi laju &gt;150% di wilayah ini
          </p>
        </div>

        {/* KPI 4: Rasio Sentimen Negatif */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Sentimen Negatif</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {isLoading ? "..." : `${overview?.negative_ratio_pct ?? 0}%`}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
              {isLoading ? "..." : overview?.sentiment_breakdown?.negatif ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">keluhan warga</span>
          </div>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              style={{
                width: `${
                  overview?.total_mentions
                    ? ((overview.sentiment_breakdown?.positif ?? 0) / overview.total_mentions) * 100
                    : 0
                }%`,
              }}
              className="bg-emerald-500"
              title="Positif"
            />
            <div
              style={{
                width: `${
                  overview?.total_mentions
                    ? ((overview.sentiment_breakdown?.netral ?? 0) / overview.total_mentions) * 100
                    : 0
                }%`,
              }}
              className="bg-zinc-400"
              title="Netral"
            />
            <div
              style={{
                width: `${
                  overview?.total_mentions
                    ? ((overview.sentiment_breakdown?.negatif ?? 0) / overview.total_mentions) * 100
                    : 0
                }%`,
              }}
              className="bg-rose-500"
              title="Negatif"
            />
          </div>
        </div>

        {/* KPI 5: Platform Terpantau */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Kanal Terlibat</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aktif
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
              {isLoading ? "..." : overview?.active_platforms_count ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">sumber terdeteksi</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <RealBrandIcon name="threads" className="w-4 h-4" />
            <RealBrandIcon name="x" className="w-4 h-4" />
            <RealBrandIcon name="youtube" className="w-4 h-4" />
            <RealBrandIcon name="tiktok" className="w-4 h-4" />
            <span className="text-2xs text-zinc-400">Multi-Kanal</span>
          </div>
        </div>
      </div>

      {/* VIEW TABS NAVIGATION */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("tren")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "tren"
              ? "border-fuchsia-600 text-fuchsia-600 dark:border-fuchsia-400 dark:text-fuchsia-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Topik Tren Wilayah ({trends.length})
        </button>
        <button
          onClick={() => setActiveTab("perbandingan")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "perbandingan"
              ? "border-fuchsia-600 text-fuchsia-600 dark:border-fuchsia-400 dark:text-fuchsia-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Perbandingan Antar-Wilayah (FR-GEO-06)
        </button>
        <button
          onClick={() => setActiveTab("platform")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "platform"
              ? "border-fuchsia-600 text-fuchsia-600 dark:border-fuchsia-400 dark:text-fuchsia-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Status Platform ({platforms.length})
        </button>
        <button
          onClick={() => setActiveTab("korelasi")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === "korelasi"
              ? "border-fuchsia-600 text-fuchsia-600 dark:border-fuchsia-400 dark:text-fuchsia-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Korelasi Isu RADAR ({correlations.length})
        </button>
      </div>

      {/* TAB 1: TRENDING TOPICS TABLE */}
      {activeTab === "tren" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Peringkat Tren Percakapan Warganet: {scopeName}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Data percakapan yang tervalidasi relevan dengan cakupan wilayah aktif ({scopeMode === "context" ? "Wilayah + Konteks" : scopeMode === "strict" ? "Lokasi Ketat" : "Konteks Regional"}).
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Lonjakan Tinggi
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Meningkat
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> Stabil
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50/75 text-2xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 font-bold">Peringkat &amp; Topik</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-center">Volume Mentions</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-center">Kecepatan (Velocity)</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-center">Kanal Terlibat</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-center">Sentimen Warga</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-center">Korelasi Isu</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                        <div className="inline-flex items-center gap-2">
                          <svg className="h-5 w-5 animate-spin text-fuchsia-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Memfilter data percakapan untuk wilayah {scopeName}...
                        </div>
                      </td>
                    </tr>
                  ) : trends.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                        Tidak ada percakapan publik ditemukan untuk cakupan {scopeName} pada mode {scopeMode}. Coba ubah mode ke &quot;Konteks Regional&quot; atau periksa wilayah sekitar.
                      </td>
                    </tr>
                  ) : (
                    trends.map((item) => {
                      const isSurging = item.velocity_status === "LONJAKAN TINGGI";
                      const isRising = item.velocity_status === "MENINGKAT";

                      return (
                        <tr
                          key={item.rank}
                          className="group transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                        >
                          {/* Rank & Topic */}
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                  item.rank === 1
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : item.rank === 2
                                    ? "bg-slate-400 text-white"
                                    : item.rank === 3
                                    ? "bg-amber-700 text-white"
                                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                              >
                                #{item.rank}
                              </span>
                              <div className="space-y-1">
                                <h3 className="font-bold text-zinc-900 group-hover:text-fuchsia-600 dark:text-zinc-100 dark:group-hover:text-fuchsia-400">
                                  {item.topic}
                                </h3>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {item.hashtags.map((ht, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-2xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                    >
                                      {ht}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Mention volume & growth */}
                          <td className="px-4 py-4 text-center">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">
                              {item.mention_count} <span className="text-xs font-normal text-zinc-500">mentions</span>
                            </div>
                            <span
                              className={`inline-block mt-0.5 text-2xs font-semibold ${
                                item.growth_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"
                              }`}
                            >
                              {item.growth_pct >= 0 ? "+" : ""}{item.growth_pct}%
                            </span>
                          </td>

                          {/* Velocity status & score */}
                          <td className="px-4 py-4 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-bold ${
                                  isSurging
                                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30"
                                    : isRising
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30"
                                    : "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30"
                                }`}
                              >
                                {isSurging && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />}
                                {item.velocity_status}
                              </span>
                              <span className="text-2xs font-medium text-zinc-500">
                                Skor Laju: <strong className="text-zinc-800 dark:text-zinc-200">{item.velocity_score}</strong>/100
                              </span>
                            </div>
                          </td>

                          {/* Channels involved with MediaAvatarStack */}
                          <td className="px-4 py-4 text-center">
                            <div className="flex justify-center">
                              <MediaAvatarStack sources={item.platforms} max={3} size="md" />
                            </div>
                          </td>

                          {/* Sentiment mini bar */}
                          <td className="px-4 py-4 text-center">
                            <div className="w-28 mx-auto space-y-1">
                              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                <div
                                  style={{ width: `${item.sentiment_pct.positif}%` }}
                                  className="bg-emerald-500"
                                  title={`Positif: ${item.sentiment_pct.positif}%`}
                                />
                                <div
                                  style={{ width: `${item.sentiment_pct.netral}%` }}
                                  className="bg-zinc-400"
                                  title={`Netral: ${item.sentiment_pct.netral}%`}
                                />
                                <div
                                  style={{ width: `${item.sentiment_pct.negatif}%` }}
                                  className="bg-rose-500"
                                  title={`Negatif: ${item.sentiment_pct.negatif}%`}
                                />
                              </div>
                              <div className="flex justify-between text-3xs text-zinc-400">
                                <span className="text-emerald-600 font-semibold">{item.sentiment_pct.positif}%</span>
                                <span className="text-rose-600 font-semibold">{item.sentiment_pct.negatif}%</span>
                              </div>
                            </div>
                          </td>

                          {/* Correlated Issue */}
                          <td className="px-4 py-4 text-center">
                            {item.correlated_issue ? (
                              <Link
                                href="/isu"
                                className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                {item.correlated_issue.kode_referensi}
                              </Link>
                            ) : (
                              <span className="text-2xs text-zinc-400">Belum Terhubung</span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => setSelectedTopic(item)}
                              className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-50 px-2.5 py-1.5 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100 dark:bg-fuchsia-950/50 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/50 transition-colors"
                            >
                              <span>Lihat Cuitan &amp; Postingan Asli</span>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GEOGRAPHIC COMPARISON TABLE (FR-GEO-06) */}
      {activeTab === "perbandingan" && (
        <GeographicComparisonTable timeRange={timeRange} />
      )}

      {/* TAB 3: PLATFORM CONNECTORS GRID */}
      {activeTab === "platform" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Status Konektor Platform untuk Cakupan: {scopeName}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Volume dan sentimen media sosial yang terdeteksi di wilayah ini per platform.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {platforms.map((plat) => (
              <div
                key={plat.code}
                className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <RealBrandIcon name={plat.icon} className="w-8 h-8" />
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{plat.name}</h3>
                      <p className="text-2xs text-zinc-500 dark:text-zinc-400">{plat.type}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold ${
                      plat.is_connected
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        plat.is_connected ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {plat.official_status}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div>
                    <span className="text-2xs text-zinc-500 dark:text-zinc-400">Mentions Wilayah Ini</span>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {plat.mention_count.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div>
                    <span className="text-2xs text-zinc-500 dark:text-zinc-400">Sentimen Negatif</span>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                      {plat.negative_sentiment_pct}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-2xs text-zinc-400 dark:text-zinc-500">
                  <span>
                    Data Terakhir:{" "}
                    {plat.last_data_at
                      ? new Date(plat.last_data_at).toLocaleDateString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Dalam Antrean"}
                  </span>
                  <button
                    onClick={handleManualPoll}
                    disabled={isRefreshing}
                    className="font-semibold text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400"
                  >
                    Sinkronkan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SOCIAL TREND TO RADAR ISSUE CORRELATION */}
      {activeTab === "korelasi" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Matriks Korelasi Tren Media Sosial vs Tiket Isu RADAR ({scopeName})
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Menghubungkan suara dan keluhan viral warganet secara transparan dengan nomor referensi penanganan isu resmi.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {correlations.map((c, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-fuchsia-500/10 px-2.5 py-1 text-xs font-bold text-fuchsia-700 dark:text-fuchsia-300">
                      Topik Media Sosial
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-2xs font-bold ${
                        c.issue.level === "CRITICAL"
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {c.issue.level} (Skor: {c.issue.skor})
                    </span>
                  </div>

                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                    {c.social_topic}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2">
                    <MediaAvatarStack sources={c.platforms} max={4} size="sm" />
                    <span className="text-xs text-zinc-500">
                      {c.mention_count} mentions warganet
                    </span>
                  </div>

                  {/* Connected RADAR Issue Card */}
                  <div className="rounded-xl bg-zinc-50 p-3.5 ring-1 ring-zinc-200 dark:bg-zinc-800/60 dark:ring-zinc-700">
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Tiket Penanganan RADAR
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {c.issue.kode_referensi}
                      </span>
                    </div>
                    <p className="mt-1 font-medium text-xs text-zinc-800 dark:text-zinc-200">
                      {c.issue.judul}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-2xs text-zinc-500">
                      <span>Status: <strong className="capitalize text-zinc-700 dark:text-zinc-300">{c.issue.status}</strong></span>
                      <Link
                        href="/kasus"
                        className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Buka Papan Kasus &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOPIC DETAIL & NARRATIVE MODAL (WITH GEOGRAPHIC CONTEXT & CONFIDENCE) */}
      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-white/10">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-fuchsia-500/20 px-2 py-0.5 text-xs font-bold text-fuchsia-700 dark:text-fuchsia-300">
                    #{selectedTopic.rank} Topik Tren
                  </span>
                  <span className="text-xs text-zinc-500">
                    {selectedTopic.mention_count} percakapan terdata di {scopeName}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedTopic.topic}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTopic(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body: Mentions evidence and citizen quotes */}
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Profil Kecepatan &amp; Sentimen Wilayah
                </h4>
                <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-zinc-800">
                    <span className="text-2xs text-zinc-400">Status Laju</span>
                    <p className="font-bold text-xs text-rose-600 dark:text-rose-400">
                      {selectedTopic.velocity_status}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-zinc-800">
                    <span className="text-2xs text-zinc-400">Pertumbuhan</span>
                    <p className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      +{selectedTopic.growth_pct}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 shadow-2xs dark:bg-zinc-800">
                    <span className="text-2xs text-zinc-400">Sentimen Negatif</span>
                    <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                      {selectedTopic.sentiment_pct.negatif}%
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Postingan Warganet &amp; Cuitan Asli Terverifikasi</span>
                  </div>
                  <span className="text-3xs font-mono font-medium text-zinc-400">Bukti Lokasi &amp; Keyakinan Geografis Aktual (FR-GEO-07 &amp; FR-GEO-08)</span>
                </h4>
                <div className="space-y-3">
                  {selectedTopic.sample_mentions.map((sm) => {
                    const authorLabel = sm.penulis && sm.penulis !== sm.penerbit
                      ? sm.penulis
                      : sm.penerbit === sm.platform
                      ? sm.platform
                      : `${sm.penerbit} (${sm.platform})`;

                    return (
                      <div
                        key={sm.id}
                        className="rounded-xl border border-zinc-200 bg-white/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/30 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-2xs text-zinc-500 mb-2">
                          <div className="flex items-center gap-2">
                            <RealBrandIcon name={sm.platform} className="w-4 h-4" />
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {authorLabel}
                            </span>
                            {sm.penulis && sm.penulis !== sm.penerbit && (
                              <span className="rounded-sm bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-3xs font-mono text-zinc-500">
                                {sm.platform}
                              </span>
                            )}
                          </div>
                          {/* Geographic Context & Confidence Badges (FR-GEO-07 & FR-GEO-08) */}
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-bold text-3xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {sm.geo_context || "Lokasi Disebut"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-bold text-3xs ${
                                sm.geo_confidence === "High"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : sm.geo_confidence === "Medium"
                                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              Confidence: {sm.geo_confidence || "Medium"}
                            </span>
                          </div>
                        </div>
                        <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 leading-snug">
                          {sm.judul}
                        </h5>
                        <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          &quot;{sm.isi}&quot;
                        </p>
                        <div className="mt-2.5 flex items-center justify-between text-2xs text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                          <span className="font-mono text-3xs">
                            {new Date(sm.published_at).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })} WIB
                          </span>
                          {sm.url && (
                            <a
                              href={sm.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-xs text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400 dark:hover:text-fuchsia-300 hover:underline inline-flex items-center gap-1"
                            >
                              <span>Buka Sumber Asli</span>
                              <span aria-hidden="true">&rarr;</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="mt-6 flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button
                onClick={() => setSelectedTopic(null)}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
