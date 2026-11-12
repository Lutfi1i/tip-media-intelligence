"use client";

import React from "react";
import Link from "next/link";
import { IssueItem } from "@/lib/api";
import { ThreatLevelPill } from "./RadarUi";
import { SourceLogoBadge, MediaAvatarStack } from "./SourceLogos";
import {
  Flame,
  TrendingUp,
  MapPin,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";

interface TopHotIssuesCardsProps {
  issues: IssueItem[];
}

export function TopHotIssuesCards({ issues }: TopHotIssuesCardsProps) {
  // Ambil 3 isu teratas dengan skor tertinggi
  const top3 = (issues || []).slice(0, 3);

  if (top3.length === 0) return null;

  // Visual gradient card accents untuk colorful modern feel
  const CARD_THEMES = [
    {
      gradient: "from-rose-500/10 via-amber-500/5 to-transparent",
      border: "border-rose-400/40 dark:border-rose-500/30",
      accentBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      flameColor: "text-rose-500",
      barColor: "bg-gradient-to-r from-rose-500 to-amber-500",
      glowBadge: "bg-rose-500",
      rankBadge: "bg-rose-600 text-white",
      highlightBorder: "hover:border-rose-500",
    },
    {
      gradient: "from-blue-500/10 via-indigo-500/5 to-transparent",
      border: "border-blue-400/40 dark:border-blue-500/30",
      accentBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      flameColor: "text-blue-500",
      barColor: "bg-gradient-to-r from-blue-500 to-indigo-500",
      glowBadge: "bg-blue-500",
      rankBadge: "bg-blue-600 text-white",
      highlightBorder: "hover:border-blue-500",
    },
    {
      gradient: "from-amber-500/10 via-emerald-500/5 to-transparent",
      border: "border-amber-400/40 dark:border-amber-500/30",
      accentBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      flameColor: "text-amber-500",
      barColor: "bg-gradient-to-r from-amber-500 to-emerald-500",
      glowBadge: "bg-amber-500",
      rankBadge: "bg-amber-600 text-white",
      highlightBorder: "hover:border-amber-500",
    },
  ];

  return (
    <section className="space-y-3.5">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Flame className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-rose-600 dark:text-rose-400">
                HOTSPOTS NASIONAL &bull; TOP 3 PRIORITAS TERTINGGI
              </span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                VIRAL
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
              3 Isu Panas Paling Mendesak di Indonesia Hari Ini
            </h2>
          </div>
        </div>

        <Link
          href="/isu"
          className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 self-start sm:self-auto group"
        >
          <span>Lihat Semua Klaster Isu ({issues.length})</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* 3 Colorful Interactive Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((issue, idx) => {
          const theme = CARD_THEMES[idx % CARD_THEMES.length];
          const scorePercent = Math.min(100, Math.max(0, issue.skor));

          // Mock source channels per card to show YouTube & Threads integration
          const sourceIcons =
            idx === 0
              ? ["youtube", "threads", "bmkg", "detik"]
              : idx === 1
              ? ["threads", "youtube", "dishub", "x"]
              : ["youtube", "threads", "cnn", "antara"];

          return (
            <div
              key={issue.id}
              className={`relative rounded-2xl border ${theme.border} ${theme.highlightBorder} bg-gradient-to-b ${theme.gradient} bg-white dark:bg-zinc-950/80 p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group overflow-hidden`}
            >
              {/* Colorful Accent Top Bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${theme.barColor}`}
              />

              {/* Card Header: Rank Badge, Region & Threat Level */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg ${theme.rankBadge} flex items-center justify-center text-xs font-black font-mono shadow-xs`}
                    >
                      #{idx + 1}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900/80 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      <span>{issue.wilayah}</span>
                    </span>
                  </div>

                  <ThreatLevelPill level={issue.level} score={issue.skor} />
                </div>

                {/* Issue Title & Category */}
                <div className="mb-2.5">
                  <span
                    className={`inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-1.5 ${theme.accentBg}`}
                  >
                    {issue.kategori}
                  </span>
                  <Link
                    href={`/isu/${issue.id}`}
                    className="block group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors"
                  >
                    <h3 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white leading-snug line-clamp-2">
                      {issue.judul}
                    </h3>
                  </Link>
                </div>

                {/* Summary Excerpt */}
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed mb-4">
                  {issue.ringkasan || "Tidak ada rincian ringkasan."}
                </p>
              </div>

              {/* Card Footer: Live Channels, Metric Meter & Detail Action */}
              <div className="pt-3.5 border-t border-zinc-100 dark:border-zinc-900 space-y-3">
                {/* Visual Signals: Overlapping Stack Media Icons (Gambar 2 Sesuai Permintaan) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-400">
                      Kanal:
                    </span>
                    <MediaAvatarStack
                      sources={sourceIcons}
                      max={3}
                      size="md"
                    />
                  </div>

                  {/* Volume Mentions & Verif Status */}
                  <div className="text-right">
                    <span className="text-xs font-black font-mono text-zinc-900 dark:text-zinc-100">
                      {issue.current_volume} Laporan
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 block">
                      Status: {issue.status}
                    </span>
                  </div>
                </div>

                {/* Score Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                    <span className="text-zinc-500">Skor Bahaya &amp; Urgensi</span>
                    <span className="text-zinc-900 dark:text-white font-extrabold">
                      {issue.skor} / 100
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${theme.barColor} transition-all duration-500 rounded-full`}
                      style={{ width: `${scorePercent}%` }}
                    />
                  </div>
                </div>

                {/* Action Link Button */}
                <Link
                  href={`/isu/${issue.id}`}
                  className="w-full min-h-[34px] rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-zinc-950 shadow-xs"
                >
                  <span>Buka Analisis &amp; Verifikasi</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
