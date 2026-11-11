"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchDashboardSummary,
  DashboardKPI,
  TrendPoint,
  IssueItem,
  RegionSummary,
} from "@/lib/api";
import {
  RadarKpiCard,
  ThreatLevelPill,
  SourceBadge,
} from "@/components/RadarUi";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<DashboardKPI | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [priorityIssues, setPriorityIssues] = useState<IssueItem[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardSummary();
      setKpi(data.kpi);
      setTrend(data.trend_7d || []);
      setPriorityIssues(data.priority_issues || []);
      setRegions(data.regions || []);
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
      <div className="panel p-12 text-center">
        <div className="inline-block w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-200">
          Memindai Sinyal Media &amp; Radar Intelijen...
        </p>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Sinkronisasi feed berita nasional, BMKG, Dishub DKI, dan kalkulasi risiko
        </p>
      </div>
    );
  }

  if (error || !kpi) {
    return (
      <div className="panel border-red-500/40 p-8 max-w-lg mx-auto my-8 bg-red-950/20">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
          <h2 className="text-base font-bold">Koneksi Radar Terputus</h2>
        </div>
        <p className="text-xs text-slate-300 mb-5 leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="min-h-[40px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Coba Hubungkan Ulang
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1E2A4A]/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-sky-400">
              WAR ROOM &bull; EXECUTIVE RADAR
            </span>
            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LIVE INGESTION
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
            Situasi Terkini Media &amp; Bencana
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono hidden md:inline">
            Pembaruan: {lastRefreshed.toLocaleTimeString("id-ID")} WIB
          </span>
          <button
            type="button"
            onClick={loadData}
            className="min-h-[36px] px-3.5 py-1.5 text-xs font-bold text-slate-200 bg-[#10172E] hover:bg-[#16203C] border border-[#1E2A4A] rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5 text-sky-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Segarkan
          </button>
        </div>
      </div>

      {/* 4 Core Signals KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RadarKpiCard
          label="Total Mention Terkumpul"
          value={kpi.mention_unik.toLocaleString("id-ID")}
          hint="Dari 6 feed resmi publik teruji"
          trend={
            kpi.mention_growth_pct !== null
              ? `${kpi.mention_growth_pct > 0 ? "+" : ""}${kpi.mention_growth_pct}% 24j`
              : "Volume stabil"
          }
          trendPositive={(kpi.mention_growth_pct ?? 0) <= 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          }
        />

        <RadarKpiCard
          label="Isu Prioritas Aktif"
          value={kpi.isu_prioritas}
          hint={`${kpi.critical_count} Kritis, ${kpi.high_count} Tinggi`}
          trend={kpi.isu_prioritas > 0 ? "Perlu Respon" : "Kondusif"}
          trendPositive={kpi.isu_prioritas === 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />

        <RadarKpiCard
          label="Wilayah Terdampak"
          value={kpi.wilayah_terdampak}
          hint={`Dari ${kpi.total_wilayah_terpantau} wilayah terpantau`}
          trend={`${Math.round((kpi.wilayah_terdampak / Math.max(kpi.total_wilayah_terpantau, 1)) * 100)}% sebaran`}
          trendPositive={kpi.wilayah_terdampak <= 2}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        <RadarKpiCard
          label="Kasus Menunggu Aksi"
          value={kpi.menunggu_aksi}
          hint={`${kpi.lewat_tenggat} kasus lewat SLA`}
          trend={kpi.lewat_tenggat > 0 ? "Eskalasi" : "Terkendali"}
          trendPositive={kpi.lewat_tenggat === 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Main Split: 7-Day Trend Chart & Priority Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: 7-Day Trend Chart */}
        <section className="lg:col-span-7 panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-[#1E2A4A]">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Dinamika Tren 7 Hari
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Volume berita terkumpul dan rasio sentimen negatif harian
                </p>
              </div>

              <div className="flex items-center space-x-4 text-xs font-mono">
                <span className="inline-flex items-center text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 mr-1.5" />
                  Volume
                </span>
                <span className="inline-flex items-center text-amber-400">
                  <span className="w-3 h-0.5 bg-amber-400 mr-1.5" />% Negatif
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto pt-2">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto min-w-[340px]"
                role="img"
                aria-label="Grafik tren 7 hari volume mention dan persentase sentimen negatif"
              >
                {/* Horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = padTop + plotHeight * (1 - ratio);
                  return (
                    <line
                      key={ratio}
                      x1={12}
                      y1={y}
                      x2={chartWidth - 12}
                      y2={y}
                      stroke="#1E2A4A"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  );
                })}

                {/* Baseline */}
                <line
                  x1={12}
                  y1={padTop + plotHeight}
                  x2={chartWidth - 12}
                  y2={padTop + plotHeight}
                  stroke="#1E2A4A"
                  strokeWidth={1.5}
                />

                {/* Bars */}
                {trend.map((t, i) => {
                  const barW = 34;
                  const x = colWidth * i + (colWidth - barW) / 2;
                  const barH =
                    maxVol > 0
                      ? Math.max(6, (t.volume / maxVol) * (plotHeight - 8))
                      : 6;
                  const y = padTop + plotHeight - barH;
                  const isTop = peakDay && t.day === peakDay.day;

                  return (
                    <g key={t.day}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={barH}
                        rx={4}
                        fill={isTop ? "#0284C7" : "#1E2A4A"}
                        className="hover:fill-sky-400 transition-colors"
                      />
                      <text
                        x={colWidth * i + colWidth / 2}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        className="text-[11px] fill-slate-400 font-mono font-medium"
                      >
                        {t.day}
                      </text>
                      {t.volume > 0 && (
                        <text
                          x={colWidth * i + colWidth / 2}
                          y={y - 5}
                          textAnchor="middle"
                          className="text-[10px] fill-slate-300 font-mono font-bold"
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
                        stroke="#10172E"
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1E2A4A] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-mono">
              {peakDay && peakDay.volume > 0
                ? `Puncak volume: ${peakDay.label || peakDay.day} (${peakDay.volume} berita, ${peakDay.negative_pct ?? 0}% sentimen negatif)`
                : "Semua kanal terpantau stabil dalam 7 hari terakhir."}
            </span>
            <Link
              href="/peta"
              className="font-bold text-sky-400 hover:text-sky-300 transition-colors"
            >
              Lihat Peta Wilayah &rarr;
            </Link>
          </div>
        </section>

        {/* Right 5 Cols: Priority Issues Radar */}
        <section className="lg:col-span-5 panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1E2A4A]">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Radar Isu &amp; Ancaman
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Isu terkluster dengan skor risiko tertinggi
                </p>
              </div>
              <Link
                href="/isu"
                className="text-xs font-bold text-sky-400 hover:text-sky-300 font-mono"
              >
                Semua ({priorityIssues.length})
              </Link>
            </div>

            {priorityIssues.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <p className="font-semibold text-slate-300">
                  Tidak ada isu kritis atau risiko tinggi saat ini.
                </p>
                <p className="mt-1">
                  Gunakan tombol &ldquo;Tarik Berita Nyata&rdquo; untuk menyinkronkan
                  feed portal resmi.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#1E2A4A]/60">
                {priorityIssues.slice(0, 5).map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/isu/${issue.id}`}
                    className="block py-3 px-2 -mx-2 rounded-lg hover:bg-[#16203C] transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300 line-clamp-2 leading-snug">
                          {issue.judul}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400 font-mono">
                          <span className="text-slate-300 font-semibold">
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

          <div className="mt-5 pt-4 border-t border-[#1E2A4A] grid grid-cols-2 gap-2.5">
            <Link
              href="/kasus"
              className="min-h-[38px] inline-flex items-center justify-center px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors text-center"
            >
              Papan Kasus
            </Link>
            <Link
              href="/laporan"
              className="min-h-[38px] inline-flex items-center justify-center px-3 py-2 rounded-lg bg-[#16203C] hover:bg-[#1E2A4A] text-slate-200 text-xs font-bold border border-[#1E2A4A] transition-colors text-center"
            >
              Laporan Eksekutif
            </Link>
          </div>
        </section>
      </div>

      {/* Regional Exposure Overview (Radar Table) */}
      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#1E2A4A]">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Status Sebaran Wilayah Kemendagri
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tingkat penyebaran isu di DKI Jakarta dan wilayah penyangga Bodetabek
            </p>
          </div>
          <Link
            href="/peta"
            className="text-xs font-bold text-sky-400 hover:text-sky-300 font-mono"
          >
            Buka Peta Skematis &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {regions.slice(0, 6).map((reg) => (
            <div
              key={reg.kode_wilayah}
              className="bg-[#16203C]/80 border border-[#1E2A4A] rounded-lg p-3.5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-200 truncate">
                  {reg.nama}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {reg.kode_wilayah}
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-sky-400 mt-1">
                {reg.mention_count}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Negatif:</span>
                <span
                  className={`font-mono font-bold ${
                    reg.sentiment_negative_pct > 50
                      ? "text-red-400"
                      : "text-slate-300"
                  }`}
                >
                  {reg.sentiment_negative_pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
