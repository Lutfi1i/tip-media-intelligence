"use client";

import React, { useState } from "react";
import { GoogleStyleMap } from "@/components/GoogleStyleMap";
import { IndonesiaMap } from "@/components/IndonesiaMap";
import { Map, Layers, Radio, Sparkles } from "lucide-react";

export default function PetaWilayahPage() {
  // Feature flag peta_v2 (Default: Google Maps Style)
  const [mapVersion, setMapVersion] = useState<"v2" | "v1">("v2");

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-500 animate-pulse" />
              <span>RADAR GEOSPASIAL &bull; PULAU JAWA &amp; NUSANTARA</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Peta Sebaran Insiden &amp; Heatmap Wilayah
          </h1>
        </div>

        {/* Mode Switcher: Google Maps Style (V2) vs Peta Klasik (V1) */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMapVersion("v2")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              mapVersion === "v2"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>Google Maps (V2)</span>
          </button>
          <button
            type="button"
            onClick={() => setMapVersion("v1")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              mapVersion === "v1"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Peta Klasik (V1)</span>
          </button>
        </div>
      </div>

      {/* Main Map View */}
      {mapVersion === "v2" ? <GoogleStyleMap /> : <IndonesiaMap />}
    </div>
  );
}
