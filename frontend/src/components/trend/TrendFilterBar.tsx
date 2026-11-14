"use client";

import { TREND_PERIODS, TREND_PLATFORMS } from "@/lib/trendFilters";
import { TrendLocationPicker } from "./TrendLocationPicker";
import { useTrendFilters } from "./TrendFiltersContext";

/** Baris filter yang sama di semua menu Tren Sosial. */
export function TrendFilterBar() {
  const { filters, setFilters } = useTrendFilters();

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tren">
      <TrendLocationPicker
        kode={filters.lokasi}
        nama={filters.lokasiNama}
        onChange={(lokasi, lokasiNama) => setFilters({ lokasi, lokasiNama })}
      />

      <div
        role="radiogroup"
        aria-label="Periode"
        className="inline-flex rounded-md border border-zinc-300 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {TREND_PERIODS.map((p) => {
          const active = filters.periode === p.value;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setFilters({ periode: p.value })}
              className={`min-h-[34px] rounded px-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-700 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <select
        value={filters.platform}
        onChange={(e) => setFilters({ platform: e.target.value })}
        aria-label="Platform"
        className="min-h-[38px] rounded-md border border-zinc-300 bg-white px-2.5 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {TREND_PLATFORMS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
