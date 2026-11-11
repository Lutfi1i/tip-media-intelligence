"use client";

import React from "react";
import { ShieldCheck, BarChart3, Radio } from "lucide-react";

interface SourceChannel {
  name: string;
  category: string;
  credibility: number;
  volume: number;
  negativeRate: number;
  status: string;
}

export function SourceDeepDive() {
  const sources: SourceChannel[] = [
    {
      name: "Antara News",
      category: "Kantor Berita Negara",
      credibility: 0.95,
      volume: 48,
      negativeRate: 22,
      status: "Resmi & Terverifikasi",
    },
    {
      name: "detikcom",
      category: "Portal Berita Nasional",
      credibility: 0.90,
      volume: 72,
      negativeRate: 36,
      status: "Berita Cepat Terverifikasi",
    },
    {
      name: "CNN Indonesia",
      category: "Portal Berita Nasional",
      credibility: 0.92,
      volume: 38,
      negativeRate: 26,
      status: "Investigasi & Live Update",
    },
    {
      name: "BMKG (Badan Meteorologi)",
      category: "Sensor Resmi Bencana",
      credibility: 0.99,
      volume: 16,
      negativeRate: 15,
      status: "Kanal Telemetri Sensor",
    },
    {
      name: "Dishub DKI Jakarta",
      category: "Sensor Lalu Lintas & Transportasi",
      credibility: 0.96,
      volume: 24,
      negativeRate: 30,
      status: "Informasi Rekayasa Jalan",
    },
  ];

  return (
    <div className="panel p-5 relative overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
            RADAR KANAL &amp; INTEGRITAS SUMBER (DEEP DIVE)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          5 KANAL AKTIF
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sources.map((src) => (
          <div
            key={src.name}
            className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="font-bold text-zinc-900 dark:text-white">
                  {src.name}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {Math.round(src.credibility * 100)}%
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                {src.category}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-zinc-400 block text-[10px]">VOLUME</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {src.volume} lap.
                </span>
              </div>
              <div className="text-right">
                <span className="text-zinc-400 block text-[10px]">NEGATIF</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {src.negativeRate}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
