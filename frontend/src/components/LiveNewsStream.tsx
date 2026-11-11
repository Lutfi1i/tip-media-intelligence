"use client";

import React from "react";
import { LiveArticle } from "@/lib/api";
import { SentimentBadge, SourceBadge } from "./RadarUi";
import { ExternalLink, Clock, MapPin, CheckCircle2 } from "lucide-react";

interface LiveNewsStreamProps {
  articles?: LiveArticle[];
}

export function LiveNewsStream({ articles = [] }: LiveNewsStreamProps) {
  if (articles.length === 0) {
    return (
      <div className="panel p-6 text-center text-zinc-500 font-mono text-xs">
        Belum ada siaran berita real-time yang tersimpan. Klik &quot;Tarik Berita Nyata&quot; di menu atas.
      </div>
    );
  }

  return (
    <div className="panel p-5 relative overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
            STREAMING BERITA &amp; LAPORAN NYATA (LIVE LISTENING)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          TERBARU 24 JAM
        </span>
      </div>

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800/80 max-h-[500px] overflow-y-auto pr-1">
        {articles.map((item) => {
          let timeDisplay = "Terkini";
          if (item.published_at) {
            try {
              const dt = new Date(item.published_at);
              timeDisplay = dt.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Jakarta",
              }) + " WIB";
            } catch {
              timeDisplay = "Baru saja";
            }
          }

          return (
            <div
              key={item.id}
              className="py-3.5 first:pt-0 last:pb-0 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 rounded px-2 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono mb-1.5">
                <div className="flex items-center gap-2">
                  <SourceBadge source={item.penerbit} />
                  <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-[11px]">
                    <Clock className="w-3 h-3" />
                    {timeDisplay}
                  </span>
                  {item.lokasi_kejadian && (
                    <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-medium text-[11px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      <MapPin className="w-3 h-3 text-zinc-500" />
                      {item.lokasi_kejadian}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <SentimentBadge sentiment={item.sentimen} />
                  <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {Math.round(item.kredibilitas * 100)}%
                  </span>
                </div>
              </div>

              <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 hover:text-zinc-600 dark:hover:text-zinc-300">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-baseline gap-1"
                >
                  <span>{item.judul}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-60 hover:opacity-100" />
                </a>
              </h4>

              {item.ringkasan && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {item.ringkasan}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
