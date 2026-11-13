"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchLiveSocialFeed,
  LiveFetchSummary,
  LiveSocialFeedResult,
  SocialFacets,
  SocialSearchParams,
} from "@/lib/api";
import { RealBrandIcon } from "@/components/SourceLogos";
import { formatCompact, formatWib } from "@/components/SocialCharts";
import { parseUtc } from "@/lib/format";
import { Pause, Play, RefreshCw, Search, Radio, ExternalLink, MapPin, Filter } from "lucide-react";

const PLATFORMS = ["Semua", "X (Twitter)", "TikTok", "Instagram", "Threads", "YouTube", "Bluesky", "Reddit"];
const SENTIMENTS = [
  { id: "", label: "Semua Sentimen" },
  { id: "negatif", label: "Negatif" },
  { id: "netral", label: "Netral" },
  { id: "positif", label: "Positif" },
  { id: "campuran", label: "Campuran" },
];
const EMOTIONS: [string, string][] = [
  ["", "Semua Emosi"],
  ["marah", "Marah"],
  ["takut", "Takut"],
  ["sedih", "Sedih"],
  ["kecewa", "Kecewa"],
  ["senang", "Senang"],
  ["terkejut", "Terkejut"],
];
const INTERVAL_OPTIONS = [10, 15, 30, 60];

const SENTIMENT_STYLE: Record<string, string> = {
  negatif: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  positif: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  campuran: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  netral: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

function relativeTimeId(iso: string): string {
  const ts = parseUtc(iso)?.getTime() ?? Date.now();
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec} dtk lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  return `${Math.floor(diffHr / 24)} hr lalu`;
}

