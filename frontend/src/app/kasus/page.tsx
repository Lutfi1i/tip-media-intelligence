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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-wider uppercase text-blue-700">
          Notifikasi &amp; Kasus
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
          Alert sampai ke pimpinan, kasus dipantau sampai selesai
        </h1>
      </div>

      {approvalFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-sm text-emerald-900 font-semibold">
          {approvalFeedback}
        </div>
      )}

      {/* Main Split matching Slide 12: Mobile Frame (Left) + Case Board (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Simulated Mobile Alert matching Slide 12 */}
        <div className="lg:col-span-4 flex justify-center">
          <div className="w-full max-w-[290px] bg-white border-[8px] border-[#0F172A] rounded-[28px] p-5 flex flex-col justify-between min-h-[430px] shadow-sm">
            <div>
              <div className="text-center text-xs text-slate-500 pb-3 mb-4 border-b border-slate-200">
                06.05 &middot; Notifikasi
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#C2410C]">
                  ALERT HIGH
                </div>

                <h2 className="text-base font-extrabold text-slate-900 leading-snug">
                  Banjir Jakarta Selatan
                </h2>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Genangan 30&ndash;50 cm di Kemang &amp; Pejaten. Terverifikasi:
                  pompa Kemang rusak.
                </p>

                <div className="pt-2 text-sm text-slate-900 space-y-0.5">
                  <div>
                    <strong className="font-bold">PIC:</strong> Dinas SDA
                  </div>
                  <div>
                    <strong className="font-bold">Tenggat:</strong> 2 jam
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-6">
              <button
                type="button"
                onClick={() =>
                  setApprovalFeedback(
                    "Rekomendasi tindakan disetujui Pimpinan. Instruksi penugasan dikirim ke PIC Dinas SDA (SLA 2 jam)."
                  )
                }
                className="min-h-[42px] py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Setujui
              </button>
              <Link
                href="/isu/1"
                className="min-h-[42px] inline-flex items-center justify-center py-2 bg-white hover:bg-blue-50 text-[#2563EB] border-2 border-[#2563EB] text-xs font-bold rounded-lg transition-colors"
              >
                Detail
              </Link>
            </div>
          </div>
        </div>

        {/* Right 8 Cols: Papan Kasus Kanban matching Slide 12 */}
        <section className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">
              Papan kasus
            </h2>
            <span className="text-xs text-slate-500">
              Klik kartu kasus untuk memperbarui PIC, status, atau bukti
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Memuat papan kasus...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Menunggu */}
              <div className="bg-slate-100/90 rounded-xl p-3.5 space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900 px-1">
                  Menunggu ({waitingCases.length})
                </h3>
                <div className="space-y-2.5">
                  {waitingCases.map((c) => renderCaseCard(c))}
                </div>
              </div>

              {/* Ditangani */}
              <div className="bg-slate-100/90 rounded-xl p-3.5 space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900 px-1">
                  Ditangani ({inProgressCases.length})
                </h3>
                <div className="space-y-2.5">
                  {inProgressCases.map((c) => renderCaseCard(c))}
                </div>
              </div>

              {/* Selesai */}
              <div className="bg-slate-100/90 rounded-xl p-3.5 space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900 px-1">
                  Selesai ({completedCases.length})
                </h3>
                <div className="space-y-2.5">
                  {completedCases.map((c) => renderCaseCard(c))}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 pt-2">
            Setiap kartu menyimpan PIC, tenggat, catatan verifikasi, bukti
            respons, dan riwayat status (audit trail).
          </p>
        </section>
      </div>

      {/* Case Update Dialog (Accessible with Escape) */}
      {selectedCase && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-case-title"
        >
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3
                id="modal-case-title"
                className="font-extrabold text-slate-900 text-base"
              >
                Perbarui Tindak Lanjut Kasus #{selectedCase.id}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="min-w-[36px] min-h-[36px] text-slate-500 hover:text-slate-900 font-bold"
                aria-label="Tutup dialog"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label
                  htmlFor="pic-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  PIC / Unit Penanggung Jawab
                </label>
                <input
                  id="pic-input"
                  type="text"
                  value={newPic}
                  onChange={(e) => setNewPic(e.target.value)}
                  placeholder="Contoh: Dinas SDA / Dishub"
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="status-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Status Kasus
                </label>
                <select
                  id="status-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none bg-white"
                >
                  <option value="menunggu">Menunggu</option>
                  <option value="ditangani">Ditangani</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="bukti-catatan"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Catatan Penanganan / Bukti Lapangan
                </label>
                <textarea
                  id="bukti-catatan"
                  rows={3}
                  value={buktiCatatan}
                  onChange={(e) => setBuktiCatatan(e.target.value)}
                  placeholder="Tuliskan tindakan yang telah dikerjakan di lapangan..."
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="bukti-url"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Tautan Lampiran Bukti (Opsional)
                </label>
                <input
                  id="bukti-url"
                  type="url"
                  value={buktiUrl}
                  onChange={(e) => setBuktiUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="min-h-[40px] px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="min-h-[40px] px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
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
        className={`w-full text-left bg-white rounded-lg p-3.5 border transition-colors cursor-pointer ${
          c.status === "ditangani" && issue?.kode_referensi === "2611-0042"
            ? "border-[#EA580C]/70"
            : "border-slate-200/90 hover:border-blue-500"
        }`}
      >
        <div className="font-bold text-sm text-slate-900 leading-snug">
          {issue ? issue.judul : `Kasus #${c.id}`}
        </div>

        <div className="text-xs text-slate-500 mt-1.5">
          {c.status === "menunggu" && (
            <span>
              <strong
                className={
                  levelLabel === "HIGH"
                    ? "text-[#C2410C] font-bold"
                    : "text-slate-600 font-semibold"
                }
              >
                {levelLabel}
              </strong>{" "}
              &middot; {c.pic_nama ? "dipantau" : "belum ada PIC"}
            </span>
          )}

          {c.status === "ditangani" && (
            <span>
              PIC {c.pic_nama || c.unit} &middot;{" "}
              <strong className="text-[#9A3412] font-semibold">
                {getSlaTimeRemaining(c.tenggat)}
              </strong>
            </span>
          )}

          {c.status === "selesai" && (
            <span className="text-slate-600">Bukti perbaikan terlampir</span>
          )}
        </div>
      </button>
    );
  }
}
