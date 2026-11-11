"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Filter, Search, ChevronRight, RefreshCw } from "lucide-react";
import { fetchIssues, IssueItem } from "@/lib/api";

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

  const getBadgeClass = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "bg-red-100 text-red-900 border-red-200";
      case "HIGH":
        return "bg-orange-100 text-orange-900 border-orange-200";
      case "MEDIUM":
        return "bg-blue-100 text-blue-900 border-blue-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Antrean Isu & Alert
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Daftar kandidat isu, hasil skor risiko AI, dan status verifikasi analis
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex-1 w-full flex items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan kata kunci, judul, atau wilayah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-4 py-2 border border-slate-300 rounded-md focus:border-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-md shadow-sm transition-colors"
          >
            Cari
          </button>
        </form>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="text-xs sm:text-sm border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none"
            aria-label="Filter Tingkat Risiko"
          >
            <option value="">Semua Level</option>
            <option value="CRITICAL">Critical (85-100)</option>
            <option value="HIGH">High (70-84)</option>
            <option value="MEDIUM">Medium (40-69)</option>
            <option value="LOW">Low (0-39)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs sm:text-sm border border-slate-300 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none"
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

      {/* Issues Table / Cards */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
            <p className="text-xs">Memuat antrean isu...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-sm">Tidak ada isu yang cocok dengan kriteria filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/isu/${issue.id}`}
                className="block p-4 sm:p-5 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded border ${getBadgeClass(issue.level)}`}>
                      {issue.level} &bull; {Math.round(issue.skor)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {issue.kode_referensi}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {issue.wilayah}
                    </span>
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
                      {issue.kategori}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Volume: {issue.current_volume} mention ({issue.repost_count} repost)
                  </div>
                </div>

                <div className="mt-2.5 flex items-baseline justify-between">
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {issue.judul}
                  </h3>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all ml-2" />
                </div>

                <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2">
                  {issue.ringkasan || "Belum ada ringkasan yang diekstraksi."}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center space-x-2">
                    <span>Status:</span>
                    <span className="font-semibold text-slate-800 capitalize bg-slate-100 px-2 py-0.5 rounded">
                      {issue.status}
                    </span>
                  </div>
                  <span>Terdeteksi: {new Date(issue.first_seen).toLocaleTimeString("id-ID")} WIB</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
