"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchIssueDetail, submitIssueReview, IssueDetail } from "@/lib/api";
import { ThreatLevelPill, SourceBadge } from "@/components/RadarUi";

export default function IssueDetailPage() {
  const params = useParams();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleDecision = async (
    keputusan: "verifikasi" | "koreksi" | "tolak"
  ) => {
    if (!issue) return;
    setSubmitting(true);
    setActionSuccess(null);
    try {
      await submitIssueReview(issue.id, {
        reviewer_id: "analis_01",
        reviewer_nama: "Analis Piket Krisis (Budi Santoso)",
        keputusan,
        catatan:
          reviewerCatatan ||
          (keputusan === "verifikasi"
            ? "Fakta dan lokasi telah diverifikasi analis ke instansi terkait."
            : ""),
      });
      setActionSuccess(
        `Keputusan "${keputusan.toUpperCase()}" berhasil disimpan dan tercatat di audit log.`
      );
      await loadDetail();
    } catch (err: any) {
      alert(err.message || "Gagal memproses verifikasi");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="panel p-12 text-center">
        <div className="inline-block w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-200">
          Memindai Berkas Isu &amp; Kredibilitas Sumber...
        </p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="panel border-red-500/40 p-8 max-w-lg mx-auto my-8 bg-red-950/20">
        <h2 className="text-base font-bold text-red-400">Isu Tidak Ditemukan</h2>
        <p className="text-xs text-slate-300 mt-1 mb-4">
          {error || "Data isu tidak tersedia dalam basis data radar."}
        </p>
        <Link
          href="/isu"
          className="text-sky-400 text-xs font-bold hover:underline"
        >
          &larr; Kembali ke daftar antrean isu
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-[#1E2A4A]/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-sky-400">
            RADAR INCIDENT &bull; #{issue.kode_referensi}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
            Verifikasi Analis &amp; Bukti Sumber
          </h1>
        </div>
        <Link
          href="/isu"
          className="text-xs font-mono font-bold text-slate-300 hover:text-white bg-[#10172E] px-3.5 py-2 rounded-lg border border-[#1E2A4A] transition-colors"
        >
          &larr; Kembali ke Antrean
        </Link>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {actionSuccess}
        </div>
      )}

      {/* Main Split: Incident Evidence & Analyst Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 8 Cols: Issue Dossier & Real News Items */}
        <section className="lg:col-span-8 panel p-6 sm:p-7 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1E2A4A]">
            <div className="flex flex-wrap items-center gap-2.5">
              <ThreatLevelPill level={issue.level} score={issue.skor} />
              <span className="text-xs font-mono text-slate-300">
                {issue.wilayah} &bull; {issue.kategori}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Pertama dilihat:{" "}
              {new Date(issue.first_seen).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              WIB
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
              {issue.judul}
            </h2>
          </div>

          {/* AI Intelligence Brief */}
          <div className="bg-[#16203C] border border-[#1E2A4A] rounded-xl p-4 space-y-1.5">
            <div className="text-[11px] font-mono font-bold tracking-wider uppercase text-sky-400">
              RINGKASAN INTELIJEN AI
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {issue.ringkasan}
            </p>
          </div>

          {/* Evidence Articles from Real Sources */}
          <div>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#1E2A4A]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Artikel Bukti &bull; {issue.items.length} Laporan Terverifikasi
              </h3>
              <span className="text-xs font-mono text-slate-400">
                Volume: {issue.current_volume} konten
              </span>
            </div>

            <div className="divide-y divide-[#1E2A4A]">
              {issue.items.length > 0 ? (
                issue.items.map((item) => (
                  <div key={item.id} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <SourceBadge source={item.penerbit} />
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(item.published_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        WIB
                      </span>
                    </div>

                    <a
                      href={item.url_kanonik}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-slate-100 hover:text-sky-300 transition-colors block"
                    >
                      {item.judul} &nearr;
                    </a>

                    {item.isi && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {item.isi}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  Belum ada artikel terhubung ke isu ini.
                </div>
              )}
            </div>
          </div>

          {/* 6-Factor Risk Score Breakdown */}
          {issue.alasan_skor && issue.alasan_skor.faktor && (
            <div className="pt-4 border-t border-[#1E2A4A]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 font-mono">
                Rincian 6 Faktor Skor Risiko ({Math.round(issue.skor)}/100)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {Object.entries(issue.alasan_skor.faktor).map(([key, f]: any) => (
                  <div
                    key={key}
                    className="p-3 rounded-lg bg-[#16203C] border border-[#1E2A4A] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 capitalize">
                      <span>{key.replace(/_/g, " ")}</span>
                      <span className="font-mono text-sky-400">
                        Bobot {f.bobot}
                      </span>
                    </div>
                    <div className="text-lg font-black font-mono text-white mt-1">
                      {f.nilai}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right 4 Cols: Verification Action Panel */}
        <section className="lg:col-span-4 panel p-6 space-y-6">
          <div className="pb-3 border-b border-[#1E2A4A]">
            <p className="text-[10px] font-mono font-bold tracking-widest uppercase text-sky-400">
              KEPUTUSAN ANALIS
            </p>
            <h2 className="text-base font-bold text-white mt-0.5">
              Status: <span className="capitalize">{issue.status}</span>
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="catatan-analis"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Catatan Verifikasi Lapangan
              </label>
              <textarea
                id="catatan-analis"
                rows={4}
                value={reviewerCatatan}
                onChange={(e) => setReviewerCatatan(e.target.value)}
                placeholder="Tuliskan hasil konfirmasi dengan unit dinas terkait atau catatan khusus..."
                className="w-full text-xs p-3 rounded-lg bg-[#16203C] border border-[#1E2A4A] text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleDecision("verifikasi")}
                disabled={submitting}
                className="w-full min-h-[42px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {submitting ? "Memproses..." : "Verifikasi Isu Valid"}
              </button>

              <button
                type="button"
                onClick={() => handleDecision("koreksi")}
                disabled={submitting}
                className="w-full min-h-[42px] px-4 py-2.5 bg-[#16203C] hover:bg-[#1E2A4A] text-slate-200 text-xs font-bold border border-[#1E2A4A] rounded-lg transition-colors disabled:opacity-50"
              >
                Koreksi Data / Label
              </button>

              <button
                type="button"
                onClick={() => handleDecision("tolak")}
                disabled={submitting}
                className="w-full min-h-[42px] px-4 py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs font-bold border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
              >
                Tolak Isu (False Alarm)
              </button>
            </div>
          </div>

          {/* Audit Trail Preview */}
          {issue.reviews && issue.reviews.length > 0 && (
            <div className="pt-4 border-t border-[#1E2A4A] space-y-2">
              <div className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400">
                RIWAYAT VERIFIKASI TERAKHIR
              </div>
              {issue.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3 bg-[#16203C] rounded-lg border border-[#1E2A4A] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-bold text-slate-200">
                      {rev.reviewer_nama}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-sky-400">
                      {rev.keputusan}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{rev.catatan}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
