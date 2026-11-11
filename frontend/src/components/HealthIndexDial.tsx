"use client";

import React from "react";
import { ShieldCheck, AlertTriangle, Flame } from "lucide-react";

interface HealthIndexDialProps {
  score: number; // 0.0 - 100.0
  criticalCount: number;
  highCount: number;
  negativePct?: number | null;
  triageStats?: {
    total_evaluated: number;
    incident_accepted: number;
    noise_filtered_pct: number;
    fast_dispatch_count: number;
  };
}

export function HealthIndexDial({
  score,
  criticalCount,
  highCount,
  negativePct = 0,
  triageStats,
}: HealthIndexDialProps) {
  // Clamp score
  const safeScore = Math.max(0, Math.min(100, score));

  // Determine status
  let statusText = "KONDUSIF & TERKENDALI";
  let badgeBg = "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
  let statusMode: "normal" | "warning" | "critical" = "normal";

  if (safeScore < 50 || criticalCount >= 2) {
    statusText = "KRITIS TANGGAP DARURAT";
    badgeBg = "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400";
    statusMode = "critical";
  } else if (safeScore < 75 || criticalCount >= 1 || highCount >= 3) {
    statusText = "WASPADA ESKALASI";
    badgeBg = "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";
    statusMode = "warning";
  }

  // SVG circular arc calculations
  const radius = 64;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  return (
    <div className="panel p-5 relative overflow-hidden flex flex-col justify-between h-full bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-white animate-pulse" />
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
            INDEX STABILITAS &amp; KESIAPSIAGAAN
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${badgeBg}`}
        >
          {statusMode === "critical" ? (
            <Flame className="w-3.5 h-3.5" />
          ) : statusMode === "warning" ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          {statusText}
        </span>
      </div>

      <div className="my-5 flex flex-col sm:flex-row items-center justify-around gap-6">
        {/* Radial Dial */}
        <div className="relative flex items-center justify-center">
          <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 160 160">
            {/* Background track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-zinc-200 dark:text-zinc-800 fill-none"
            />
            {/* Progress arc */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`transition-all duration-700 ease-out fill-none ${
                safeScore < 50
                  ? "text-red-500"
                  : safeScore < 75
                  ? "text-amber-500"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            />
          </svg>

          {/* Center value */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black font-mono tracking-tight text-zinc-900 dark:text-white">
              {safeScore.toFixed(0)}
            </span>
            <span className="text-[10px] font-mono uppercase text-zinc-400">
              DARI 100
            </span>
          </div>
        </div>

        {/* Tactical Parameters Breakdown */}
        <div className="flex-1 space-y-2.5 w-full text-xs font-mono">
          <div className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-400">Isu Kritis Aktif:</span>
            <span className={`font-bold ${criticalCount > 0 ? "text-red-500" : "text-zinc-900 dark:text-zinc-100"}`}>
              {criticalCount} Insiden
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-400">Isu Prioritas Tinggi:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{highCount} Isu</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-400">Tekanan Sentimen Negatif:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {negativePct !== null ? `${negativePct}%` : "Normal"}
            </span>
          </div>

          {triageStats && (
            <div className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">Jev Noise Filter:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {triageStats.noise_filtered_pct}% Reduksi Promo
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
        <span>Evaluasi: Dinamis 24 Jam Berbasis Berita &amp; Laporan Lapangan</span>
        <span className="font-mono text-zinc-400">Jabodetabek Radar</span>
      </div>
    </div>
  );
}
