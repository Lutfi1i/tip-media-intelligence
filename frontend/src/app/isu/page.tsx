"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { fetchIssues, ISSUE_QUEUE_KEY, IssueItem, onDataSynced } from "@/lib/api";
import { fmtDateTime, fmtRelative, parseUtc } from "@/lib/format";
import { ThreatLevelPill } from "@/components/RadarUi";
import { EmptyState, ErrorPanel, IssueStatusBadge, Notice } from "@/components/ui";

type SortKey = "skor" | "terbaru" | "volume";

const SORT_LABEL: Record<SortKey, string> = {
  skor: "Skor risiko tertinggi",
  terbaru: "Pembaruan terbaru",
  volume: "Volume terbanyak",
};

const selectCls =
  "min-h-[40px] text-xs sm:text-sm border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer";

export default function IsuListPage() {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("skor");
  const [ready, setReady] = useState(false);

  // Pulihkan filter dari URL agar kembali dari halaman detail tidak mereset pilihan.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setLevelFilter(q.get("level") || "");
    setStatusFilter(q.get("status") || "");
    const text = q.get("q") || "";
    setSearchInput(text);
    setSearchQuery(text);
    const urut = q.get("urut");
    if (urut === "terbaru" || urut === "volume") setSortKey(urut);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams();
    if (levelFilter) q.set("level", levelFilter);
    if (statusFilter) q.set("status", statusFilter);
    if (searchQuery) q.set("q", searchQuery);
    if (sortKey !== "skor") q.set("urut", sortKey);
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [ready, levelFilter, statusFilter, searchQuery, sortKey]);

  // Cari sambil mengetik, dengan jeda agar tidak memanggil API tiap huruf.
  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const loadIssues = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      setRefreshError(null);
      try {
        const data = await fetchIssues({
          level: levelFilter || undefined,
          status: statusFilter || undefined,
          q: searchQuery || undefined,
        });
        setIssues(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal memuat antrean isu";
        if (silent) setRefreshError(msg);
        else setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [levelFilter, statusFilter, searchQuery]
  );

  useEffect(() => {
    if (ready) loadIssues();
  }, [ready, loadIssues]);

  useEffect(() => onDataSynced(() => loadIssues(true)), [loadIssues]);

  const sorted = useMemo(() => {
    const list = [...issues];
    if (sortKey === "terbaru") {
      list.sort(
        (a, b) =>
          (parseUtc(b.last_updated)?.getTime() ?? 0) - (parseUtc(a.last_updated)?.getTime() ?? 0)
      );
    } else if (sortKey === "volume") {
      list.sort((a, b) => b.current_volume - a.current_volume);
    } else {
      list.sort((a, b) => b.skor - a.skor);
    }
    return list;
  }, [issues, sortKey]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(ISSUE_QUEUE_KEY, JSON.stringify(sorted.map((i) => i.id)));
    } catch {
      // sessionStorage bisa diblokir; tombol "isu berikutnya" saja yang tidak muncul.
    }
  }, [sorted]);

  const hasFilter = !!(levelFilter || statusFilter || searchQuery);
  const resetFilters = () => {
    setLevelFilter("");
    setStatusFilter("");
    setSearchInput("");
    setSearchQuery("");
  };

  const pendingCount = issues.filter((i) => i.status === "otomatis").length;

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Antrean Isu &amp; Peringatan Dini
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Tinjau isu yang terdeteksi otomatis, lalu verifikasi, koreksi, atau tolak.
          </p>
        </div>
        {!loading && !error && (
          <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {issues.length} isu
            {pendingCount > 0 && (
              <>
                {" "}
                &bull;{" "}
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {pendingCount} belum ditinjau
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter & pencarian */}
      <div className="panel p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Cari isu"
            placeholder="Cari judul, ringkasan, atau kata kunci..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full min-h-[40px] text-xs sm:text-sm pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className={selectCls}
            aria-label="Filter level risiko"
          >
            <option value="">Semua level</option>
            <option value="CRITICAL">CRITICAL (85-100)</option>
            <option value="HIGH">HIGH (70-84)</option>
            <option value="MEDIUM">MEDIUM (40-69)</option>
            <option value="LOW">LOW (0-39)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectCls}
            aria-label="Filter status verifikasi"
          >
            <option value="">Semua status</option>
            <option value="otomatis">Belum ditinjau</option>
            <option value="terverifikasi">Terverifikasi</option>
            <option value="dikoreksi">Dikoreksi</option>
            <option value="ditolak">Ditolak</option>
            <option value="selesai">Selesai</option>
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={selectCls}
            aria-label="Urutkan isu"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>

          {hasFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-[40px] inline-flex items-center gap-1 px-3 text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Reset
            </button>
          )}
        </div>
      </div>

      {refreshError && (
        <Notice
          tone="error"
          message={`Pembaruan gagal: ${refreshError}`}
          onRetry={() => loadIssues()}
          onClose={() => setRefreshError(null)}
        />
      )}

      {error ? (
        <ErrorPanel title="Antrean isu gagal dimuat" message={error} onRetry={() => loadIssues()} />
      ) : (
        <div className="panel overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              <div className="inline-block w-6 h-6 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin mb-2" />
              <p>Memuat antrean isu...</p>
            </div>
          ) : sorted.length === 0 ? (
            hasFilter ? (
              <EmptyState
                title="Tidak ada isu yang cocok dengan filter."
                description="Coba kata kunci lain atau reset filter."
                action={
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Reset filter
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="Belum ada isu terdeteksi."
                description={'Klik "Tarik Berita Nyata" di header untuk mengambil berita terbaru.'}
              />
            )
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sorted.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={`/isu/${issue.id}`}
                    className="block p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ThreatLevelPill level={issue.level} score={issue.skor} />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                          {issue.wilayah} &bull; {issue.kategori}
                        </span>
                      </div>
                      <IssueStatusBadge status={issue.status} />
                    </div>

                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:underline mt-2 leading-snug">
                      {issue.judul}
                    </h2>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {issue.ringkasan}
                    </p>

                    <div className="mt-3.5 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                      <span>
                        <strong className="text-zinc-800 dark:text-zinc-200">{issue.kode_referensi}</strong>
                        {" "}&bull; {issue.current_volume} laporan &bull;{" "}
                        <span title={`Pertama terdeteksi ${fmtDateTime(issue.first_seen)}`}>
                          diperbarui {fmtRelative(issue.last_updated)}
                        </span>
                      </span>
                      <span className="font-bold text-zinc-900 dark:text-white group-hover:underline">
                        {issue.status === "otomatis" ? "Tinjau" : "Buka"} &rarr;
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
