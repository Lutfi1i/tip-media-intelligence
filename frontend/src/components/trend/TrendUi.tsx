"use client";

import { DependencyList, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { onDataSynced } from "@/lib/api";
import { fmtNum, fmtRelative } from "@/lib/format";
import { platformLabel, TrendFilters } from "@/lib/trendFilters";
import { Baseline, PostBrief } from "@/lib/trendApi";
import { ErrorPanel, Notice } from "@/components/ui";
import { useTrendFilters } from "./TrendFiltersContext";

/**
 * Muat data menu tren setiap kali filter global (atau `deps`) berubah dan setelah tarik data.
 * Data lama tetap tampil selama memuat ulang agar halaman tidak berkedip.
 */
export function useTrendData<T>(loader: (f: TrendFilters) => Promise<T>, deps: DependencyList = []) {
  const { filters, ready } = useTrendFilters();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current(filters);
      if (id === seq.current) setData(result);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Data gagal dimuat");
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, ...deps]);

  useEffect(() => {
    if (ready) reload();
  }, [ready, reload]);

  useEffect(() => onDataSynced(reload), [reload]);

  return { data, loading, error, reload };
}

/** Pembungkus status muat/galat sebelum data pertama tersedia. */
export function TrendState({
  loading,
  error,
  hasData,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (error && !hasData) return <ErrorPanel title="Data gagal dimuat" message={error} onRetry={onRetry} />;
  if (!hasData) {
    return (
      <div className="panel border border-zinc-200 p-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {loading ? "Memuat data..." : "Belum ada data."}
      </div>
    );
  }
  return (
    <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
      {error && <Notice tone="error" message={`Pembaruan gagal: ${error}`} onRetry={onRetry} />}
      {children}
    </div>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#09090B]">
      <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 truncate text-xl font-black text-zinc-900 dark:text-white" title={value}>
        {value}
      </div>
      {hint && <div className="mt-1 text-2xs text-zinc-500 dark:text-zinc-400">{hint}</div>}
    </div>
  );
}

export function Section({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#09090B]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  "LONJAKAN TINGGI": { text: "Melonjak", cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
  MENINGKAT: { text: "Naik", cls: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300" },
  BARU: { text: "Baru muncul", cls: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
  STABIL: { text: "Stabil", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  MENURUN: { text: "Turun", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  "SINYAL LEMAH": { text: "Sinyal lemah", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

export function StatusBadge({ status, growth }: { status: string; growth?: number | null }) {
  const s = STATUS_LABEL[status] || { text: status, cls: STATUS_LABEL.STABIL.cls };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-bold ${s.cls}`}>
      {s.text}
      {growth !== undefined && growth !== null && <span className="font-mono">{growth > 0 ? "+" : ""}{fmtNum(growth)}%</span>}
    </span>
  );
}

/** Angka metrik; null berarti platform tidak menyediakan data, bukan nol. */
export function Metric({ value, suffix = "" }: { value: number | null | undefined; suffix?: string }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-400 dark:text-zinc-600" title="Platform tidak menyediakan angka ini">tidak tersedia</span>;
  }
  return <span className="font-mono">{fmtNum(value)}{suffix}</span>;
}

export function BaselineNotice({ baseline }: { baseline?: Baseline | null }) {
  if (!baseline || baseline.tersedia >= baseline.target) return null;
  return (
    <Notice tone="info">
      Data pembanding baru {baseline.tersedia} dari {baseline.target} periode, jadi status naik/turun belum bisa
      diandalkan. Akurasinya membaik setelah pengumpulan berjalan beberapa hari lagi.
    </Notice>
  );
}

const SENTIMENT_COLOR: Record<string, string> = {
  positif: "bg-emerald-500",
  netral: "bg-zinc-400 dark:bg-zinc-500",
  campuran: "bg-amber-400",
  negatif: "bg-red-500",
};

export function SentimentBar({ pct }: { pct: Record<string, number> }) {
  const order = ["positif", "netral", "campuran", "negatif"].filter((k) => (pct[k] ?? 0) > 0);
  if (!order.length) return <p className="text-xs text-zinc-500">Belum ada data sentimen.</p>;
  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded" role="img" aria-label={order.map((k) => `${k} ${pct[k]}%`).join(", ")}>
        {order.map((k) => (
          <div key={k} className={SENTIMENT_COLOR[k]} style={{ width: `${pct[k]}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-zinc-600 dark:text-zinc-300">
        {order.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${SENTIMENT_COLOR[k]}`} aria-hidden="true" />
            <span className="capitalize">{k}</span> <span className="font-mono">{fmtNum(pct[k], 1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function PostItem({ p, extra }: { p: PostBrief; extra?: ReactNode }) {
  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {p.url ? (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-2 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {p.judul}
              <ExternalLink className="ml-1 inline h-3 w-3 text-zinc-400" aria-hidden="true" />
            </a>
          ) : (
            <span className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{p.judul}</span>
          )}
          <div className="mt-0.5 text-2xs text-zinc-500 dark:text-zinc-400">
            {platformLabel(p.platform)} &bull; {p.penulis || "akun tidak diketahui"} &bull; {fmtRelative(p.published_at)}
          </div>
        </div>
        {extra}
      </div>
    </li>
  );
}

export function topLabel(record: Record<string, number> | undefined): [string, number] | null {
  const entries = Object.entries(record || {}).sort((a, b) => b[1] - a[1]);
  return entries[0] || null;
}
