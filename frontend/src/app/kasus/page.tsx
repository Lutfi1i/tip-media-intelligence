"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  KanbanSquare, 
  Clock, 
  User, 
  CheckCircle2, 
  FileCheck, 
  AlertTriangle, 
  ExternalLink, 
  Plus, 
  RefreshCw,
  Send
} from "lucide-react";
import { fetchCases, updateCaseStatus, fetchIssues, CaseCard, IssueItem } from "@/lib/api";

export default function PapanKasusPage() {
  const [cases, setCases] = useState<CaseCard[]>([]);
  const [issuesMap, setIssuesMap] = useState<Record<number, IssueItem>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseCard | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal / Update Form state
  const [newPic, setNewPic] = useState("");
  const [newStatus, setNewStatus] = useState<"menunggu" | "ditangani" | "selesai">("ditangani");
  const [buktiCatatan, setBuktiCatatan] = useState("");
  const [buktiUrl, setBuktiUrl] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [casesData, issuesData] = await Promise.all([
        fetchCases(),
        fetchIssues()
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
    if (diff <= 0) return "Lewat tenggat";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `sisa ${hours}j ${mins}m`;
  };

  const waitingCases = cases.filter((c) => c.status === "menunggu");
  const inProgressCases = cases.filter((c) => c.status === "ditangani");
  const completedCases = cases.filter((c) => c.status === "selesai");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Alert Sampai Ke Pimpinan, Kasus Dipantau Sampai Selesai
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            app.tipmedia.id/kasus &bull; Alur kerja penugasan PIC, SLA respon krisis, dan bukti penyelesaian
          </p>
        </div>
      </div>

      {/* Main Grid: Mobile Alert Preview + Kanban Board (Slide 12 Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Simulated Mobile Alert to Leadership (Slide 12 Mockup) */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 max-w-xs mx-auto">
            {/* Phone notch */}
            <div className="w-20 h-4 bg-slate-950 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
              <span>06.05 &bull; Notifikasi</span>
              <span className="text-emerald-400 font-semibold">Terkirim</span>
            </div>

            {/* Alert card inside phone */}
            <div className="bg-slate-800/90 border border-orange-500/40 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                <span className="text-xs font-extrabold text-orange-400 uppercase tracking-wider">
                  ALERT HIGH
                </span>
              </div>

              <div className="font-bold text-sm text-white leading-snug">
                Banjir Jakarta Selatan
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Genangan 30&ndash;50 cm di Kemang &amp; Pejaten. Terverifikasi: pompa Kemang rusak.
              </p>

              <div className="text-xs text-slate-300 pt-1 border-t border-slate-700/60 flex justify-between">
                <span>PIC: Dinas SDA</span>
                <span className="font-semibold text-amber-400">Tenggat: 2 jam</span>
              </div>

              {/* Action buttons in mobile view */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => alert("Pimpinan telah menyetujui rekomendasi tindakan. Tiket diteruskan ke Dinas SDA.")}
                  className="py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-sm text-center transition-colors"
                >
                  Setujui
                </button>
                <Link
                  href="/isu/1"
                  className="py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded text-center transition-colors"
                >
                  Detail
                </Link>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 mt-4">
              Kanal Distribusi: WhatsApp &amp; Telegram
            </div>
          </div>
        </div>

        {/* Right 3 Columns: Kanban Board (Slide 12 Mockup) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Papan Kasus
            </h2>
            <span className="text-xs text-slate-500">
              Total {cases.length} kasus terpantau
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1: Menunggu */}
            <div className="bg-slate-100 rounded-lg p-3 border border-slate-200">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Menunggu ({waitingCases.length})
                </span>
                <span className="w-2 h-2 rounded-full bg-slate-400" />
              </div>

              <div className="space-y-3">
                {waitingCases.map((c) => renderCaseCard(c))}
              </div>
            </div>

            {/* Column 2: Ditangani */}
            <div className="bg-blue-50/60 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-blue-200">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                  Ditangani ({inProgressCases.length})
                </span>
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              </div>

              <div className="space-y-3">
                {inProgressCases.map((c) => renderCaseCard(c))}
              </div>
            </div>

            {/* Column 3: Selesai */}
            <div className="bg-emerald-50/60 rounded-lg p-3 border border-emerald-200">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-200">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                  Selesai ({completedCases.length})
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              </div>

              <div className="space-y-3">
                {completedCases.map((c) => renderCaseCard(c))}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 pt-2 italic">
            Setiap kartu menyimpan PIC, tenggat, catatan verifikasi, bukti respons, dan riwayat status (audit trail).
          </p>
        </div>
      </div>

      {/* Case Update Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                Tindak Lanjut Kasus #{selectedCase.id}
              </h3>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama PIC / Petugas Lapangan
                </label>
                <input
                  type="text"
                  value={newPic}
                  onChange={(e) => setNewPic(e.target.value)}
                  placeholder="Misal: Ir. Hendra (Dinas SDA)"
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Penanganan
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
                >
                  <option value="menunggu">Menunggu</option>
                  <option value="ditangani">Ditangani</option>
                  <option value="selesai">Selesai</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tindak Lanjut / Bukti Perbaikan
                </label>
                <textarea
                  rows={3}
                  value={buktiCatatan}
                  onChange={(e) => setBuktiCatatan(e.target.value)}
                  placeholder="Deskripsikan tindakan yang diambil atau bukti foto perbaikan..."
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tautan Bukti Dokumentasi (Foto / Dokumen)
                </label>
                <input
                  type="text"
                  value={buktiUrl}
                  onChange={(e) => setBuktiUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full text-xs p-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="px-4 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
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
    const isCompleted = c.status === "selesai";

    return (
      <div
        key={c.id}
        onClick={() => {
          setSelectedCase(c);
          setNewPic(c.pic_nama || "");
          setNewStatus(c.status);
        }}
        className="bg-white rounded-md p-3.5 border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all"
      >
        <div className="font-bold text-sm text-slate-900 leading-snug mb-1">
          {issue ? issue.judul : `Kasus #${c.id}`}
        </div>

        <div className="text-xs text-slate-600 space-y-1">
          {c.status === "menunggu" && (
            <div className="text-slate-500">
              <span className="font-semibold text-orange-700">HIGH</span> &bull; {c.pic_nama ? c.pic_nama : "belum ada PIC"}
            </div>
          )}

          {c.status === "ditangani" && (
            <div className="text-slate-700">
              PIC <span className="font-bold text-slate-900">{c.pic_nama || c.unit}</span> &bull;{" "}
              <span className="font-semibold text-blue-700">{getSlaTimeRemaining(c.tenggat)}</span>
            </div>
          )}

          {c.status === "selesai" && (
            <div className="text-emerald-700 font-semibold flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Bukti perbaikan terlampir
            </div>
          )}
        </div>

        {c.bukti && c.bukti.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic line-clamp-1">
            &ldquo;{c.bukti[c.bukti.length - 1].catatan}&rdquo;
          </div>
        )}
      </div>
    );
  }
}
