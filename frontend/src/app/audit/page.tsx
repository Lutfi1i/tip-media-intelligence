"use client";

import { useEffect, useState } from "react";
import { fetchAuditLogs, fetchAiEvaluation } from "@/lib/api";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, evalData] = await Promise.all([
        fetchAuditLogs(),
        fetchAiEvaluation(),
      ]);
      setLogs(logsData);
      setEvaluation(evalData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            GOVERNANCE &bull; APPEND-ONLY AUDIT TRAIL
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Audit Trail &amp; Evaluasi Akurasi AI
          </h1>
        </div>
        <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
          Kepatuhan: NFR-12 &amp; FR-24
        </div>
      </div>

      {/* AI Precision Evaluation Card (FR-24 & NFR-12) */}
      {evaluation && (
        <section className="panel p-6 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-5">
            <div>
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
                EVALUASI AKURASI AI DARI KOREKSI ANALIS (FR-24)
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
                {Math.round(evaluation.sentiment_precision * 100)}%
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
                {Math.round(evaluation.topic_precision * 100)}%
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
                {Math.round(evaluation.location_precision * 100)}%
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
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
            LOG AKTIVITAS SISTEM (APPEND-ONLY)
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            {logs.length} catatan
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Memuat catatan log audit...
          </div>
        ) : logs.length === 0 ? (
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
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
                    <td className="py-3.5 px-5 text-zinc-500 whitespace-nowrap">
                      {new Date(log.waktu).toLocaleString("id-ID")}
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
                      <div>IP: {log.ip}</div>
                      <div className="text-zinc-400 truncate max-w-xs">
                        {JSON.stringify(log.detail)}
                      </div>
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
