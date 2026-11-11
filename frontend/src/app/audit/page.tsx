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
      <div>
        <p className="text-xs font-bold tracking-wider uppercase text-blue-700">
          Tata Kelola &amp; Kepatuhan
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
          Audit trail dan evaluasi akurasi AI
        </h1>
      </div>

      {/* AI Precision Evaluation Card (FR-24 & NFR-12) */}
      {evaluation && (
        <section className="bg-white rounded-xl border border-slate-200/90 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-5">
            <h2 className="text-base font-extrabold text-slate-900">
              Evaluasi Akurasi AI dari Koreksi Analis (FR-24)
            </h2>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              {evaluation.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="text-xs font-medium text-slate-500">
                Presisi Sentimen
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">
                {Math.round(evaluation.sentiment_precision * 100)}%
              </div>
              <div className="text-xs font-semibold text-emerald-800 mt-1.5">
                Target NFR-12: &ge;80%
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="text-xs font-medium text-slate-500">
                Presisi Topik
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">
                {Math.round(evaluation.topic_precision * 100)}%
              </div>
              <div className="text-xs font-semibold text-emerald-800 mt-1.5">
                Target NFR-12: &ge;80%
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="text-xs font-medium text-slate-500">
                Presisi Lokasi Kota
              </div>
              <div className="text-3xl font-extrabold text-slate-900 mt-1">
                {Math.round(evaluation.location_precision * 100)}%
              </div>
              <div className="text-xs font-semibold text-emerald-800 mt-1.5">
                Target NFR-12: &ge;75%
              </div>
            </div>

            <div className="bg-[#EFF6FF] p-4 rounded-xl border border-blue-200">
              <div className="text-xs font-medium text-[#1E3A8A]">
                Total Keputusan Analis
              </div>
              <div className="text-3xl font-extrabold text-[#1E3A8A] mt-1">
                {evaluation.total_reviews}
              </div>
              <div className="text-xs font-semibold text-blue-800 mt-1.5">
                Human-in-the-loop tercatat
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Append-Only Audit Log Table (FR-23) */}
      <section className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900">
            Log Audit Sistem (Append-Only)
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            {logs.length} aktivitas tercatat
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Memuat catatan audit...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Belum ada catatan aktivitas. Lakukan verifikasi isu atau perbarui
            kasus untuk melihat log audit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">Waktu</th>
                  <th className="py-3 px-5">Aktor &amp; Peran</th>
                  <th className="py-3 px-5">Aksi</th>
                  <th className="py-3 px-5">Objek</th>
                  <th className="py-3 px-5">Rincian &amp; IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-5 font-mono text-slate-600 whitespace-nowrap">
                      {new Date(log.waktu).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">
                        {log.aktor}
                      </div>
                      <div className="text-slate-500">{log.peran}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-mono font-bold text-[#1E40AF] bg-[#EFF6FF] px-2 py-0.5 rounded border border-blue-200">
                        {log.aksi}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono font-semibold text-slate-800">
                      {log.objek}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-slate-600">
                      <div>IP: {log.ip}</div>
                      <div className="text-slate-500">
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
