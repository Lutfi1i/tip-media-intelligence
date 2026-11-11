"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, History, Award, AlertCircle, RefreshCw } from "lucide-react";
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Audit Trail &amp; Evaluasi Akurasi AI
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            app.tipmedia.id/audit &bull; Rekam jejak seluruh keputusan manusia dan metrik presisi model
          </p>
        </div>
      </div>

      {/* AI Evaluation Metrics (FR-24 & NFR-12) */}
      {evaluation && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Evaluasi Akurasi AI dari Koreksi Analis (FR-24 &amp; NFR-12)
              </h2>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-800 font-semibold px-2.5 py-1 rounded border border-emerald-200">
              {evaluation.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Presisi Sentimen</span>
              <span className="text-2xl font-extrabold text-slate-900">
                {Math.round(evaluation.sentiment_precision * 100)}%
              </span>
              <span className="text-[11px] text-emerald-700 block mt-1 font-semibold">
                &ge; Target 80% (NFR-12)
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Presisi Topik</span>
              <span className="text-2xl font-extrabold text-slate-900">
                {Math.round(evaluation.topic_precision * 100)}%
              </span>
              <span className="text-[11px] text-emerald-700 block mt-1 font-semibold">
                Taksonomi Terkalibrasi
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Presisi Lokasi (Gazetteer)</span>
              <span className="text-2xl font-extrabold text-slate-900">
                {Math.round(evaluation.location_precision * 100)}%
              </span>
              <span className="text-[11px] text-emerald-700 block mt-1 font-semibold">
                &ge; Target 75% Kota (NFR-12)
              </span>
            </div>

            <div className="bg-blue-50/60 p-4 rounded-lg border border-blue-200">
              <span className="text-xs text-blue-900 font-medium block">Sampel Ulasan Analis</span>
              <span className="text-2xl font-extrabold text-blue-900">
                {evaluation.total_reviews} Sesi
              </span>
              <span className="text-[11px] text-blue-700 block mt-1 font-semibold">
                Human-in-the-Loop Aktif
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Immutable Audit Log Table (FR-23) */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Rekam Jejak Audit Sistem (Append-Only Log)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {logs.length} entri tercatat
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Memuat rekam audit...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">Belum ada aktivitas tercatat.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Waktu</th>
                  <th className="py-2.5 px-4">Aktor &amp; Peran</th>
                  <th className="py-2.5 px-4">Aksi</th>
                  <th className="py-2.5 px-4">Objek</th>
                  <th className="py-2.5 px-4">IP &amp; Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.waktu).toLocaleString("id-ID")}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{log.aktor}</div>
                      <div className="text-[11px] text-slate-500">{log.peran}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {log.aksi}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-800">
                      {log.objek}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                      <div>IP: {log.ip}</div>
                      <div className="text-slate-500">{JSON.stringify(log.detail)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
