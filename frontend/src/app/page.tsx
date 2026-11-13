"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchDashboardSummary,
  DashboardKPI,
  TrendPoint,
  IssueItem,
  RegionSummary,
  GalaxyNode,
  FlowItem,
  LiveArticle,
  TriageStats,
} from "@/lib/api";
import {
  RadarKpiCard,
  ThreatLevelPill,
  SourceBadge,
} from "@/components/RadarUi";
import { HealthIndexDial } from "@/components/HealthIndexDial";
import { ConversationGalaxy } from "@/components/ConversationGalaxy";
import { ConversationFlow } from "@/components/ConversationFlow";
import { LiveNewsStream } from "@/components/LiveNewsStream";
import { SourceDeepDive } from "@/components/SourceDeepDive";
import { TopHotIssuesCards } from "@/components/TopHotIssuesCards";
import { SituationBrief } from "@/components/SituationBrief";
import { DashboardAiInsight } from "@/components/DashboardAiInsight";
import { ExecutivePriorityBoard } from "@/components/ExecutivePriorityBoard";
import {
  RotateCw,
  TrendingUp,
  AlertTriangle,
  MapPin,
  Clock,
  Radio,
  Shield,
  Layers,
} from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<DashboardKPI | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [priorityIssues, setPriorityIssues] = useState<IssueItem[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [healthIndex, setHealthIndex] = useState<number>(78.5);
  const [galaxyNodes, setGalaxyNodes] = useState<GalaxyNode[]>([]);
  const [flowData, setFlowData] = useState<FlowItem[]>([]);
  const [triageStats, setTriageStats] = useState<TriageStats | undefined>(undefined);
  const [liveArticles, setLiveArticles] = useState<LiveArticle[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  // Mode Pengalaman: "pimpinan" (Understand & Decide) vs "analis" (Investigate & Verify)
  const [experienceMode, setExperienceMode] = useState<"pimpinan" | "analis">("pimpinan");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardSummary();
      setKpi(data.kpi);
      setTrend(data.trend_7d || []);
      setPriorityIssues(data.priority_issues || []);
      setRegions(data.regions || []);
      if (data.health_index !== undefined) setHealthIndex(data.health_index);
      if (data.galaxy_nodes) setGalaxyNodes(data.galaxy_nodes);
      if (data.flow_data) setFlowData(data.flow_data);
      if (data.triage_stats) setTriageStats(data.triage_stats);
      if (data.live_articles) setLiveArticles(data.live_articles);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(
        err.message ||
          "Gagal terhubung ke server API backend di port 8001. Pastikan backend aktif."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="panel p-16 text-center bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
        <div className="inline-block w-8 h-8 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
          Memindai Sinyal Radar Intelijen &amp; Berita Nyata...
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
          Sinkronisasi feed Antara, Detik, CNN, BMKG, Dishub, dan evaluasi Jev Triage
        </p>
      </div>
    );
  }

  if (error || !kpi) {
    return (
      <div className="panel border-red-500/40 p-8 max-w-lg mx-auto my-12 bg-red-500/5">
        <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400 font-mono font-bold text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Gagal Memuat Dashboard</span>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono leading-relaxed mb-4">
          {error}
        </p>
        <button
          type="button"
          onClick={loadData}
          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-mono font-bold rounded-md transition-colors"
        >
          Coba Hubungkan Kembali
        </button>
      </div>
    );
  }

  // Peak day calculation from actual real data
  const peakDay =
    trend.length > 0
      ? trend.reduce(
          (prev, curr) => (curr.volume > prev.volume ? curr : prev),
          trend[0]
        )
      : null;

  const maxVol = Math.max(...trend.map((t) => t.volume), 20);

  // SVG dimensions for 7-day combo chart
  const chartWidth = 560;
  const chartHeight = 180;
  const padTop = 20;
  const padBottom = 30;
  const plotHeight = chartHeight - padTop - padBottom;
  const colWidth = chartWidth / Math.max(trend.length, 1);

  const linePoints = trend
    .map((t, i) => {
      const pct = t.negative_pct ?? 0;
      const cx = colWidth * i + colWidth / 2;
      const cy = padTop + plotHeight * (1 - Math.min(pct / 100, 1));
      return `${cx},${cy}`;
    })
    .join(" ");

  return (
    <div className="space-y-6">
      {/* Page Title & Tactical Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Situasi Terkini Media &amp; Bencana
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher: One System, Two Experiences (Pimpinan vs Analis) */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setExperienceMode("pimpinan")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                experienceMode === "pimpinan"
                  ? "bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>Mode Pimpinan</span>
            </button>
            <button
              type="button"
              onClick={() => setExperienceMode("analis")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                experienceMode === "analis"
                  ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <span>Mode Analis</span>
            </button>
          </div>

          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono hidden md:inline">
            Pembaruan: {lastRefreshed.toLocaleTimeString("id-ID")} WIB
          </span>
          <button
            type="button"
            onClick={loadData}
            className="min-h-[36px] px-3.5 py-1.5 text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 rounded-md transition-colors flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            Segarkan
          </button>
        </div>
      </div>

      {/* Top Section: Health Index Dial + Core KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Executive Health Index Dial (5 cols) */}
        <div className="lg:col-span-5">
          <HealthIndexDial
            score={healthIndex}
            criticalCount={kpi.critical_count}
            highCount={kpi.high_count}
            negativePct={peakDay ? peakDay.negative_pct : 25}
            triageStats={triageStats}
          />
        </div>

        {/* 4 Core Signals KPI Cards (7 cols) - Sesuai PRD Bagian 10.4 */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RadarKpiCard
            label="Konten Unik"
            value={`${kpi.mention_unik.toLocaleString("id-ID")} Konten`}
            hint={`Dari total konten mentah setelah deduplikasi • ${kpi.belum_terpetakan_pct ?? 0}% belum terpetakan`}
            trend={
              kpi.mention_growth_pct !== null
                ? `${kpi.mention_growth_pct > 0 ? "+" : ""}${kpi.mention_growth_pct}% 24j`
                : "Volume stabil"
            }
            trendPositive={(kpi.mention_growth_pct ?? 0) <= 0}
            icon={<Radio className="w-5 h-5 text-sky-500" />}
            gradientColor="sky"
          />

          <RadarKpiCard
            label="Isu Prioritas"
            value={`${kpi.isu_prioritas} Isu`}
            hint={`${kpi.critical_count} Kritis (skor 85-100), ${kpi.high_count} Tinggi (skor 70-84)`}
            trend={kpi.isu_prioritas > 0 ? "Perlu Respon" : "Kondusif"}
            trendPositive={kpi.isu_prioritas === 0}
            icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
            gradientColor="rose"
          />

          <RadarKpiCard
            label="Wilayah Terdampak"
            value={`${kpi.wilayah_terdampak} Daerah`}
            hint={`Dari ${kpi.total_wilayah_terpantau} wilayah terpantau di radar`}
            trend="Kemendagri WGS84"
            trendPositive={true}
            icon={<MapPin className="w-5 h-5 text-emerald-500" />}
            gradientColor="emerald"
          />

          <RadarKpiCard
            label="Menunggu Verifikasi"
            value={`${kpi.menunggu_verifikasi ?? kpi.menunggu_aksi} Isu`}
            hint="Antrean triase analis (wajib untuk High & Critical)"
            trend={(kpi.menunggu_verifikasi ?? 0) > 0 ? "Menunggu Verifikasi" : "Antrean Bersih"}
            trendPositive={(kpi.menunggu_verifikasi ?? 0) === 0}
            icon={<Clock className="w-5 h-5 text-amber-500" />}
            gradientColor="amber"
          />
        </div>
      </div>

      {/* Wawasan Ringkasan AI terhadap Angka & Isu Terkini */}
      <DashboardAiInsight />

      {/* Situation Brief - Ringkasan Eksekutif & Arahan Pimpinan (FR-02) */}
      <SituationBrief
        statusLevel={
          kpi.critical_count > 0
            ? "KRITIS"
            : kpi.high_count > 0
            ? "SIAGA"
            : kpi.wilayah_terdampak > 0
            ? "WASPADA"
            : "NORMAL"
        }
        issues={priorityIssues}
        criticalCount={kpi.critical_count}
        highCount={kpi.high_count}
        wilayahCount={kpi.wilayah_terdampak}
        lastUpdated={lastRefreshed}
      />

      {/* 3 Hot Issues Indonesia Showcase (Colorful Redesign) */}
      <TopHotIssuesCards issues={priorityIssues} />

      {/* Executive Priority Board (FR-03 - Orientasi Aksi, PIC & SLA) */}
      <ExecutivePriorityBoard issues={priorityIssues} />

      {/* Conditional Rendering: Analis Tools vs Progressive Disclosure */}
      {experienceMode === "analis" ? (
        <>
          {/* Middle Section: Authentic Radar Sweep Screen (Galaxy) + Conversation Flow */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left 7 Cols: Circular Radar Screen Orbit */}
            <div className="lg:col-span-7">
              <ConversationGalaxy nodes={galaxyNodes} />
            </div>

            {/* Right 5 Cols: Flow Distribution Diagram */}
            <div className="lg:col-span-5">
              <ConversationFlow flows={flowData} />
            </div>
          </div>

          {/* Real Live News Streaming Feed */}
          <LiveNewsStream articles={liveArticles} />
        </>
      ) : (
        /* Mode Pimpinan: Progressive Disclosure Bar jika pimpinan ingin mengintip telemetri mentah */
        <div className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-500" />
            <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
              Instrumen teknis (Radar Orbit Sweep &amp; Conversation Stream) dioptimalkan di <strong>Mode Analis</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExperienceMode("analis")}
            className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline"
          >
            Buka Instrumen Analis &rarr;
          </button>
        </div>
      )}

      {/* Trend & Threat Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: 7-Day Trend Chart */}
        <section className="lg:col-span-7 panel p-6 flex flex-col justify-between bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold font-mono text-zinc-900 dark:text-white uppercase tracking-wider">
                  TREN VOLUME &amp; TEKANAN SENTIMEN (7 HARI)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                  Batang = volume berita; Garis oranye = % sentimen negatif
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs font-mono">
                <span className="flex items-center text-zinc-700 dark:text-zinc-300">
                  <span className="w-2.5 h-2.5 bg-zinc-800 dark:bg-zinc-200 rounded-sm mr-1.5" />
                  Volume
                </span>
                <span className="flex items-center text-amber-600 dark:text-amber-400 font-semibold">
                  <span className="w-2.5 h-0.5 bg-amber-500 mr-1.5" />
                  % Negatif
                </span>
              </div>
            </div>

            {/* SVG Combo Chart */}
            <div className="relative w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-48 select-none"
              >
                {/* Baseline Guide Grid Lines */}
                <line
                  x1="0"
                  y1={padTop}
                  x2={chartWidth}
                  y2={padTop}
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1="0"
                  y1={padTop + plotHeight / 2}
                  x2={chartWidth}
                  y2={padTop + plotHeight / 2}
                  className="stroke-zinc-200 dark:stroke-zinc-800"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1="0"
                  y1={padTop + plotHeight}
                  x2={chartWidth}
                  y2={padTop + plotHeight}
                  className="stroke-zinc-300 dark:stroke-zinc-700"
                  strokeWidth="1"
                />

                {/* Bars for volume */}
                {trend.map((t, i) => {
                  const barHeight = (t.volume / maxVol) * plotHeight;
                  const x = colWidth * i + colWidth * 0.22;
                  const y = padTop + (plotHeight - barHeight);
                  const w = colWidth * 0.56;
                  return (
                    <g key={t.day} className="cursor-pointer group">
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={Math.max(barHeight, 2)}
                        rx="3"
                        className="fill-zinc-800 hover:fill-zinc-950 dark:fill-zinc-300 dark:hover:fill-white transition-colors"
                      />
                      <text
                        x={colWidth * i + colWidth / 2}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        className="text-[11px] fill-zinc-500 font-mono font-medium"
                      >
                        {t.day}
                      </text>
                      {t.volume > 0 && (
                        <text
                          x={colWidth * i + colWidth / 2}
                          y={y - 5}
                          textAnchor="middle"
                          className="text-[10px] fill-zinc-700 dark:fill-zinc-300 font-mono font-bold"
                        >
                          {t.volume}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* % Negative Polyline */}
                {linePoints && (
                  <polyline
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={linePoints}
                  />
                )}

                {/* % Negative Points */}
                {trend.map((t, i) => {
                  const pct = t.negative_pct ?? 0;
                  const cx = colWidth * i + colWidth / 2;
                  const cy = padTop + plotHeight * (1 - Math.min(pct / 100, 1));
                  return (
                    <g key={`pt-${t.day}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3.5}
                        fill="#F59E0B"
                        stroke="currentColor"
                        className="text-white dark:text-black"
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-zinc-500 dark:text-zinc-400">
              {peakDay && peakDay.volume > 0
                ? `Puncak volume: ${peakDay.label || peakDay.day} (${peakDay.volume} berita, ${peakDay.negative_pct ?? 0}% sentimen negatif)`
                : "Semua kanal terpantau stabil dalam 7 hari terakhir."}
            </span>
            <Link
              href="/peta"
              className="font-bold text-zinc-900 dark:text-white hover:underline"
            >
              Lihat Peta Wilayah &rarr;
            </Link>
          </div>
        </section>

        {/* Right 5 Cols: Priority Issues Radar */}
        <section className="lg:col-span-5 panel p-6 flex flex-col justify-between bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold font-mono text-zinc-900 dark:text-white uppercase tracking-wider">
                  RADAR ISU &amp; ANCAMAN
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                  Isu terkluster dengan skor risiko tertinggi
                </p>
              </div>
              <Link
                href="/isu"
                className="text-xs font-bold font-mono text-zinc-900 dark:text-white hover:underline"
              >
                Semua ({priorityIssues.length})
              </Link>
            </div>

            {priorityIssues.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-zinc-400">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Tidak ada isu kritis atau risiko tinggi saat ini.
                </p>
                <p className="mt-1">
                  Gunakan tombol &ldquo;Tarik Berita Nyata&rdquo; untuk menyinkronkan
                  feed portal resmi.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
                {priorityIssues.slice(0, 5).map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/isu/${issue.id}`}
                    className="block py-3 px-2 -mx-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-2 leading-snug">
                          {issue.judul}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                          <span className="text-zinc-700 dark:text-zinc-300 font-semibold">
                            {issue.wilayah}
                          </span>
                          <span>&bull;</span>
                          <span>{issue.kategori}</span>
                        </div>
                      </div>
                      <ThreatLevelPill level={issue.level} score={issue.skor} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-2.5">
            <Link
              href="/kasus"
              className="min-h-[38px] inline-flex items-center justify-center px-3 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-mono font-bold transition-colors text-center"
            >
              Papan Kasus
            </Link>
            <Link
              href="/laporan"
              className="min-h-[38px] inline-flex items-center justify-center px-3 py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-mono font-bold border border-zinc-300 dark:border-zinc-800 transition-colors text-center"
            >
              Laporan Eksekutif
            </Link>
          </div>
        </section>
      </div>

      {/* Monitored Media & Sources Deep Dive */}
      <SourceDeepDive />
    </div>
  );
}
