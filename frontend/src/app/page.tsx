"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  AlertCircle, 
  MapPin, 
  Clock, 
  ArrowUpRight, 
  CheckCircle2, 
  ShieldAlert,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { fetchDashboardSummary, DashboardKPI, TrendPoint, IssueItem } from "@/lib/api";

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
      setError(err.message || "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Memuat data situasi terkini...</p>
      </div>
    );
  }

  if (error || !kpi) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-red-900 mb-1">Terjadi Kendala Koneksi</h2>
        <p className="text-sm text-red-700 mb-4">{error || "Data tidak dapat diakses."}</p>
        <button
          onClick={loadData}
          className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Coba Lagi
        </button>
      </div>
    );
  }

  // Calculate maximum volume for proportional bar heights
  const maxVol = Math.max(...trend.map((t) => t.volume), 400);

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Situasi Terkini Dalam Satu Layar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            app.tipmedia.id/dashboard &bull; Pemantauan aktif 24 jam wilayah pilot
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300">
            Data Simulasi Terkalibrasi
          </span>
          <button
            onClick={loadData}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI 4 Cards Grid - Exactly matching PRD Slide 8 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Mention Unik */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Mention Unik</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpi.mention_unik.toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              +{kpi.mention_growth_pct}% vs minggu lalu
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Total mention tersaring dari media online, RSS, dan pengaduan.
          </p>
        </div>

        {/* Card 2: Isu Prioritas */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Isu Prioritas</span>
            <ShieldAlert className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpi.isu_prioritas}
            </span>
            <span className="text-xs font-semibold text-orange-800 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
              {kpi.critical_count} Critical, {kpi.high_count} High
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Isu berbobot risiko tinggi yang memerlukan atensi eksekutif.
          </p>
        </div>

        {/* Card 3: Wilayah Terdampak */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Wilayah Terdampak</span>
            <MapPin className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpi.wilayah_terdampak}
            </span>
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              dari {kpi.total_wilayah_terpantau} terpantau
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Titik persebaran percakapan publik di DKI & Bodetabek.
          </p>
        </div>

        {/* Card 4: Menunggu Aksi */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Menunggu Aksi</span>
            <Clock className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpi.menunggu_aksi}
            </span>
            <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              {kpi.lewat_tenggat} lewat tenggat
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Tiket kasus yang membutuhkan konfirmasi PIC atau eskalasi pimpinan.
          </p>
        </div>
      </div>

      {/* Main Section: 7-Day Trend Chart & Priority Issues List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Trend (Volume & % Negatif) */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Tren 7 hari: volume dan % negatif
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kombinasi volume total mention (batang) dan rasio sentimen negatif (garis indikator)
              </p>
            </div>
            <div className="flex items-center space-x-4 mt-2 sm:mt-0 text-xs">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-sm mr-1.5" />
                <span className="text-slate-600 font-medium">Volume Mention</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-1 bg-amber-500 rounded-full mr-1.5" />
                <span className="text-slate-600 font-medium">% Negatif</span>
              </div>
            </div>
          </div>

          {/* Accessible Custom SVG/HTML Chart */}
          <div className="pt-6 pb-2">
            <div className="h-64 flex items-end justify-between gap-3 px-2 border-b border-slate-200 pb-2 relative">
              {/* Background Guideline */}
              <div className="absolute inset-x-0 top-1/4 border-b border-dashed border-slate-100" />
              <div className="absolute inset-x-0 top-2/4 border-b border-dashed border-slate-100" />
              <div className="absolute inset-x-0 top-3/4 border-b border-dashed border-slate-100" />

              {trend.map((t, idx) => {
                const heightPct = Math.round((t.volume / maxVol) * 100);
                const isSaturdayPeak = t.day === "Sab";
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end z-10 group">
                    {/* Hover tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] rounded px-2 py-1 mb-2 pointer-events-none whitespace-nowrap shadow-lg">
                      <div className="font-bold">{t.day}: {t.volume} mention</div>
                      <div className="text-amber-300 font-medium">{t.negative_pct}% sentimen negatif</div>
                    </div>

                    {/* % Negative marker dot */}
                    <div 
                      className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm mb-1.5 ${
                        t.negative_pct >= 60 ? "bg-red-600" : "bg-amber-500"
                      }`}
                      style={{ transform: `translateY(-${Math.min(t.negative_pct * 0.4, 40)}px)` }}
                      title={`% Negatif: ${t.negative_pct}%`}
                    />

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[42px] rounded-t transition-all ${
                        isSaturdayPeak
                          ? "bg-blue-600 hover:bg-blue-700 shadow-md ring-2 ring-blue-300 ring-offset-1"
                          : "bg-blue-200 hover:bg-blue-400"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between px-2 pt-3 text-xs font-semibold text-slate-600">
              {trend.map((t, idx) => (
                <div key={idx} className="flex-1 text-center">
                  <span className={t.day === "Sab" ? "text-blue-700 font-bold" : ""}>
                    {t.day}
                  </span>
                  <div className="text-[10px] text-slate-400 font-normal">{t.volume}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Puncak anomali terdeteksi pada hari Sabtu (Sab) dengan 360 mention dan 72% sentimen negatif.</span>
            <Link href="/peta" className="text-blue-600 font-semibold hover:text-blue-800 flex items-center">
              Lihat Sebaran Peta <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>

        {/* Right Col: Isu Prioritas List - Slide 8 Mockup */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Isu prioritas
              </h2>
              <Link href="/isu" className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center">
                Semua <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {priorityIssues.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">Tidak ada isu aktif.</p>
              ) : (
                priorityIssues.map((issue) => {
                  const badgeClasses = {
                    CRITICAL: "bg-red-100 text-red-900 border-red-200",
                    HIGH: "bg-orange-100 text-orange-900 border-orange-200",
                    MEDIUM: "bg-blue-100 text-blue-900 border-blue-200",
                    LOW: "bg-slate-100 text-slate-800 border-slate-200",
                  }[issue.level] || "bg-slate-100 text-slate-800";

                  return (
                    <Link
                      key={issue.id}
                      href={`/isu/${issue.id}`}
                      className="block p-3 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-bold text-sm text-slate-900 leading-snug">
                          {issue.judul}
                        </div>
                        <span className={`ml-2 text-[11px] font-bold px-2 py-0.5 rounded border ${badgeClasses}`}>
                          {issue.level}
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-slate-500 mt-1.5 space-x-2">
                        <span>{issue.wilayah}</span>
                        <span>&bull;</span>
                        <span>Skor {Math.round(issue.skor)}</span>
                        <span>&bull;</span>
                        <span className="capitalize">{issue.status}</span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col space-y-2">
            <Link
              href="/kasus"
              className="w-full text-center py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-sm transition-colors"
            >
              Buka Papan Tindak Lanjut Kasus (SLA)
            </Link>
            <Link
              href="/laporan"
              className="w-full text-center py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold transition-colors"
            >
              Unduh Laporan Briefing Eksekutif (PDF)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
