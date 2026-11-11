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
      <div className="pb-2 border-b border-[#1E2A4A]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-sky-400">
            INCIDENT RADAR &bull; ANALYST VERIFICATION
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
            Antrean Isu &amp; Peringatan Dini
          </h1>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total Terdeteksi: {issues.length} Kluster
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="panel p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Cari judul isu, kata kunci insiden, atau wilayah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs sm:text-sm px-3.5 py-2 bg-[#16203C] border border-[#1E2A4A] rounded-lg text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-[40px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-lg transition-colors shadow-sm"
          >
            Cari
          </button>
        </form>

        <div className="flex items-center gap-2.5">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="min-h-[40px] text-xs sm:text-sm border border-[#1E2A4A] rounded-lg px-3 py-2 bg-[#16203C] text-slate-200 font-medium focus:outline-none cursor-pointer"
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
            className="min-h-[40px] text-xs sm:text-sm border border-[#1E2A4A] rounded-lg px-3 py-2 bg-[#16203C] text-slate-200 font-medium focus:outline-none cursor-pointer"
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
      <div className="panel overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-mono">
            <div className="inline-block w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
            <p>Memuat antrean kluster isu dan skor anomali...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-bold text-slate-200">
              Tidak ada isu yang cocok dengan filter saat ini.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Ubah pilihan filter di atas atau klik &ldquo;Tarik Berita Nyata&rdquo; untuk menyinkronkan feed terkini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E2A4A]">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/isu/${issue.id}`}
                className="block p-5 hover:bg-[#16203C] transition-colors group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ThreatLevelPill level={issue.level} score={issue.skor} />
                    <span className="text-xs text-slate-400 font-medium font-mono">
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

                  <span className="text-[11px] font-mono font-bold capitalize px-2 py-0.5 rounded bg-[#16203C] text-slate-300 border border-[#1E2A4A]">
                    {issue.status}
                  </span>
                </div>

                <h2 className="text-base font-bold text-slate-100 group-hover:text-sky-300 transition-colors mt-2 leading-snug">
                  {issue.judul}
                </h2>

                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {issue.ringkasan}
                </p>

                <div className="mt-3.5 pt-2.5 border-t border-[#1E2A4A]/60 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>
                    Ref: <strong className="text-slate-300">{issue.kode_referensi}</strong>{" "}
                    &bull; Volume: {issue.current_volume} laporan
                  </span>
                  <span className="font-bold text-sky-400 group-hover:text-sky-300 transition-colors">
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
