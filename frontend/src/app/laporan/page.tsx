"use client";

import { useEffect, useState } from "react";
import {
  fetchReports,
  generateSocialReport,
  generateNewReport,
  getReportViewUrl,
  getReportPdfUrl,
} from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Notice } from "@/components/ui";

type JenisId = "harian" | "mingguan" | "bulanan" | "insidental" | "social-24h" | "social-7d";

const JENIS_OPTIONS: { id: JenisId; label: string; social?: "24h" | "7d" }[] = [
  { id: "harian", label: "Harian" },
  { id: "mingguan", label: "Mingguan" },
  { id: "bulanan", label: "Bulanan" },
  { id: "insidental", label: "Insidental" },
  { id: "social-24h", label: "Social Pulse 24 jam", social: "24h" },
  { id: "social-7d", label: "Social Pulse 7 hari", social: "7d" },
];

function defaultPeriode(jenis: JenisId): string {
  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  if (jenis === "harian") return fmt(now);
  if (jenis === "mingguan") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return `${fmt(start)} - ${fmt(now)}`;
  }
  if (jenis === "bulanan") {
    return now.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  }
  return "";
}

export default function LaporanPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [jenis, setJenis] = useState<JenisId>("harian");
  const [periode, setPeriode] = useState(() => defaultPeriode("harian"));
  const [filterJenis, setFilterJenis] = useState("");

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchReports();
      setReports(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memuat arsip laporan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleGenerate = async () => {
    const opt = JENIS_OPTIONS.find((o) => o.id === jenis)!;
    if (!opt.social && !periode.trim()) {
      setErrorMsg("Isi periode laporan dulu.");
      return;
    }
    setGenerating(true);
    setGenSuccess(null);
    setErrorMsg(null);
    try {
      if (opt.social) {
        const rep = await generateSocialReport(opt.social);
        setGenSuccess(`Laporan Social Pulse (${rep.periode}) selesai disusun.`);
      } else {
        await generateNewReport(jenis, periode.trim());
        setGenSuccess(`Laporan ${opt.label.toLowerCase()} (${periode.trim()}) selesai disusun.`);
      }
      await loadReports();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyusun laporan");
    } finally {
      setGenerating(false);
    }
  };

  const jenisInArchive = Array.from(new Set(reports.map((r) => String(r.jenis)))).sort();
  const filteredReports = filterJenis ? reports.filter((r) => r.jenis === filterJenis) : reports;

  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            Briefing pimpinan
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Laporan &amp; Dokumen Eksekutif
          </h1>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleGenerate();
        }}
        className="panel p-4 grid grid-cols-1 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-end gap-3 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800"
      >
        <div>
          <label htmlFor="jenis-laporan" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Jenis laporan
          </label>
          <select
            id="jenis-laporan"
            value={jenis}
            onChange={(e) => {
              const v = e.target.value as JenisId;
              setJenis(v);
              setPeriode(defaultPeriode(v));
            }}
            className="w-full min-h-[40px] text-sm border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            {JENIS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="periode-laporan" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Periode
          </label>
          {JENIS_OPTIONS.find((o) => o.id === jenis)?.social ? (
            <p className="min-h-[40px] flex items-center text-sm text-zinc-500 dark:text-zinc-400">
              Otomatis: {jenis === "social-24h" ? "24 jam terakhir" : "7 hari terakhir"}
            </p>
          ) : (
            <input
              id="periode-laporan"
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              placeholder={jenis === "insidental" ? "Contoh: Banjir Jakarta Timur, 14 November 2026" : ""}
              className="w-full min-h-[40px] text-sm border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
          )}
        </div>
        <button
          type="submit"
          disabled={generating}
          className="min-h-[40px] px-5 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-md text-sm font-bold transition-colors disabled:opacity-50"
        >
          {generating ? "Menyusun..." : "Susun laporan"}
        </button>
      </form>

      {generating && <Notice tone="info" message="Menyusun laporan dari data terkini. Biasanya butuh beberapa detik..." />}
      {genSuccess && <Notice tone="success" message={genSuccess} onClose={() => setGenSuccess(null)} />}
      {errorMsg && <Notice tone="error" message={errorMsg} onRetry={loadReports} onClose={() => setErrorMsg(null)} />}

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
                  Buka &amp; Cetak Dokumen Lengkap ↗
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
                Arsip laporan ({filteredReports.length})
              </h3>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                aria-label="Filter jenis laporan"
                className="text-xs border border-zinc-300 dark:border-zinc-800 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
              >
                <option value="">Semua jenis</option>
                {jenisInArchive.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Memuat arsip laporan...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Belum ada arsip laporan. Pilih jenis dan periode di atas, lalu klik &ldquo;Susun laporan&rdquo;.
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredReports.map((rep) => (
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
                        {fmtDateTime(rep.created_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <a
                        href={getReportViewUrl(rep.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[36px] inline-flex items-center px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-800 rounded-md text-xs font-bold transition-colors font-mono"
                      >
                        Buka HTML ↗
                      </a>
                      <a
                        href={getReportPdfUrl(rep.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[36px] inline-flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors font-mono"
                      >
                        Unduh PDF
                      </a>
                    </div>
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
