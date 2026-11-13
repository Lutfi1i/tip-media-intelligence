"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardAiInsightData, fetchDashboardAiInsight } from "@/lib/api";
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Info, CheckCircle2 } from "lucide-react";

/** Render teks dengan penekanan **bold** menjadi elemen <strong> dengan sorotan ringan pada angka/isu. */
function renderBoldSegments(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const inner = part.slice(2, -2);
      return (
        <strong
          key={idx}
          className="font-black text-zinc-950 dark:text-white bg-sky-500/10 dark:bg-sky-400/15 px-1 py-0.5 rounded"
        >
          {inner}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

const SEVERITY_STYLES: Record<
  string,
  { border: string; badge: string; icon: typeof Info }
> = {
  critical: {
    border: "border-rose-200 dark:border-rose-900/70 bg-rose-50/50 dark:bg-rose-950/25",
    badge: "text-rose-700 dark:text-rose-300",
    icon: AlertTriangle,
  },
  warning: {
    border: "border-amber-200 dark:border-amber-900/70 bg-amber-50/50 dark:bg-amber-950/25",
    badge: "text-amber-700 dark:text-amber-300",
    icon: TrendingUp,
  },
  positive: {
    border: "border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/25",
    badge: "text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  info: {
    border: "border-sky-200 dark:border-sky-900/70 bg-sky-50/50 dark:bg-sky-950/25",
    badge: "text-sky-700 dark:text-sky-300",
    icon: Info,
  },
};

export function DashboardAiInsight() {
  const [insight, setInsight] = useState<DashboardAiInsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsight = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardAiInsight(forceRefresh);
      setInsight(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat wawasan ringkasan AI.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInsight(false);
  }, [loadInsight]);

  if (loading && !insight) {
    return (
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 dark:text-zinc-300">
          <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span>Menyusun wawasan ringkasan AI dari angka isu terkini...</span>
        </div>
      </section>
    );
  }

  if (error && !insight) {
    return (
      <section className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 p-4 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{error}</span>
        <button
          type="button"
          onClick={() => loadInsight(true)}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-bold"
        >
          Coba Lagi
        </button>
      </section>
    );
  }

  if (!insight) return null;

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-500/25 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Wawasan Ringkasan AI</span>
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
            {insight.ai_engine_used}
          </span>
        </div>

        <button
          type="button"
          onClick={() => loadInsight(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Menganalisis..." : "Analisis Ulang"}</span>
        </button>
      </div>

      {/* Headline */}
      <p className="text-sm sm:text-base text-zinc-800 dark:text-zinc-100 leading-relaxed">
        {renderBoldSegments(insight.headline)}
      </p>

      {/* Key Metric Highlights */}
      {insight.highlights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insight.highlights.map((item, idx) => {
            const st = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.info;
            const Icon = st.icon;
            return (
              <div
                key={idx}
                className={`rounded-xl border p-3.5 space-y-1.5 ${st.border}`}
              >
                <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${st.badge}`}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                  {renderBoldSegments(item.text)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tactical Recommendation */}
      {insight.rekomendasi && (
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-200">
          <span className="font-bold text-zinc-900 dark:text-white mr-1.5">Arahan Prioritas:</span>
          {renderBoldSegments(insight.rekomendasi)}
        </div>
      )}
    </section>
  );
}
