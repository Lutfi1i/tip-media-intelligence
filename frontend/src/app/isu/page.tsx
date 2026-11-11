"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchIssues, IssueItem } from "@/lib/api";
import { ThreatLevelPill } from "@/components/RadarUi";

export default function IsuListPage() {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadIssues = async () => {
    setLoading(true);
    try {
      const data = await fetchIssues({
        level: levelFilter || undefined,
        status: statusFilter || undefined,
        q: searchQuery || undefined,
      });
      setIssues(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [levelFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadIssues();
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            INCIDENT RADAR &bull; ANALYST VERIFICATION
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Antrean Isu &amp; Peringatan Dini
          </h1>
        </div>
        <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
          Total Terdeteksi: {issues.length} Kluster
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="panel p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Cari judul isu, kata kunci insiden, atau wilayah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs sm:text-sm px-3.5 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="min-h-[40px] px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs sm:text-sm font-mono font-bold rounded-md transition-colors shadow-xs"
          >
            Cari
          </button>
        </form>

        <div className="flex items-center gap-2.5">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="min-h-[40px] text-xs sm:text-sm border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none cursor-pointer"
            aria-label="Filter Level Risiko"
          >
            <option value="">Semua Level Risiko</option>
            <option value="CRITICAL">CRITICAL (85-100)</option>
            <option value="HIGH">HIGH (70-84)</option>
            <option value="MEDIUM">MEDIUM (40-69)</option>
            <option value="LOW">LOW (0-39)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[40px] text-xs sm:text-sm border border-zinc-300 dark:border-zinc-800 rounded-md px-3 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 font-mono focus:outline-none cursor-pointer"
            aria-label="Filter Status Verifikasi"
          >
            <option value="">Semua Status</option>
            <option value="kandidat">Kandidat</option>
            <option value="terverifikasi">Terverifikasi</option>
            <option value="dikoreksi">Dikoreksi</option>
            <option value="selesai">Selesai</option>
          </select>
        </div>
      </div>

      {/* Issues Radar Feed */}
      <div className="panel overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            <div className="inline-block w-6 h-6 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin mb-2" />
            <p>Memuat antrean kluster isu dan skor anomali...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-bold font-mono text-zinc-800 dark:text-zinc-200">
              Tidak ada isu yang cocok dengan filter saat ini.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
              Ubah pilihan filter di atas atau klik &ldquo;Tarik Berita Nyata&rdquo; untuk menyinkronkan feed terkini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/isu/${issue.id}`}
                className="block p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ThreatLevelPill level={issue.level} score={issue.skor} />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                      {issue.wilayah} &bull; {issue.kategori} &bull;{" "}
                      <span>
                        {new Date(issue.first_seen).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        WIB
                      </span>
                    </span>
                  </div>

                  <span className="text-[11px] font-mono font-bold capitalize px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    {issue.status}
                  </span>
                </div>

                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:underline transition-colors mt-2 leading-snug">
                  {issue.judul}
                </h2>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                  {issue.ringkasan}
                </p>

                <div className="mt-3.5 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  <span>
                    Ref: <strong className="text-zinc-800 dark:text-zinc-200">{issue.kode_referensi}</strong>{" "}
                    &bull; Volume: {issue.current_volume} laporan
                  </span>
                  <span className="font-bold text-zinc-900 dark:text-white group-hover:underline transition-colors">
                    Verifikasi Analis &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
