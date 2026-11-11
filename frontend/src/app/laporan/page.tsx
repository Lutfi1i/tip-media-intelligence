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
      const today = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const periode = jenis === "harian" ? today : "Periode 7 Hari Terakhir";
      await generateNewReport(jenis, periode);
      setGenSuccess(
        `Laporan ${jenis.toUpperCase()} (${periode}) berhasil disusun dari data terkini.`
      );
      await loadReports();
    } catch (err: any) {
      alert(err.message || "Gagal menghasilkan laporan");
    } finally {
      setGenerating(false);
    }
  };

  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            EXECUTIVE INTELLIGENCE &bull; BRIEFING PACK
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Laporan &amp; Dokumen Eksekutif
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono">
          <button
            type="button"
            onClick={() => handleGenerate("harian")}
            disabled={generating}
            className="min-h-[38px] px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md border border-zinc-300 dark:border-zinc-800 text-xs font-bold transition-colors disabled:opacity-50"
          >
            + Susun Laporan Harian
          </button>
          <button
            type="button"
            onClick={() => handleGenerate("mingguan")}
            disabled={generating}
            className="min-h-[38px] px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-md text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
          >
            + Susun Laporan Mingguan
          </button>
        </div>
      </div>

      {genSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-700 dark:text-emerald-300 font-mono font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {genSuccess}
        </div>
      )}

      {/* Main Split: Executive Artifact & Archive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Document Card Preview */}
        <section className="lg:col-span-4 panel overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white p-5 border-b border-zinc-200 dark:border-zinc-800 font-mono">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              PRATINJAU DOKUMEN BRIEFING
            </div>
            <div className="text-base font-extrabold mt-1">
              {latestReport ? latestReport.judul : "Laporan Eksekutif"}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {latestReport ? latestReport.periode : "Terkini"}
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2 font-mono">
                Ringkasan Eksekutif
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-mono">
                Dokumen resmi merangkum pemantauan media, sebaran wilayah Kemendagri,
                kluster risiko tertinggi, dan audit tindak lanjut unit respon.
              </p>
            </div>

            {latestReport?.data_snapshot?.kpi && (
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xl font-black text-zinc-900 dark:text-white">
                    {latestReport.data_snapshot.kpi.mention_unik ?? 0}
                  </div>
                  <div className="text-[10px] text-zinc-400 uppercase mt-0.5">
                    Mention Unik
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xl font-black text-zinc-900 dark:text-white">
                    {latestReport.data_snapshot.kpi.isu_prioritas ?? 0}
                  </div>
                  <div className="text-[10px] text-zinc-400 uppercase mt-0.5">
                    Isu Prioritas
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 font-mono">
              {latestReport ? (
                <a
                  href={getReportViewUrl(latestReport.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full min-h-[40px] inline-flex items-center justify-center py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-md transition-colors shadow-xs"
                >
                  Buka &amp; Cetak Dokumen Lengkap &nearr;
                </a>
              ) : (
                <button
                  disabled
                  className="w-full min-h-[40px] inline-flex items-center justify-center py-2.5 px-4 bg-zinc-200 dark:bg-zinc-800 text-zinc-400 text-xs font-bold rounded-md cursor-not-allowed"
                >
                  Belum Ada Laporan
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right 8 Cols: Report Contents & Archive List */}
        <div className="lg:col-span-8 space-y-6">
          <section className="panel p-6 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 font-mono">
              STRUKTUR ISI LAPORAN STANDAR EKSEKUTIF
            </h2>

            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 font-mono">
              <li className="py-3 flex items-center gap-2">
                <span className="text-zinc-900 dark:text-white font-bold">&bull;</span>
                Ringkasan situasi dan indikator utama media &amp; risiko bencana
              </li>
              <li className="py-3 flex items-center gap-2">
                <span className="text-zinc-900 dark:text-white font-bold">&bull;</span>
                Sebaran per wilayah Kemendagri beserta sentimen publik
              </li>
              <li className="py-3 flex items-center gap-2">
                <span className="text-zinc-900 dark:text-white font-bold">&bull;</span>
                Kutipan artikel bukti dari feed berita terverifikasi (Antara, Detik, CNN, BMKG, Dishub)
              </li>
              <li className="py-3 flex items-center gap-2">
                <span className="text-zinc-900 dark:text-white font-bold">&bull;</span>
                Rekomendasi tindakan teknis dan SLA tindak lanjut unit lapangan
              </li>
            </ul>
          </section>

          {/* Archive Table */}
          <section className="panel overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-200 font-mono">
                ARSIP LAPORAN INTELIJEN
              </h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {reports.length} dokumen tersimpan
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Memuat arsip laporan...
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Belum ada arsip laporan. Klik tombol &ldquo;+ Susun Laporan Mingguan&rdquo; di atas.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 font-mono">
                        {rep.judul}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                        Jenis:{" "}
                        <strong className="capitalize text-zinc-800 dark:text-zinc-200">
                          {rep.jenis}
                        </strong>{" "}
                        &bull; Periode: {rep.periode} &bull; Dibuat:{" "}
                        {new Date(rep.created_at).toLocaleDateString("id-ID")}
                      </div>
                    </div>

                    <a
                      href={getReportViewUrl(rep.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="self-start sm:self-auto min-h-[36px] inline-flex items-center px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-800 rounded-md text-xs font-bold transition-colors font-mono"
                    >
                      Buka Dokumen &nearr;
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
