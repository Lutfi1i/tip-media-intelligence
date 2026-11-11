"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchDashboardSummary,
  DashboardKPI,
  TrendPoint,
  IssueItem,
} from "@/lib/api";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<DashboardKPI | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [priorityIssues, setPriorityIssues] = useState<IssueItem[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardSummary();
      setKpi(data.kpi);
      setTrend(data.trend_7d);
      setPriorityIssues(data.priority_issues);
    } catch (err: any) {
      setError(
        err.message ||
          "Gagal terhubung ke server API backend. Pastikan start_backend.bat sudah berjalan di port 8001."
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
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Memuat metrik situasi terkini dan tren 7 hari...
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Mengambil ringkasan mention unik, isu prioritas, dan status SLA.
        </p>
      </div>
    );
  }

  if (error || !kpi) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 max-w-lg mx-auto my-8">
        <h2 className="text-base font-bold text-red-900">
          Koneksi ke Backend Terputus
        </h2>
        <p className="text-sm text-slate-600 mt-1 mb-4">
          {error || "Tidak dapat mengambil data ringkasan."}
        </p>
        <button
          type="button"
          onClick={loadData}
          className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Muat Ulang Data
        </button>
      </div>
    );
  }

  const maxVol = Math.max(...trend.map((t) => t.volume), 400);

  // Compute SVG coordinates for the 7-day combo chart (Slide 8)
  const chartWidth = 560;
  const chartHeight = 190;
  const padTop = 24;
  const padBottom = 32;
  const plotHeight = chartHeight - padTop - padBottom;
  const colWidth = chartWidth / Math.max(trend.length, 1);

  const linePoints = trend
    .map((t, i) => {
      const cx = colWidth * i + colWidth / 2;
      const cy = padTop + plotHeight * (1 - t.negative_pct / 90);
      return `${cx},${cy}`;
    })
    .join(" ");

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wider uppercase text-blue-700">
            Dashboard Pimpinan
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Situasi terkini dalam satu layar
          </h1>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="self-start sm:self-auto min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
        >
          Segarkan Data
        </button>
      </div>

      {/* 4 KPI Cards matching Slide 8 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/90 p-5">
          <div className="text-sm font-medium text-slate-500">Mention unik</div>
          <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            {kpi.mention_unik.toLocaleString("id-ID")}
          </div>
          <div className="text-xs font-semibold text-[#C2410C] mt-2">
            +{kpi.mention_growth_pct}% vs minggu lalu
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-5">
          <div className="text-sm font-medium text-slate-500">Isu prioritas</div>
          <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            {kpi.isu_prioritas}
          </div>
          <div className="text-xs font-medium text-slate-500 mt-2">
            {kpi.critical_count} Critical, {kpi.high_count} High
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-5">
          <div className="text-sm font-medium text-slate-500">
            Wilayah terdampak
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            {kpi.wilayah_terdampak}
          </div>
          <div className="text-xs font-medium text-slate-500 mt-2">
            dari {kpi.total_wilayah_terpantau} terpantau
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-5">
          <div className="text-sm font-medium text-slate-500">Menunggu aksi</div>
          <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            {kpi.menunggu_aksi}
          </div>
          <div className="text-xs font-semibold text-[#C2410C] mt-2">
            {kpi.lewat_tenggat} lewat tenggat
          </div>
        </div>
      </div>

      {/* Main Content Split: 7-Day Trend (Left) & Priority Issues (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: 7-Day Trend Chart */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Tren 7 hari: volume dan{" "}
                <span className="text-[#C2410C]">% negatif</span>
              </h2>
              <div className="flex items-center space-x-4 text-xs text-slate-600">
                <span className="inline-flex items-center">
                  <span className="w-3 h-3 rounded-xs bg-[#2563EB] mr-1.5" />
                  Volume puncak
                </span>
                <span className="inline-flex items-center">
                  <span className="w-3 h-0.5 bg-[#D97706] mr-1.5" />% Sentimen
                  negatif
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto pt-2">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto min-w-[360px]"
                role="img"
                aria-label="Grafik tren 7 hari volume mention dan persentase sentimen negatif"
              >
                {/* Baseline horizontal line */}
                <line
                  x1={12}
                  y1={padTop + plotHeight}
                  x2={chartWidth - 12}
                  y2={padTop + plotHeight}
                  stroke="#E2E8F0"
                  strokeWidth={1.5}
                />

                {/* Bars */}
                {trend.map((t, i) => {
                  const barW = 38;
                  const x = colWidth * i + (colWidth - barW) / 2;
                  const barH = Math.max(
                    12,
                    (t.volume / maxVol) * (plotHeight - 10)
                  );
                  const y = padTop + plotHeight - barH;
                  const isPeak = t.day === "Sab";

                  return (
                    <g key={t.day}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={barH}
                        rx={4}
                        fill={isPeak ? "#2563EB" : "#BFDBFE"}
                      />
                      <text
                        x={colWidth * i + colWidth / 2}
                        y={chartHeight - 10}
                        textAnchor="middle"
                        className="text-[12px] fill-slate-500 font-medium"
                      >
                        {t.day}
                      </text>
                    </g>
                  );
                })}

                {/* % Negative Polyline */}
                <polyline
                  fill="none"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={linePoints}
                />

                {/* % Negative Points & Labels */}
                {trend.map((t, i) => {
                  const cx = colWidth * i + colWidth / 2;
                  const cy = padTop + plotHeight * (1 - t.negative_pct / 90);
                  return (
                    <g key={`pt-${t.day}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill="#D97706"
                        stroke="#FFFFFF"
                        strokeWidth={1.5}
                      />
                      {t.day === "Sab" && (
                        <text
                          x={cx}
                          y={cy - 10}
                          textAnchor="middle"
                          className="text-[11px] font-bold fill-[#9A3412]"
                        >
                          {t.negative_pct}%
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Lonjakan tertinggi hari Sabtu: 360 mention (72% sentimen negatif).
            </span>
            <Link
              href="/peta"
              className="font-semibold text-blue-700 hover:text-blue-900"
            >
              Buka Peta Wilayah
            </Link>
          </div>
        </section>

        {/* Right 5 Cols: Priority Issues List matching Slide 8 */}
        <section className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Isu prioritas
              </h2>
              <Link
                href="/isu"
                className="text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                Lihat antrean ({priorityIssues.length})
              </Link>
            </div>

            {priorityIssues.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Belum ada isu prioritas. Klik tombol &ldquo;Muat Skenario
                Banjir&rdquo; di atas untuk memuat simulasi.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {priorityIssues.slice(0, 5).map((issue) => {
                  const pillStyle =
                    {
                      CRITICAL: "bg-[#B91C1C] text-white",
                      HIGH: "bg-[#EA580C] text-white",
                      MEDIUM: "bg-[#2563EB] text-white",
                      LOW: "bg-slate-200 text-slate-800",
                    }[issue.level] || "bg-slate-200 text-slate-800";

                  return (
                    <Link
                      key={issue.id}
                      href={`/isu/${issue.id}`}
                      className="flex items-center justify-between py-3.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="pr-3 min-w-0">
                        <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 truncate">
                          {issue.judul}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {issue.wilayah} &middot; Skor {Math.round(issue.skor)}{" "}
                          &middot;{" "}
                          <span className="capitalize">{issue.status}</span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-md tracking-wide ${pillStyle}`}
                      >
                        {issue.level}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2.5">
            <Link
              href="/kasus"
              className="min-h-[40px] inline-flex items-center justify-center px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors text-center"
            >
              Papan Kasus (SLA)
            </Link>
            <Link
              href="/laporan"
              className="min-h-[40px] inline-flex items-center justify-center px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors text-center"
            >
              Laporan Eksekutif
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
