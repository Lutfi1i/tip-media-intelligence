"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Printer, Plus, RefreshCw, Calendar, CheckCircle2 } from "lucide-react";
import { fetchReports, generateNewReport } from "@/lib/api";

export default function LaporanPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchReports();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerate = async (jenis: "harian" | "mingguan") => {
    setGenerating(true);
    setGenSuccess(null);
    try {
      const periode = jenis === "harian" ? "11 November 2026" : "9-15 November 2026";
      const created = await generateNewReport(jenis, periode);
      setGenSuccess(`Laporan ${jenis.toUpperCase()} (${periode}) berhasil dibuat.`);
      await loadReports();
    } catch (err: any) {
      alert(err.message || "Gagal menghasilkan laporan");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Laporan Otomatis Untuk Briefing Pimpinan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            app.tipmedia.id/laporan &bull; Generasi laporan PDF berkala dan arsip dokumen intelijen media
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          <button
            onClick={() => handleGenerate("harian")}
            disabled={generating}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-md border border-slate-300 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 inline-flex items-center"
          >
            <Plus className="w-3.5 h-3.5 mr-1 text-slate-500" />
            + Buat Laporan Harian
          </button>
          <button
            onClick={() => handleGenerate("mingguan")}
            disabled={generating}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold shadow-sm transition-colors disabled:opacity-50 inline-flex items-center"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            + Buat Laporan Mingguan
          </button>
        </div>
      </div>

      {genSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-sm text-emerald-900 font-semibold flex items-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-2 flex-shrink-0" />
          {genSuccess}
        </div>
      )}

      {/* Main Grid: Mockup Slide 13 Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sample Report Card Preview (Slide 13) */}
        <div className="lg:col-span-1 bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="bg-slate-900 text-white p-4 rounded-lg mb-4">
              <span className="text-[11px] font-mono text-blue-300 uppercase tracking-wider block mb-1">
                Laporan Mingguan
              </span>
              <div className="text-lg font-bold">9&ndash;15 November 2026</div>
              <div className="text-xs text-slate-400 mt-1">Status: Siap Distribusi</div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ringkasan Eksekutif
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                  <div className="text-2xl font-extrabold text-blue-600">18</div>
                  <div className="text-xs text-slate-500 font-medium">isu prioritas</div>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                  <div className="text-2xl font-extrabold text-emerald-600">6</div>
                  <div className="text-xs text-slate-500 font-medium">kasus selesai</div>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Progres Tindak Lanjut
                </span>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full w-[60%]" title="Selesai: 60%" />
                  <div className="bg-blue-500 h-full w-[25%]" title="Ditangani: 25%" />
                  <div className="bg-amber-400 h-full w-[15%]" title="Menunggu: 15%" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <a
              href="http://127.0.0.1:8000/api/v1/reports/1/view"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Buka Format Cetak / PDF
            </a>
          </div>
        </div>

        {/* Right 2 Columns: Report Structure & List (Slide 13 Mockup) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Explanation Box from Slide 13 */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
              Isi Laporan
            </h2>

            <ul className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 mr-3 flex-shrink-0" />
                <div>
                  <strong className="text-slate-900">Ringkasan eksekutif dan isu prioritas:</strong>{" "}
                  Fokus perhatian pimpinan pada eskalasi paling mendesak dalam satu siklus waktu.
                </div>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 mr-3 flex-shrink-0" />
                <div>
                  <strong className="text-slate-900">Perkembangan isu per wilayah dan sentimen:</strong>{" "}
                  Sebaran geografis serta pergeseran sentimen publik pasca penanganan instansi.
                </div>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 mr-3 flex-shrink-0" />
                <div>
                  <strong className="text-slate-900">Sumber utama beserta tautan asli:</strong>{" "}
                  Bukti rujukan faktual yang dapat diaudit langsung tanpa asumsi sepihak.
                </div>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 mr-3 flex-shrink-0" />
                <div>
                  <strong className="text-slate-900">Rekomendasi dan status tindak lanjut:</strong>{" "}
                  Langkah mitigasi operasional berbasis PIC, tenggat (SLA), dan dokumentasi lapangan.
                </div>
              </li>
            </ul>

            <div className="mt-5 p-3 bg-blue-50/70 border border-blue-200 rounded text-xs text-blue-900 font-medium">
              Dikirim harian, mingguan, bulanan, atau insidental, sesuai hak akses penerima.
            </div>
          </div>

          {/* Archived Reports Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Daftar Dokumen Laporan Tersedia
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {reports.length} arsip
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">Memuat laporan...</div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">Belum ada arsip laporan.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">{rep.judul}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center space-x-2">
                        <span className="capitalize font-semibold text-blue-700">{rep.jenis}</span>
                        <span>&bull;</span>
                        <span>{rep.periode}</span>
                        <span>&bull;</span>
                        <span>{new Date(rep.created_at).toLocaleDateString("id-ID")}</span>
                      </div>
                    </div>

                    <a
                      href={`http://127.0.0.1:8000/api/v1/reports/${rep.id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      Cetak PDF
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
