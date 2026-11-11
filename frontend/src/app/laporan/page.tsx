"use client";

import { useEffect, useState } from "react";
import {
  fetchReports,
  generateNewReport,
  getReportViewUrl,
} from "@/lib/api";

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
      const periode =
        jenis === "harian" ? "11 November 2026" : "9-15 November 2026";
      await generateNewReport(jenis, periode);
      setGenSuccess(
        `Laporan ${jenis.toUpperCase()} (${periode}) berhasil disusun dan siap dicetak.`
      );
      await loadReports();
    } catch (err: any) {
      alert(err.message || "Gagal menghasilkan laporan");
    } finally {
      setGenerating(false);
    }
  };

  const latestReportId = reports.length > 0 ? reports[0].id : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wider uppercase text-blue-700">
            Laporan
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Laporan PDF otomatis untuk briefing pimpinan
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleGenerate("harian")}
            disabled={generating}
            className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-lg border border-slate-300 text-xs font-bold transition-colors disabled:opacity-50"
          >
            + Buat Laporan Harian
          </button>
          <button
            type="button"
            onClick={() => handleGenerate("mingguan")}
            disabled={generating}
            className="min-h-[40px] px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            + Buat Laporan Mingguan
          </button>
        </div>
      </div>

      {genSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-sm text-emerald-900 font-semibold">
          {genSuccess}
        </div>
      )}

      {/* Main Split matching Slide 13 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Document Mockup Card matching Slide 13 */}
        <section className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="bg-[#0F172A] text-white p-5">
            <div className="text-sm font-extrabold">Laporan Mingguan</div>
            <div className="text-xs text-slate-300 mt-0.5">
              9&ndash;15 November 2026
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <div className="text-xs font-extrabold text-slate-900 mb-2">
                Ringkasan eksekutif
              </div>
              <div className="space-y-1.5" aria-hidden="true">
                <div className="h-2.5 bg-slate-200 rounded-full w-full" />
                <div className="h-2.5 bg-slate-200 rounded-full w-4/5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#EFF6FF] p-3.5 rounded-xl">
                <div className="text-2xl font-extrabold text-[#1E40AF]">18</div>
                <div className="text-xs text-slate-600 font-medium mt-0.5">
                  isu prioritas
                </div>
              </div>
              <div className="bg-[#FFEDD5] p-3.5 rounded-xl">
                <div className="text-2xl font-extrabold text-[#9A3412]">6</div>
                <div className="text-xs text-slate-600 font-medium mt-0.5">
                  kasus selesai
                </div>
              </div>
            </div>

            {/* Mini Bar Chart matching Slide 13 */}
            <div className="flex items-end gap-2 h-16 pt-2" aria-hidden="true">
              <div className="flex-1 bg-[#1E40AF] h-full rounded-t-xs" />
              <div className="flex-1 bg-[#3B82F6] h-[52%] rounded-t-xs" />
              <div className="flex-1 bg-[#93C5FD] h-[34%] rounded-t-xs" />
              <div className="flex-1 bg-[#93C5FD] h-[28%] rounded-t-xs" />
              <div className="flex-1 bg-[#DBEAFE] h-[18%] rounded-t-xs" />
              <div className="flex-1 bg-[#EFF6FF] h-[12%] rounded-t-xs" />
            </div>

            <div>
              <div className="text-xs font-extrabold text-slate-900 mb-2">
                Tindak lanjut
              </div>
              <div className="space-y-1.5" aria-hidden="true">
                <div className="h-2.5 bg-slate-200 rounded-full w-full" />
                <div className="h-2.5 bg-slate-200 rounded-full w-3/4" />
              </div>
            </div>

            <div className="pt-2">
              <a
                href={getReportViewUrl(latestReportId)}
                target="_blank"
                rel="noreferrer"
                className="w-full min-h-[42px] inline-flex items-center justify-center py-2.5 px-4 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Buka &amp; Cetak Dokumen PDF
              </a>
            </div>
          </div>
        </section>

        {/* Right 8 Cols: Report Contents & Archive List matching Slide 13 */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white rounded-xl border border-slate-200/90 p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Isi Laporan
            </h2>

            <ul className="divide-y divide-slate-200 text-base font-medium text-slate-900">
              <li className="py-3.5">
                Ringkasan eksekutif dan isu prioritas
              </li>
              <li className="py-3.5">
                Perkembangan isu per wilayah dan sentimen
              </li>
              <li className="py-3.5">
                Sumber utama beserta tautan asli
              </li>
              <li className="py-3.5">
                Rekomendasi dan status tindak lanjut
              </li>
            </ul>

            <div className="mt-5 p-4 bg-[#EFF6FF] rounded-lg text-sm font-medium text-[#1E3A8A]">
              Dikirim harian, mingguan, bulanan, atau insidental, sesuai hak
              akses penerima.
            </div>
          </section>

          {/* Archive Table */}
          <section className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Arsip Laporan Tersedia
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {reports.length} dokumen
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Memuat daftar arsip laporan...
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Belum ada arsip laporan. Klik tombol &ldquo;+ Buat Laporan
                Mingguan&rdquo; di atas.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        {rep.judul}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Jenis:{" "}
                        <strong className="capitalize text-slate-700">
                          {rep.jenis}
                        </strong>{" "}
                        &middot; Periode: {rep.periode} &middot; Dibuat:{" "}
                        {new Date(rep.created_at).toLocaleDateString("id-ID")}
                      </div>
                    </div>

                    <a
                      href={getReportViewUrl(rep.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="self-start sm:self-auto min-h-[38px] inline-flex items-center px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-xs font-bold transition-colors"
                    >
                      Lihat / Cetak PDF
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
