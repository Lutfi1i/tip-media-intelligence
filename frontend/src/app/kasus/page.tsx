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
      <div className="pb-2 border-b border-[#1E2A4A]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-sky-400">
            INCIDENT WORKFLOW &bull; DISPATCH &amp; SLA
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
            Papan Kasus &amp; Tindak Lanjut Unit
          </h1>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total Aktif: {waitingCases.length + inProgressCases.length} Kasus
        </div>
      </div>

      {approvalFeedback && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {approvalFeedback}
        </div>
      )}

      {/* Main Split: Mobile Alert (Left) + Case Kanban Board (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Executive Alert Card Preview */}
        <div className="lg:col-span-4 flex justify-center">
          <div className="w-full max-w-[290px] bg-[#10172E] border-4 border-[#1E2A4A] rounded-[24px] p-5 flex flex-col justify-between min-h-[430px] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4 bg-[#0A0F1F] rounded-b-xl" />

            {topPriorityIssue ? (
              <>
                <div className="pt-3">
                  <div className="text-center text-[10px] font-mono text-slate-400 pb-3 mb-4 border-b border-[#1E2A4A]">
                    Notifikasi Pimpinan Siaga
                  </div>

                  <div className="space-y-3">
                    <ThreatLevelPill
                      level={topPriorityIssue.level}
                      score={topPriorityIssue.skor}
                    />

                    <h2 className="text-sm font-bold text-white leading-snug line-clamp-3">
                      {topPriorityIssue.judul}
                    </h2>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
                      {topPriorityIssue.ringkasan ||
                        "Isu membutuhkan penanganan unit terkait dan pemantauan berkala."}
                    </p>

                    <div className="pt-2 text-xs text-slate-300 space-y-1 font-mono border-t border-[#1E2A4A]/60">
                      <div>
                        <span className="text-slate-400">Wilayah:</span>{" "}
                        <strong className="text-slate-200">{topPriorityIssue.wilayah}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Kategori:</span>{" "}
                        <strong className="text-slate-200">{topPriorityIssue.kategori}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-5">
                  <button
                    type="button"
                    onClick={() =>
                      setApprovalFeedback(
                        `Rekomendasi untuk isu "${topPriorityIssue.judul.slice(0, 36)}..." telah disetujui Pimpinan.`
                      )
                    }
                    className="min-h-[38px] py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                  >
                    Setujui
                  </button>
                  <Link
                    href={`/isu/${topPriorityIssue.id}`}
                    className="min-h-[38px] inline-flex items-center justify-center py-2 bg-[#16203C] hover:bg-[#1E2A4A] text-sky-400 border border-[#1E2A4A] text-xs font-bold rounded-lg transition-colors text-center"
                  >
                    Detail
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <div className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400 mb-2">
                  STATUS AMAN
                </div>
                <h2 className="text-sm font-bold text-white mb-2">
                  Tidak Ada Alert Aktif
                </h2>
                <p className="text-xs text-slate-400">
                  Semua feed terpantau stabil tanpa lonjakan isu kritis.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 8 Cols: Papan Kasus Kanban */}
        <section className="lg:col-span-8 panel p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1E2A4A]">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Papan Penanganan Kasus
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Klik kartu kasus untuk memperbarui PIC, status, atau lampiran bukti
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              SLA Tracker Aktif
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-mono">
              Memuat data papan kasus...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Menunggu */}
              <div className="bg-[#16203C]/80 border border-[#1E2A4A] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold font-mono uppercase text-slate-300">
                    Menunggu ({waitingCases.length})
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <div className="space-y-2.5">
                  {waitingCases.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-6">
                      Kosong
                    </div>
                  ) : (
                    waitingCases.map((c) => renderCaseCard(c))
                  )}
                </div>
              </div>

              {/* Ditangani */}
              <div className="bg-[#16203C]/80 border border-[#1E2A4A] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold font-mono uppercase text-slate-300">
                    Ditangani ({inProgressCases.length})
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                </div>
                <div className="space-y-2.5">
                  {inProgressCases.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-6">
                      Kosong
                    </div>
                  ) : (
                    inProgressCases.map((c) => renderCaseCard(c))
                  )}
                </div>
              </div>

              {/* Selesai */}
              <div className="bg-[#16203C]/80 border border-[#1E2A4A] rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold font-mono uppercase text-slate-300">
                    Selesai ({completedCases.length})
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="space-y-2.5">
                  {completedCases.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-6">
                      Kosong
                    </div>
                  ) : (
                    completedCases.map((c) => renderCaseCard(c))
                  )}
                </div>
              </div>
            </div>
          )}

          <p className="text-[11px] font-mono text-slate-400 pt-2 border-t border-[#1E2A4A]/60">
            Audit Trail: Setiap pembaruan status, PIC, dan bukti respon tercatat permanen di log audit sistem.
          </p>
        </section>
      </div>

      {/* Case Update Dialog (Accessible with Escape) */}
      {selectedCase && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-case-title"
        >
          <div className="bg-[#10172E] rounded-xl max-w-lg w-full p-6 space-y-4 border border-[#1E2A4A] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2A4A]">
              <h3
                id="modal-case-title"
                className="font-bold text-white text-sm uppercase tracking-wider font-mono"
              >
                Perbarui Kasus #{selectedCase.id}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="min-w-[32px] min-h-[32px] text-slate-400 hover:text-white font-bold"
                aria-label="Tutup dialog"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="pic-input"
                  className="block font-bold uppercase tracking-wider text-slate-300 mb-1"
                >
                  PIC / Unit Penanggung Jawab
                </label>
                <input
                  id="pic-input"
                  type="text"
                  value={newPic}
                  onChange={(e) => setNewPic(e.target.value)}
                  placeholder="Contoh: Dinas SDA / Dishub DKI"
                  className="w-full text-xs p-2.5 bg-[#16203C] border border-[#1E2A4A] rounded-lg text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="status-select"
                  className="block font-bold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Status Kasus
                </label>
                <select
                  id="status-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-[#16203C] border border-[#1E2A4A] rounded-lg text-slate-100 focus:border-sky-400 focus:outline-none cursor-pointer"
                >
                  <option value="menunggu">Menunggu</option>
                  <option value="ditangani">Ditangani</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="bukti-catatan"
                  className="block font-bold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Catatan Penanganan / Tindakan Lapangan
                </label>
                <textarea
                  id="bukti-catatan"
                  rows={3}
                  value={buktiCatatan}
                  onChange={(e) => setBuktiCatatan(e.target.value)}
                  placeholder="Tuliskan tindakan yang telah dilakukan di lapangan..."
                  className="w-full text-xs p-2.5 bg-[#16203C] border border-[#1E2A4A] rounded-lg text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="bukti-url"
                  className="block font-bold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Tautan Lampiran Bukti (Opsional)
                </label>
                <input
                  id="bukti-url"
                  type="url"
                  value={buktiUrl}
                  onChange={(e) => setBuktiUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs p-2.5 bg-[#16203C] border border-[#1E2A4A] rounded-lg text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1E2A4A]">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="min-h-[38px] px-4 py-2 border border-[#1E2A4A] rounded-lg text-xs font-semibold text-slate-300 hover:bg-[#16203C]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="min-h-[38px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold disabled:opacity-50 shadow-sm"
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
        className="w-full text-left bg-[#10172E] rounded-lg p-3.5 border border-[#1E2A4A] hover:border-sky-400 transition-colors cursor-pointer group"
      >
        <div className="font-bold text-xs text-slate-200 group-hover:text-sky-300 leading-snug">
          {issue ? issue.judul : `Kasus #${c.id}`}
        </div>

        <div className="text-[11px] text-slate-400 mt-2 font-mono">
          {c.status === "menunggu" && (
            <span>
              <strong
                className={
                  levelLabel === "CRITICAL"
                    ? "text-red-400 font-bold"
                    : levelLabel === "HIGH"
                    ? "text-orange-400 font-bold"
                    : "text-slate-300"
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
              <strong className="text-amber-400">
                {getSlaTimeRemaining(c.tenggat)}
              </strong>
            </span>
          )}

          {c.status === "selesai" && (
            <span className="text-emerald-400 font-bold">
              Bukti tuntas terlampir
            </span>
          )}
        </div>
      </button>
    );
  }
}
