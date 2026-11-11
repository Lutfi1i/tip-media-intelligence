"use client";

import React from "react";
import { FlowItem } from "@/lib/api";
import { GitCommit, ArrowRight } from "lucide-react";

interface ConversationFlowProps {
  flows?: FlowItem[];
}

export function ConversationFlow({ flows = [] }: ConversationFlowProps) {
  const displayFlows: FlowItem[] =
    flows.length > 0
      ? flows
      : [
          { source: "detikcom", topic: "Bencana", value: 34 },
          { source: "Antara News", topic: "Infrastruktur", value: 28 },
          { source: "CNN Indonesia", topic: "Pelayanan Publik", value: 19 },
          { source: "BMKG Resmi", topic: "Bencana", value: 16 },
          { source: "Dishub DKI", topic: "Pelayanan Publik", value: 15 },
          { source: "detikcom", topic: "Keamanan", value: 12 },
        ];

  const totalVolume = displayFlows.reduce((acc, curr) => acc + curr.value, 0) || 1;

  return (
    <div className="panel p-5 relative overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
            DISTRIBUSI ARUS INFORMASI (FLOW)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          SUMBER KE TOPIK KEJADIAN
        </span>
      </div>

      <div className="my-4 space-y-3">
        {displayFlows.slice(0, 6).map((flow, idx) => {
          const pct = Math.round((flow.value / totalVolume) * 100);
          return (
            <div
              key={`${flow.source}-${flow.topic}-${idx}`}
              className="group p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
            >
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {flow.source}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-1 transition-transform" />
                  <span className="px-1.5 py-0.5 rounded text-[11px] bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {flow.topic}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-white">
                  <span>{flow.value} lap.</span>
                  <span className="text-zinc-400 text-[11px]">({pct}%)</span>
                </div>
              </div>

              {/* Intensity progress bar */}
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(8, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
        <span>Total Agregasi: {totalVolume} Alur Terdata</span>
        <span>Auto-clustered via Kemendagri &amp; AI</span>
      </div>
    </div>
  );
}