export function LiveSocialFeed({
  timeRange,
  scopeKode,
  scopeName,
  scopeMode,
  selectedPlatform,
  onSelectPlatform,
  facets,
  onNewPostsCount,
}: {
  timeRange: string;
  scopeKode: string;
  scopeName: string;
  scopeMode: "context" | "strict" | "regional";
  selectedPlatform: string;
  onSelectPlatform: (p: string) => void;
  facets: SocialFacets | null;
  onNewPostsCount?: (count: number) => void;
}) {
  const [isLive, setIsLive] = useState(true);
  const [intervalSec, setIntervalSec] = useState(15);
  const [countdown, setCountdown] = useState(15);

  const [queryInput, setQueryInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [agency, setAgency] = useState("");
  const [emotion, setEmotion] = useState("");
  const [sentimen, setSentimen] = useState("");
  const [sort, setSort] = useState<"terbaru" | "terlama" | "jangkauan">("terbaru");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<LiveSocialFeedResult | null>(null);
  const [lastLiveSummary, setLastLiveSummary] = useState<LiveFetchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingNow, setFetchingNow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef(false);

  const loadFeed = useCallback(
    async (opts: { fetchLive: boolean; forceFetch: boolean; silent?: boolean }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!opts.silent) setLoading(true);
      setFetchingNow(true);
      setError(null);
      try {
        const params: SocialSearchParams & { time_range: string; scope_kode: string; scope_mode: string } = {
          q: appliedQuery,
          platform: selectedPlatform === "Semua" ? "" : selectedPlatform,
          category,
          agency,
          emotion,
          sentimen,
          author: "",
          sort,
          time_range: timeRange,
          scope_kode: scopeKode,
          scope_mode: scopeMode,
        };
        const res = await fetchLiveSocialFeed(params, {
          fetchLive: opts.fetchLive,
          forceFetch: opts.forceFetch,
          page,
          pageSize: 30,
        });
        setData(res);
        if (res.live_fetch) {
          setLastLiveSummary(res.live_fetch);
          if (res.live_fetch.baru > 0 && onNewPostsCount) {
            onNewPostsCount(res.live_fetch.baru);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat stream medsos langsung.");
      } finally {
        setLoading(false);
        setFetchingNow(false);
        inFlightRef.current = false;
      }
    },
    [appliedQuery, selectedPlatform, category, agency, emotion, sentimen, sort, timeRange, scopeKode, scopeMode, page, onNewPostsCount]
  );

  // Initial & filter-change load (triggers live fetch for the focused location)
  useEffect(() => {
    setCountdown(intervalSec);
    loadFeed({ fetchLive: true, forceFetch: false, silent: false });
  }, [loadFeed, intervalSec]);

  // Server-Sent Events (SSE) push stream for real-time licensed posts (FR-25)
  useEffect(() => {
    if (!isLive || typeof window === "undefined" || typeof EventSource === "undefined") return;
    const es = new EventSource("/api/v1/social-pulse/stream");
    es.addEventListener("post", () => {
      loadFeed({ fetchLive: false, forceFetch: false, silent: true });
    });
    return () => es.close();
  }, [isLive, loadFeed]);

  // Sub-minute auto-fetch countdown timer
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadFeed({ fetchLive: true, forceFetch: false, silent: true });
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive, intervalSec, loadFeed]);

  const handleManualFetch = () => {
    setCountdown(intervalSec);
    loadFeed({ fetchLive: true, forceFetch: true, silent: true });
  };

  const resetFilters = () => {
    setQueryInput("");
    setAppliedQuery("");
    onSelectPlatform("Semua");
    setCategory("");
    setAgency("");
    setEmotion("");
    setSentimen("");
    setSort("terbaru");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Live Control Header */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-fuchsia-600/15 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-500/30">
                <Radio className="w-3.5 h-3.5" />
                <span>LIVE MEDSOS LOKASI</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{scopeName}</span>
                <span className="text-zinc-500 dark:text-zinc-400">({scopeMode})</span>
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              Menarik postingan warga langsung dari X, TikTok, Instagram, Threads, Bluesky, dan Reddit untuk lokasi fokus ini.
            </p>
          </div>

          {/* Interval & Play/Pause Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsLive((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                isLive
                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isLive ? `Live (${countdown} dtk)` : "Dijeda"}</span>
            </button>

            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <span>Interval:</span>
              <select
                value={intervalSec}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setIntervalSec(val);
                  setCountdown(val);
                }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {INTERVAL_OPTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec} detik
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleManualFetch}
              disabled={fetchingNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchingNow ? "animate-spin" : ""}`} />
              <span>{fetchingNow ? "Menarik..." : "Ambil Langsung"}</span>
            </button>
          </div>
        </div>

        {/* Live Fetch Status Bar */}
        {lastLiveSummary && (
          <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-900 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                Query lokasi: &ldquo;{lastLiveSummary.location_query}&rdquo;
              </span>
              <span>&bull;</span>
              <span>Dibaca: {lastLiveSummary.dibaca}</span>
              <span>&bull;</span>
              <span className={lastLiveSummary.baru > 0 ? "font-bold text-emerald-700 dark:text-emerald-400" : ""}>
                Baru: +{lastLiveSummary.baru}
              </span>
              <span>&bull;</span>
              <span>Platform: {lastLiveSummary.platforms.join(", ")}</span>
            </div>
            <span>Diperbarui {formatWib(lastLiveSummary.fetched_at)}</span>
          </div>
        )}
      </div>

      {/* Platform Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Platform:</span>
        </span>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onSelectPlatform(p);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              selectedPlatform === p
                ? "bg-fuchsia-600 text-white"
                : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Detailed Filters Row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setAppliedQuery(queryInput);
        }}
        className="grid gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="relative sm:col-span-2">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Filter kata kunci (mis. macet, banjir, antre)..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <select
          value={sentimen}
          onChange={(e) => {
            setSentimen(e.target.value);
            setPage(1);
          }}
          aria-label="Filter sentimen"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
        >
          {SENTIMENTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filter kategori"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
        >
          <option value="">Semua Kategori</option>
          {facets?.categories
            .filter((c) => c.id !== "lainnya")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
        </select>

        <select
          value={emotion}
          onChange={(e) => {
            setEmotion(e.target.value);
            setPage(1);
          }}
          aria-label="Filter emosi"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
        >
          {EMOTIONS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as "terbaru" | "terlama" | "jangkauan");
              setPage(1);
            }}
            aria-label="Urutkan"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
          >
            <option value="terbaru">Terbaru</option>
            <option value="jangkauan">Jangkauan tertinggi</option>
            <option value="terlama">Terlama</option>
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-xs font-bold hover:bg-fuchsia-700"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Results Header */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <span>
            Menampilkan <strong className="text-zinc-900 dark:text-white">{data.items.length}</strong> dari{" "}
            <strong className="text-zinc-900 dark:text-white">{data.total.toLocaleString("id-ID")}</strong> postingan medsos di{" "}
            <strong className="text-zinc-900 dark:text-white">{scopeName}</strong> ({data.period.label})
          </span>
          {(appliedQuery || selectedPlatform !== "Semua" || category || agency || emotion || sentimen) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Menarik postingan media sosial terbaru untuk {scopeName}...
        </div>
      )}

      {/* Empty State */}
      {!loading && data && data.items.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 text-center space-y-2">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Belum ada postingan media sosial yang cocok untuk filter ini.
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Coba perlebar rentang waktu ke 24h atau 7d, ubah mode cakupan dari Strict ke Context, atau klik Ambil Langsung.
          </p>
        </div>
      )}

      {/* Live Social Posts Stream */}
      {data && data.items.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <RealBrandIcon name={item.platform} className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {item.platform}
                  </span>
                  {item.penulis && (
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate">
                      {item.penulis}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300 shrink-0">
                  {relativeTimeId(item.published_at)}
                </span>
              </div>

              <div>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:underline inline-flex items-start gap-1.5 leading-snug"
                  >
                    <span>{item.judul}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" />
                  </a>
                ) : (
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">{item.judul}</h4>
                )}
                {item.isi && item.isi !== item.judul && (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3 leading-relaxed">
                    {item.isi}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${
                    SENTIMENT_STYLE[item.sentimen] || SENTIMENT_STYLE.netral
                  }`}
                >
                  {item.sentimen}
                </span>
                {item.geo_context && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                    {item.geo_context}
                  </span>
                )}
                {item.kategori.slice(0, 2).map((k) => (
                  <span
                    key={k}
                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                  >
                    {k}
                  </span>
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
                <span>{formatWib(item.published_at)}</span>
                <div className="flex items-center gap-3 font-mono">
                  {item.engagement.views !== null && <span>{formatCompact(item.engagement.views)} tayangan</span>}
                  {item.engagement.likes !== null && <span>{formatCompact(item.engagement.likes)} suka</span>}
                  {item.engagement.replies !== null && <span>{formatCompact(item.engagement.replies)} balas</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-zinc-600 dark:text-zinc-300">
          <span>
            Halaman {data.page} dari {data.pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
