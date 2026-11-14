"use client";

import React from "react";
import { GoogleStyleMap } from "@/components/GoogleStyleMap";

export default function PetaWilayahPage() {
  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <p className="text-xs font-mono font-bold tracking-wider uppercase text-sky-600 dark:text-sky-400">
            Pemantauan Geospasial Pulau Jawa &amp; Nusantara
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Peta Sebaran Isu
          </h1>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Klik titik wilayah pada peta atau cari kota/kabupaten untuk melihat rincian isu dan laporan media.
        </p>
      </div>

      {/* Main Map View (V2) */}
      <GoogleStyleMap />
    </div>
  );
}
