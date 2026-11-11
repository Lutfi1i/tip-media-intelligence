"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Edit3, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  RefreshCw 
} from "lucide-react";
import { fetchIssueDetail, submitIssueReview, IssueDetail } from "@/lib/api";

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review state
  const [reviewerCatatan, setReviewerCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await fetchIssueDetail(issueId);
      setIssue(data);
      if (data.reviews && data.reviews.length > 0) {
        setReviewerCatatan(data.reviews[0].catatan || "");
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat detail isu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [issueId]);

  const handleDecision = async (keputusan: "verifikasi" | "koreksi" | "tolak") => {
    if (!issue) return;
    setSubmitting(true);
    setActionSuccess(null);
    try {
      await submitIssueReview(issue.id, {
        reviewer_id: "analis_01",
        reviewer_nama: "Analis Piket Krisis (Budi Santoso)",
        keputusan,
        catatan: reviewerCatatan || (keputusan === "verifikasi" ? "Fakta dan lokasi terverifikasi oleh analis." : ""),
      });
      setActionSuccess(`Keputusan ${keputusan.toUpperCase()} berhasil disimpan.`);
      await loadDetail();
    } catch (err: any) {
      alert(err.message || "Gagal memproses verifikasi");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Memuat rincian isu & bukti sumber...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-red-900 mb-1">Isu Tidak Ditemukan</h2>
        <p className="text-sm text-red-700 mb-4">{error || "Data tidak tersedia."}</p>
        <Link href="/isu" className="text-blue-600 text-sm font-semibold hover:underline">
          &larr; Kembali ke daftar isu
        </Link>
      </div>
    );
  }

  const badgeClasses = {
    CRITICAL: "bg-red-100 text-red-900 border-red-300",
    HIGH: "bg-orange-100 text-orange-900 border-orange-300",
    MEDIUM: "bg-blue-100 text-blue-900 border-blue-300",
    LOW: "bg-slate-100 text-slate-800 border-slate-300",
  }[issue.level] || "bg-slate-100 text-slate-800";

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <Link
          href="/isu"
          className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali ke Antrean Isu
        </Link>
        <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-mono">
          app.tipmedia.id/isu/{issue.kode_referensi}
        </span>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-sm text-emerald-900 font-semibold flex items-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-2 flex-shrink-0" />
          {actionSuccess}
        </div>
      )}

      {/* Main Issue Card - Slide 11 Mockup */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 shadow-sm">
        {/* Header tags: HIGH - skor 78 | Jakarta Selatan | Bencana | 05.40 WIB */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-xs font-bold px-3 py-1 rounded border ${badgeClasses}`}>
            {issue.level} &bull; skor {Math.round(issue.skor)}
          </span>
          <span className="text-xs bg-slate-100 text-slate-800 font-semibold px-2.5 py-1 rounded border border-slate-200">
            {issue.wilayah}
          </span>
          <span className="text-xs bg-indigo-50 text-indigo-800 font-semibold px-2.5 py-1 rounded border border-indigo-200">
            {issue.kategori}
          </span>
          <span className="text-xs text-slate-500 font-mono ml-auto">
            {new Date(issue.first_seen).toLocaleTimeString("id-ID")} WIB
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-4">
          {issue.judul}
        </h1>

        {/* AI Summary Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Ringkasan AI
          </div>
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-medium">
            {issue.ringkasan}
          </p>
          {issue.hal_belum_diketahui && (
            <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Hal Belum Diketahui:</span>{" "}
              {issue.hal_belum_diketahui}
            </div>
          )}
        </div>

        {/* Two Columns: Sources List (Left) and AI Labels + Actions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Sources List (Slide 11 Mockup) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Sumber &bull; {issue.items.length || 12} unik dari {issue.current_volume || 85} konten
              </h2>
              <span className="text-xs text-slate-500">
                {issue.repost_count} repost dihitung terpisah
              </span>
            </div>

            <div className="space-y-3">
              {issue.items.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded border border-slate-200 text-xs text-slate-500">
                  Data konten mentah terarsip.
                </div>
              ) : (
                issue.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-bold text-slate-900">{item.penerbit}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono">
                          {new Date(item.published_at).toLocaleTimeString("id-ID")}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                          kredibel
                        </span>
                      </div>
                    </div>
                    <div className="font-semibold text-sm text-slate-800 leading-snug">
                      {item.judul}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.isi}</p>
                    {item.url_kanonik && (
                      <a
                        href={item.url_kanonik}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium"
                      >
                        Tautan Asli <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Col: AI Labels Box & Analyst Decision (Slide 11 Mockup) */}
          <div className="space-y-6">
            {/* AI Labels Card */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-5">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200">
                Label AI
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-1">Sentimen</span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-red-600 capitalize">Negatif</span>
                    <span className="font-mono font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      0,82
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Lokasi</span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Kemang &amp; Pejaten</span>
                    <span className="font-mono font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      0,71
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Status Verifikasi</span>
                  <span className="font-bold text-xs capitalize bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                    {issue.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Analyst Review & Actions */}
            <div className="bg-white rounded-lg border border-slate-300 p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                Verifikasi Oleh Analis
              </h2>
              <p className="text-xs text-slate-500">
                Human-in-the-loop: Analis memeriksa keabsahan sinyal sebelum alert terdistribusi ke pimpinan.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Verifikasi / Bukti Fakta
                </label>
                <textarea
                  rows={3}
                  value={reviewerCatatan}
                  onChange={(e) => setReviewerCatatan(e.target.value)}
                  placeholder="Misal: Foto dicek bukan arsip lama. Dinas SDA konfirmasi pompa Kemang rusak..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Action Buttons from Slide 11 */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleDecision("verifikasi")}
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Verifikasi &bull; Kirim Alert ke Pimpinan
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecision("koreksi")}
                    disabled={submitting}
                    className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 rounded border border-slate-300 text-xs font-semibold transition-colors flex items-center justify-center"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" /> Koreksi Label
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision("tolak")}
                    disabled={submitting}
                    className="py-2 px-3 bg-white hover:bg-red-50 text-red-700 rounded border border-red-200 text-xs font-semibold transition-colors flex items-center justify-center"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Tolak
                  </button>
                </div>
              </div>
            </div>

            {/* 6-Factor Risk Score Breakdown */}
            {issue.alasan_skor && issue.alasan_skor.faktor && (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Transparansi Skor Risiko (0-100)
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-600">
                  {Object.entries(issue.alasan_skor.faktor).map(([key, f]: any) => (
                    <div key={key} className="flex justify-between items-center py-1 border-b border-slate-200/50">
                      <span className="capitalize">{key.replace("_", " ")} ({f.bobot})</span>
                      <span className="font-mono font-bold text-slate-900">{f.nilai}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
