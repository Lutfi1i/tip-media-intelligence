"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchCases,
  updateCaseStatus,
  fetchIssues,
  CaseCard,
  IssueItem,
} from "@/lib/api";
import { ThreatLevelPill } from "@/components/RadarUi";

export default function PapanKasusPage() {
  const [cases, setCases] = useState<CaseCard[]>([]);
  const [issuesMap, setIssuesMap] = useState<Record<number, IssueItem>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseCard | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);

  const [newPic, setNewPic] = useState("");
  const [newStatus, setNewStatus] = useState<
    "menunggu" | "ditangani" | "selesai"
  >("ditangani");
  const [buktiCatatan, setBuktiCatatan] = useState("");
  const [buktiUrl, setBuktiUrl] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [casesData, issuesData] = await Promise.all([
        fetchCases(),
        fetchIssues(),
      ]);
      setCases(casesData);

      const map: Record<number, IssueItem> = {};
      issuesData.forEach((i: IssueItem) => {
        map[i.id] = i;
      });
      setIssuesMap(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close modal on Escape key (R-32)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCase(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setIsUpdating(true);
    try {
      await updateCaseStatus(selectedCase.id, {
        pic_nama: newPic || selectedCase.pic_nama,
        status: newStatus,
        bukti_catatan: buktiCatatan || undefined,
        bukti_url: buktiUrl || undefined,
      });
      setSelectedCase(null);
      setBuktiCatatan("");
      setBuktiUrl("");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui status kasus");
    } finally {
      setIsUpdating(false);
    }
  };

  const getSlaTimeRemaining = (tenggatStr: string) => {
    const deadline = new Date(tenggatStr).getTime();
    const now = new Date().getTime();
    const diff = deadline - now;
    if (diff <= 0) return "lewat tenggat";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `sisa ${hours}j ${mins}m`;
  };

  const waitingCases = cases.filter((c) => c.status === "menunggu");
  const inProgressCases = cases.filter((c) => c.status === "ditangani");
  const completedCases = cases.filter((c) => c.status === "selesai");
  const topPriorityIssue =
    Object.values(issuesMap).sort((a, b) => b.skor - a.skor)[0] || null;

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            INCIDENT WORKFLOW &bull; DISPATCH &amp; SLA
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Papan Kasus &amp; Tindak Lanjut Unit
          </h1>
        </div>
        <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
          Total Aktif: {waitingCases.length + inProgressCases.length} Kasus
        </div>
      </div>

      {approvalFeedback && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-700 dark:text-emerald-300 font-mono font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {approvalFeedback}
        </div>
      )}

      {/* Main Split: Mobile Alert (Left) + Case Kanban Board (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Executive Alert Card Preview */}
        <div className="lg:col-span-4 flex justify-center">
          <div className="w-full max-w-[290px] bg-white dark:bg-[#09090B] border-4 border-zinc-300 dark:border-zinc-800 rounded-[24px] p-5 flex flex-col justify-between min-h-[430px] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-zinc-200 dark:bg-black rounded-b-xl" />

            {topPriorityIssue ? (
              <>
                <div className="pt-3">
                  <div className="text-center text-[10px] font-mono text-zinc-500 pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                    Notifikasi Pimpinan Siaga
                  </div>

                  <div className="space-y-3">
                    <ThreatLevelPill
                      level={topPriorityIssue.level}
                      score={topPriorityIssue.skor}
                    />

                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white leading-snug line-clamp-3 font-mono">
                      {topPriorityIssue.judul}
                    </h2>

                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-4 font-mono">
                      {topPriorityIssue.ringkasan ||
                        "Isu membutuhkan penanganan unit terkait dan pemantauan berkala."}
                    </p>

                    <div className="pt-2 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 font-mono border-t border-zinc-200 dark:border-zinc-800">
                      <div>
                        <span className="text-zinc-400">Wilayah:</span>{" "}
                        <strong className="text-zinc-800 dark:text-zinc-200">{topPriorityIssue.wilayah}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-400">Kategori:</span>{" "}
                        <strong className="text-zinc-800 dark:text-zinc-200">{topPriorityIssue.kategori}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setApprovalFeedback(
                        `Instruksi darurat untuk "${topPriorityIssue.judul.slice(0, 40)}..." telah dikirimkan ke PIC Unit!`
                      );
                    }}
                    className="w-full min-h-[40px] px-3 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-mono font-bold rounded-md transition-colors"
                  >
                    Kirim Instruksi Cepat
                  </button>
                  <Link
                    href={`/isu/${topPriorityIssue.id}`}
                    className="block text-center text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:underline"
                  >
                    Buka Berkas Isu Lengkap &rarr;
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-24 text-center">
                <div className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 mb-2">
                  STATUS AMAN
                </div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-2 font-mono">
                  Tidak Ada Alert Aktif
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  Semua feed terpantau stabil tanpa lonjakan isu kritis.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 8 Cols: Papan Kasus Kanban */}
        <section className="lg:col-span-8 panel p-6 space-y-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold font-mono text-zinc-900 dark:text-white uppercase tracking-wider">
                PAPAN PENANGANAN KASUS
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                Klik kartu kasus untuk memperbarui PIC, status, atau lampiran bukti
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              SLA Tracker Aktif
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              Memuat data papan kasus...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Menunggu */}
              <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold font-mono uppercase text-zinc-700 dark:text-zinc-300">
                    Menunggu ({waitingCases.length})
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <div className="space-y-2.5">
                  {waitingCases.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 text-center py-6 font-mono">
                      Kosong
                    </div>
                  ) : (
                    waitingCases.map((c) => renderCaseCard(c))
                  )}
                </div>
              </div>

              {/* Ditangani */}
              <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold font-mono uppercase text-zinc-700 dark:text-zinc-300">
                    Ditangani ({inProgressCases.length})
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-white" />
                </div>
                <div className="space-y-2.5">
                  {inProgressCases.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 text-center py-6 font-mono">
                      Kosong
                    </div>
                  ) : (
                    inProgressCases.map((c) => renderCaseCard(c))
                  )}
                </div>
              </div>

              {/* Selesai */}
              <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold font-mono uppercase text-zinc-700 dark:text-zinc-300">
                    Selesai ({completedCases.length})
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="space-y-2.5">
                  {completedCases.length === 0 ? (
                    <div className="text-[11px] text-zinc-400 text-center py-6 font-mono">
                      Kosong
                    </div>
                  ) : (
                    completedCases.map((c) => renderCaseCard(c))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Update Case Modal */}
      {selectedCase && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-case-title"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCase(null);
          }}
        >
          <div className="bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-800 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-500">
                  PERBARUI KASUS #{selectedCase.id}
                </span>
                <h3
                  id="modal-case-title"
                  className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5 font-mono"
                >
                  {issuesMap[selectedCase.issue_id]?.judul ||
                    `Kasus #${selectedCase.id}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs font-mono">
              <div>
                <label
                  htmlFor="pic-input"
                  className="block font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  PIC Lapangan / Unit
                </label>
                <input
                  id="pic-input"
                  type="text"
                  value={newPic}
                  onChange={(e) => setNewPic(e.target.value)}
                  placeholder="Contoh: Budi (Satlak SDA Kemang)"
                  className="w-full text-xs p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="status-select"
                  className="block font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Status Penanganan
                </label>
                <select
                  id="status-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
                >
                  <option value="menunggu">Menunggu</option>
                  <option value="ditangani">Ditangani</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="bukti-catatan"
                  className="block font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Catatan Penanganan / Tindakan Lapangan
                </label>
                <textarea
                  id="bukti-catatan"
                  rows={3}
                  value={buktiCatatan}
                  onChange={(e) => setBuktiCatatan(e.target.value)}
                  placeholder="Tuliskan tindakan yang telah dilakukan di lapangan..."
                  className="w-full text-xs p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="bukti-url"
                  className="block font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Tautan Lampiran Bukti (Opsional)
                </label>
                <input
                  id="bukti-url"
                  type="url"
                  value={buktiUrl}
                  onChange={(e) => setBuktiUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="min-h-[38px] px-4 py-2 border border-zinc-300 dark:border-zinc-800 rounded-md text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="min-h-[38px] px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-md text-xs font-bold disabled:opacity-50 shadow-xs"
                >
                  {isUpdating ? "Menyimpan..." : "Simpan Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function renderCaseCard(c: CaseCard) {
    const issue = issuesMap[c.issue_id];
    const levelLabel = issue?.level || "HIGH";

    return (
      <button
        key={c.id}
        type="button"
        onClick={() => {
          setSelectedCase(c);
          setNewPic(c.pic_nama || "");
          setNewStatus(c.status);
        }}
        className="w-full text-left bg-white dark:bg-[#09090B] rounded-lg p-3.5 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-500 transition-colors cursor-pointer group shadow-2xs"
      >
        <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 group-hover:underline leading-snug">
          {issue ? issue.judul : `Kasus #${c.id}`}
        </div>

        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 font-mono">
          {c.status === "menunggu" && (
            <span>
              <strong
                className={
                  levelLabel === "CRITICAL"
                    ? "text-red-500 font-bold"
                    : levelLabel === "HIGH"
                    ? "text-orange-500 font-bold"
                    : "text-zinc-700 dark:text-zinc-300"
                }
              >
                {levelLabel}
              </strong>{" "}
              &bull; {c.pic_nama ? "dipantau" : "belum ada PIC"}
            </span>
          )}

          {c.status === "ditangani" && (
            <span>
              PIC: {c.pic_nama || c.unit} &bull;{" "}
              <strong className="text-amber-500">
                {getSlaTimeRemaining(c.tenggat)}
              </strong>
            </span>
          )}

          {c.status === "selesai" && (
            <span className="text-emerald-500 font-bold">
              Bukti tuntas terlampir
            </span>
          )}
        </div>
      </button>
    );
  }
}
