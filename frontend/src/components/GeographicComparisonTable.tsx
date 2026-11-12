"use client";

import React, { useEffect, useState } from "react";
import { fetchGeoComparison, GeoComparisonItem } from "@/lib/api";

interface GeographicComparisonTableProps {
  timeRange: string;
}

export function GeographicComparisonTable({ timeRange }: GeographicComparisonTableProps) {
  const [comparisonData, setComparisonData] = useState<GeoComparisonItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCodes, setSelectedCodes] = useState<string>("32.01.01,32.01.02,32.01.03");

  const loadComparison = (codes: string, tr: string) => {
    setIsLoading(true);
    fetchGeoComparison(codes, tr)
      .then((res) => setComparisonData(res))
      .catch((e) => console.error("Gagal memuat perbandingan wilayah:", e))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadComparison(selectedCodes, timeRange);
  }, [selectedCodes, timeRange]);

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-3xs font-bold text-indigo-600 dark:text-indigo-400">
              FR-GEO-06 &bull; GEOGRAPHIC COMPARISON
            </span>
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            Matriks Perbandingan Tren Antar-Wilayah Lokal
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Perbandingan data aktual percakapan publik antar kecamatan di Kabupaten Bogor (Cibinong vs Bojonggede vs Citeureup).
          </p>
        </div>

        {/* Preset quick switcher */}
        <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800 text-2xs font-semibold">
          <button
            onClick={() => setSelectedCodes("32.01.01,32.01.02,32.01.03")}
            className={`rounded-md px-2.5 py-1 transition-all ${
              selectedCodes === "32.01.01,32.01.02,32.01.03"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Bogor Utara (Cibinong - Bojong - Citeureup)
          </button>
          <button
            onClick={() => setSelectedCodes("32.01.01,32.76,32.71")}
            className={`rounded-md px-2.5 py-1 transition-all ${
              selectedCodes === "32.01.01,32.76,32.71"
                ? "bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Koridor Selatan (Cibinong - Depok - Bogor Kota)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-2xs font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Indikator Pemantauan</th>
              {comparisonData.map((item) => (
                <th key={item.scope_kode} className="px-4 py-3 text-right">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 block text-xs">{item.region_name}</span>
                  <span className="font-mono text-3xs font-normal text-zinc-400">Kode: {item.scope_kode}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  Memuat data perbandingan wilayah aktual...
                </td>
              </tr>
            ) : (
              <>
                <tr>
                  <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Total Mentions (Percakapan Terdata)
                  </td>
                  {comparisonData.map((c) => (
                    <td key={c.scope_kode} className="px-4 py-3 text-right font-extrabold text-zinc-900 dark:text-white">
                      {c.total_mentions} mentions
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Laju Pertumbuhan (Growth %)
                  </td>
                  {comparisonData.map((c) => (
                    <td
                      key={c.scope_kode}
                      className={`px-4 py-3 text-right font-bold ${
                        c.growth_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      {c.growth_pct >= 0 ? "+" : ""}{c.growth_pct}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Sentimen Negatif (Keluhan Publik)
                  </td>
                  {comparisonData.map((c) => (
                    <td key={c.scope_kode} className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">
                      {c.negative_sentiment_pct}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Topik Tren Teratas
                  </td>
                  {comparisonData.map((c) => (
                    <td key={c.scope_kode} className="px-4 py-3 text-right font-medium text-zinc-800 dark:text-zinc-200 max-w-[200px] truncate" title={c.top_topic}>
                      {c.top_topic}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">
                    Lonjakan Isu Baru (Emerging)
                  </td>
                  {comparisonData.map((c) => (
                    <td key={c.scope_kode} className="px-4 py-3 text-right">
                      <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 font-bold text-amber-700 dark:text-amber-300 text-3xs">
                        {c.emerging_trends_count} Isu Baru
                      </span>
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
