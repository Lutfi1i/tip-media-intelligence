"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  const getPillClass = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "bg-[#B91C1C] text-white";
      case "HIGH":
        return "bg-[#EA580C] text-white";
      case "MEDIUM":
        return "bg-[#2563EB] text-white";
      default:
        return "bg-slate-200 text-slate-800";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-wider uppercase text-blue-700">
          Isu &amp; Alert
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
          Antrean kandidat isu dan verifikasi analis
        </h1>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="Cari judul isu, kata kunci, atau wilayah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm px-3.5 py-2 border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-[40px] px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-lg transition-colors"
          >
            Cari
          </button>
        </form>

        <div className="flex items-center gap-2.5">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="min-h-[40px] text-xs sm:text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 font-medium"
            aria-label="Filter Level Risiko"
          >
            <option value="">Semua Level</option>
            <option value="CRITICAL">CRITICAL (85-100)</option>
            <option value="HIGH">HIGH (70-84)</option>
            <option value="MEDIUM">MEDIUM (40-69)</option>
            <option value="LOW">LOW (0-39)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[40px] text-xs sm:text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 font-medium"
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

      {/* Issues List */}
      <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-600">
            Memuat antrean isu dan skor risiko...
          </div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-800">
              Tidak ada isu yang cocok dengan filter saat ini.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ubah pilihan filter di atas atau klik &ldquo;Muat Skenario
              Banjir&rdquo; pada bilah atas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/isu/${issue.id}`}
                className="block p-5 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-md ${getPillClass(
                        issue.level
                      )}`}
                    >
                      {issue.level} &middot; skor {Math.round(issue.skor)}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">
                      {issue.wilayah} &middot; {issue.kategori} &middot;{" "}
                      <span className="font-mono">
                        {new Date(issue.first_seen).toLocaleTimeString(
                          "id-ID",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}{" "}
                        WIB
                      </span>
                    </span>
                  </div>
                  <span className="text-xs font-semibold capitalize px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {issue.status}
                  </span>
                </div>

                <h2 className="text-lg font-extrabold text-slate-900 group-hover:text-blue-700 mt-2">
                  {issue.judul}
                </h2>

                <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                  {issue.ringkasan}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Kode: <strong className="font-mono">{issue.kode_referensi}</strong>{" "}
                    &middot; Volume: {issue.current_volume} konten ({issue.repost_count}{" "}
                    repost)
                  </span>
                  <span className="font-semibold text-blue-700">
                    Periksa &amp; Verifikasi
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
