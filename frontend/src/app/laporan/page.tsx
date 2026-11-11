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
      <div className="pb-2 border-b border-[#1E2A4A]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-sky-400">
            EXECUTIVE INTELLIGENCE &bull; BRIEFING PACK
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
            Laporan &amp; Dokumen Eksekutif
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleGenerate("harian")}
            disabled={generating}
            className="min-h-[38px] px-3.5 py-1.5 bg-[#16203C] hover:bg-[#1E2A4A] text-slate-200 rounded-lg border border-[#1E2A4A] text-xs font-bold transition-colors disabled:opacity-50"
          >
            + Susun Laporan Harian
          </button>
          <button
            type="button"
            onClick={() => handleGenerate("mingguan")}
            disabled={generating}
            className="min-h-[38px] px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
          >
            + Susun Laporan Mingguan
          </button>
        </div>
      </div>

      {genSuccess && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {genSuccess}
        </div>
      )}

      {/* Main Split: Executive Artifact & Archive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Document Card Preview */}
        <section className="lg:col-span-4 panel overflow-hidden">
          <div className="bg-[#0C1226] text-white p-5 border-b border-[#1E2A4A]">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
              PRATINJAU DOKUMEN BRIEFING
            </div>
            <div className="text-base font-extrabold mt-1">
              {latestReport ? latestReport.judul : "Laporan Eksekutif"}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              {latestReport ? latestReport.periode : "Terkini"}
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                Ringkasan Eksekutif
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dokumen resmi merangkum pemantauan media, sebaran wilayah Kemendagri,
                kluster risiko tertinggi, dan audit tindak lanjut unit respon.
              </p>
            </div>

            {latestReport?.data_snapshot?.kpi && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#16203C] p-3 rounded-lg border border-[#1E2A4A]">
                  <div className="text-xl font-black font-mono text-sky-400">
                    {latestReport.data_snapshot.kpi.mention_unik ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                    Mention Unik
                  </div>
                </div>

                <div className="bg-[#16203C] p-3 rounded-lg border border-[#1E2A4A]">
                  <div className="text-xl font-black font-mono text-amber-400">
                    {latestReport.data_snapshot.kpi.isu_prioritas ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                    Isu Prioritas
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              {latestReport ? (
                <a
                  href={getReportViewUrl(latestReport.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full min-h-[40px] inline-flex items-center justify-center py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  Buka &amp; Cetak Dokumen Lengkap &nearr;
                </a>
              ) : (
                <button
                  disabled
                  className="w-full min-h-[40px] inline-flex items-center justify-center py-2.5 px-4 bg-slate-800 text-slate-500 text-xs font-bold rounded-lg cursor-not-allowed"
                >
                  Belum Ada Laporan
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right 8 Cols: Report Contents & Archive List */}
        <div className="lg:col-span-8 space-y-6">
          <section className="panel p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 font-mono">
              Struktur Isi Laporan Standar Eksekutif
            </h2>

            <ul className="divide-y divide-[#1E2A4A] text-xs font-medium text-slate-300">
              <li className="py-3 flex items-center gap-2">
                <span className="text-sky-400 font-bold">&bull;</span>
                Ringkasan situasi dan indikator utama media &amp; risiko bencana
              </li>
              <li className="py-3 flex items-center gap-2">
                <span className="text-sky-400 font-bold">&bull;</span>
                Sebaran per wilayah Kemendagri beserta sentimen publik
              </li>
              <li className="py-3 flex items-center gap-2">
                <span className="text-sky-400 font-bold">&bull;</span>
                Kutipan artikel bukti dari feed berita terverifikasi (Antara, Detik, CNN, BMKG, Dishub)
              </li>
              <li className="py-3 flex items-center gap-2">
                <span className="text-sky-400 font-bold">&bull;</span>
                Rekomendasi tindakan teknis dan SLA tindak lanjut unit lapangan
              </li>
            </ul>
          </section>

          {/* Archive Table */}
          <section className="panel overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1E2A4A] flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Arsip Laporan Intelijen
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {reports.length} dokumen tersimpan
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 font-mono">
                Memuat arsip laporan...
              </div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada arsip laporan. Klik tombol &ldquo;+ Susun Laporan Mingguan&rdquo; di atas.
              </div>
            ) : (
              <div className="divide-y divide-[#1E2A4A]">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#16203C] transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-200">
                        {rep.judul}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        Jenis:{" "}
                        <strong className="capitalize text-slate-300">
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
                      className="self-start sm:self-auto min-h-[36px] inline-flex items-center px-3.5 py-1.5 bg-[#16203C] hover:bg-[#1E2A4A] text-sky-400 border border-[#1E2A4A] rounded-lg text-xs font-bold transition-colors font-mono"
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
