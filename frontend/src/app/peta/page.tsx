"use client";

import React from "react";
import { IndonesiaMap } from "@/components/IndonesiaMap";
import { Map, ShieldCheck } from "lucide-react";

export default function PetaWilayahPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
              GEOGRAPHIC RADAR &bull; SEBARAN WILAYAH
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800">
              KEMENDAGRI COMPLIANT
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Peta Sebaran Insiden &amp; Heatmap Wilayah
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Fokus Operasional: DKI Jakarta &amp; Bodetabek</span>
        </div>
      </div>

      {/* Authentic Interactive Indonesia & Jabodetabek Map */}
      <IndonesiaMap />
    </div>
  );
}
