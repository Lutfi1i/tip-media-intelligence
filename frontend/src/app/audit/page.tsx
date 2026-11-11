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
      <div className="pb-2 border-b border-[#1E2A4A]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-sky-400">
            GOVERNANCE &bull; APPEND-ONLY AUDIT TRAIL
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
            Audit Trail &amp; Evaluasi Akurasi AI
          </h1>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Kepatuhan: NFR-12 &amp; FR-24
        </div>
      </div>

      {/* AI Precision Evaluation Card (FR-24 & NFR-12) */}
      {evaluation && (
        <section className="panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#1E2A4A] mb-5">
            <div>
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                EVALUASI AKURASI AI DARI KOREKSI ANALIS (FR-24)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluasi presisi algoritma ekstraksi lokasi, topik, dan sentimen
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {evaluation.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#16203C] p-4 rounded-xl border border-[#1E2A4A]">
              <div className="text-xs font-mono text-slate-400 uppercase">
                Presisi Sentimen
              </div>
              <div className="text-3xl font-black font-mono text-white mt-1">
                {Math.round(evaluation.sentiment_precision * 100)}%
              </div>
              <div className="text-[11px] font-mono font-semibold text-emerald-400 mt-1.5">
                Target: &ge;80%
              </div>
            </div>

            <div className="bg-[#16203C] p-4 rounded-xl border border-[#1E2A4A]">
              <div className="text-xs font-mono text-slate-400 uppercase">
                Presisi Topik
              </div>
              <div className="text-3xl font-black font-mono text-white mt-1">
                {Math.round(evaluation.topic_precision * 100)}%
              </div>
              <div className="text-[11px] font-mono font-semibold text-emerald-400 mt-1.5">
                Target: &ge;80%
              </div>
            </div>

            <div className="bg-[#16203C] p-4 rounded-xl border border-[#1E2A4A]">
              <div className="text-xs font-mono text-slate-400 uppercase">
                Presisi Lokasi Kota
              </div>
              <div className="text-3xl font-black font-mono text-white mt-1">
                {Math.round(evaluation.location_precision * 100)}%
              </div>
              <div className="text-[11px] font-mono font-semibold text-emerald-400 mt-1.5">
                Target: &ge;75%
              </div>
            </div>

            <div className="bg-[#16203C] p-4 rounded-xl border border-sky-500/30">
              <div className="text-xs font-mono text-sky-400 uppercase">
                Keputusan Analis
              </div>
              <div className="text-3xl font-black font-mono text-sky-400 mt-1">
                {evaluation.total_reviews}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1.5">
                Human-in-the-loop tercatat
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Append-Only Audit Log Table (FR-23) */}
      <section className="panel overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E2A4A] flex items-center justify-between">
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
            LOG AKTIVITAS SISTEM (APPEND-ONLY)
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {logs.length} catatan
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400 font-mono">
            Memuat catatan log audit...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            Belum ada catatan aktivitas di basis data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0C1226] text-slate-400 font-mono border-b border-[#1E2A4A]">
                <tr>
                  <th className="py-3 px-5">Waktu</th>
                  <th className="py-3 px-5">Aktor &amp; Peran</th>
                  <th className="py-3 px-5">Aksi</th>
                  <th className="py-3 px-5">Objek</th>
                  <th className="py-3 px-5">Rincian &amp; IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2A4A] text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#16203C] transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.waktu).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-200">
                        {log.aktor}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {log.peran}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono font-bold text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 text-[11px]">
                        {log.aksi}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-300">
                      {log.objek}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-400">
                      <div>IP: {log.ip}</div>
                      <div className="text-slate-500 truncate max-w-xs">
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
