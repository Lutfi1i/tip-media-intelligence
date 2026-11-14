"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { fetchAuditLogs, fetchAiEvaluation } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { ErrorPanel } from "@/components/ui";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [query, setQuery] = useState("");
  const [aksiFilter, setAksiFilter] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsData, evalData] = await Promise.all([
        fetchAuditLogs(limit),
        fetchAiEvaluation(),
      ]);
      setLogs(logsData);
      setEvaluation(evalData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat audit trail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const aksiOptions = useMemo(() => Array.from(new Set(logs.map((l) => String(l.aksi)))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (aksiFilter && l.aksi !== aksiFilter) return false;
      if (!q) return true;
      return [l.aktor, l.peran, l.aksi, l.objek, l.ip, JSON.stringify(l.detail)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [logs, query, aksiFilter]);

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["waktu_wib", "aktor", "peran", "aksi", "objek", "ip", "detail"];
    const rows = filteredLogs.map((l) =>
      [fmtDateTime(l.waktu), l.aktor, l.peran, l.aksi, l.objek, l.ip, JSON.stringify(l.detail)].map(esc).join(",")
    );
    // BOM agar Excel membaca UTF-8 dengan benar.
    const blob = new Blob(["\ufeff" + [header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pct = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `${Math.round(v * 100)}%`);

  if (error) {
    return <ErrorPanel title="Audit trail gagal dimuat" message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            Tata kelola &bull; log tidak dapat diubah
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Audit &amp; Akurasi AI
          </h1>
        </div>
      </div>

      {/* AI Precision Evaluation Card (FR-24 & NFR-12) */}
      {evaluation && (
        <section className="panel p-6 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-5">
            <div>
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
                Akurasi AI menurut koreksi analis
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                Evaluasi presisi algoritma ekstraksi lokasi, topik, dan sentimen
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              {evaluation.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">
                Presisi Sentimen
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                {pct(evaluation.sentiment_precision)}
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                Target: &ge;80%
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">
                Presisi Topik
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                {pct(evaluation.topic_precision)}
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                Target: &ge;80%
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">
                Presisi Lokasi Kota
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                {pct(evaluation.location_precision)}
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                Target: &ge;75%
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-300 dark:border-zinc-700">
              <div className="text-xs text-zinc-800 dark:text-zinc-200 uppercase">
                Keputusan Analis
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                {evaluation.total_reviews}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                Human-in-the-loop tercatat
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Append-Only Audit Log Table (FR-23) */}
      <section className="panel overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
              Log aktivitas sistem
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              {filteredLogs.length} dari {logs.length} catatan terbaru
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari aktor, objek, IP, atau detail..."
              aria-label="Cari log"
              className="flex-1 min-w-[12rem] min-h-[36px] text-xs px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <select
              value={aksiFilter}
              onChange={(e) => setAksiFilter(e.target.value)}
              aria-label="Filter aksi"
              className="min-h-[36px] text-xs px-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-200"
            >
              <option value="">Semua aksi</option>
              {aksiOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="Jumlah catatan dimuat"
              className="min-h-[36px] text-xs px-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-200"
            >
              {[50, 200, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {n} terbaru
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredLogs.length === 0}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-md border border-zinc-300 dark:border-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Ekspor CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Memuat catatan log audit...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Belum ada catatan aktivitas di basis data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-mono border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-5">Waktu</th>
                  <th className="py-3 px-5">Aktor &amp; Peran</th>
                  <th className="py-3 px-5">Aksi</th>
                  <th className="py-3 px-5">Objek</th>
                  <th className="py-3 px-5">Rincian &amp; IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
                    <td className="py-3.5 px-5 text-zinc-500 whitespace-nowrap">
                      {fmtDateTime(log.waktu)}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {log.aktor}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {log.peran}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700 text-[11px]">
                        {log.aksi}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-zinc-800 dark:text-zinc-200">
                      {log.objek}
                    </td>
                    <td className="py-3.5 px-5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div>IP: {log.ip || "-"}</div>
                      {log.detail && Object.keys(log.detail).length > 0 && (
                        <dl className="mt-1 space-y-0.5 max-w-xs">
                          {Object.entries(log.detail as Record<string, unknown>).slice(0, 5).map(([k, v]) => (
                            <div key={k} className="flex gap-1">
                              <dt className="text-zinc-400 shrink-0">{k.replace(/_/g, " ")}:</dt>
                              <dd className="text-zinc-600 dark:text-zinc-300 truncate" title={typeof v === "object" ? JSON.stringify(v) : String(v)}>
                                {typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
