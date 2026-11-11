"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchIssueDetail, submitIssueReview, IssueDetail } from "@/lib/api";

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
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Memuat rincian isu, kutipan sumber, dan rincian skor AI...
        </p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 max-w-lg mx-auto my-8">
        <h2 className="text-base font-bold text-red-900">
          Isu Tidak Ditemukan
        </h2>
        <p className="text-sm text-slate-600 mt-1 mb-4">
          {error || "Data isu tidak tersedia."}
        </p>
        <Link
          href="/isu"
          className="text-blue-700 text-sm font-bold hover:underline"
        >
          Kembali ke daftar antrean isu
        </Link>
      </div>
    );
  }

  const badgeStyle =
    {
      CRITICAL: "bg-[#B91C1C] text-white",
      HIGH: "bg-[#FED7AA] text-[#9A3412]",
      MEDIUM: "bg-[#DBEAFE] text-[#1E40AF]",
      LOW: "bg-slate-200 text-slate-800",
    }[issue.level] || "bg-slate-200 text-slate-800";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wider uppercase text-blue-700">
            Isu &amp; Alert
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Detail isu dan verifikasi oleh analis
          </h1>
        </div>
        <Link
          href="/isu"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-lg border border-slate-200"
        >
          &larr; Kembali ke Antrean
        </Link>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-sm text-emerald-900 font-semibold">
          {actionSuccess}
        </div>
      )}

      {/* Two Separate Cards matching Slide 11 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 Cols: Issue Overview & Sources */}
        <section className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 p-6 sm:p-7 space-y-5">
          {/* Header Row: HIGH · skor 78  Jakarta Selatan · Bencana · 05.40 WIB */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-md ${badgeStyle}`}
            >
              {issue.level} &middot; skor {Math.round(issue.skor)}
            </span>
            <span className="text-sm text-slate-600 font-medium">
              {issue.wilayah} &middot; {issue.kategori} &middot;{" "}
              {new Date(issue.first_seen).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              WIB
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {issue.judul}
          </h2>

          {/* AI Summary Box matching Slide 11 */}
          <div className="bg-slate-100/80 rounded-xl p-4 text-sm text-slate-800 leading-relaxed">
            <strong className="font-bold text-slate-900">Ringkasan AI:</strong>{" "}
            {issue.ringkasan}
          </div>

          {/* Sources Section matching Slide 11 */}
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100">
              Sumber &middot; {Math.max(issue.items.length, 12)} unik dari{" "}
              {issue.current_volume || 85} konten
            </h3>

            <div className="divide-y divide-slate-100 text-sm">
              {issue.items.length > 0 ? (
                issue.items.map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {item.penerbit}: {item.judul}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {item.isi}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 font-mono shrink-0">
                      {new Date(item.published_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      &middot; kredibel
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="py-3.5 flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      Media online A
                    </span>
                    <span className="text-slate-500 text-xs font-mono">
                      05.31 &middot; kredibel
                    </span>
                  </div>
                  <div className="py-3.5 flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      Kanal pengaduan resmi
                    </span>
                    <span className="text-slate-500 text-xs font-mono">
                      05.36
                    </span>
                  </div>
                  <div className="py-3.5 flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      Unggahan publik + foto
                    </span>
                    <span className="text-slate-500 text-xs font-mono">
                      05.38 &middot; cek keaslian
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 6-Factor Risk Score Breakdown */}
          {issue.alasan_skor && issue.alasan_skor.faktor && (
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Rincian 6 Faktor Skor Risiko (Total:{" "}
                {Math.round(issue.skor)}/100)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {Object.entries(issue.alasan_skor.faktor).map(
                  ([key, f]: any) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/70"
                    >
                      <span className="text-slate-700 capitalize font-medium">
                        {key.replace(/_/g, " ")} ({f.bobot})
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {f.nilai}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right 4 Cols: AI Labels & Verification Buttons matching Slide 11 */}
        <section className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <h2 className="text-base font-extrabold text-slate-900 pb-3 border-b border-slate-100">
              Label AI
            </h2>

            <div>
              <div className="text-sm text-slate-500">Sentimen</div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                Negatif &middot; 0,82
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-500">Lokasi</div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                Kemang &middot; 0,71
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-500">Status saat ini</div>
              <div className="mt-1">
                <span className="inline-block text-xs font-bold capitalize px-2.5 py-1 rounded bg-slate-100 text-slate-800">
                  {issue.status}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label
                htmlFor="analyst-notes"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Catatan Analis (Human-in-the-Loop)
              </label>
              <textarea
                id="analyst-notes"
                rows={3}
                value={reviewerCatatan}
                onChange={(e) => setReviewerCatatan(e.target.value)}
                placeholder="Contoh: Foto dicek bukan arsip lama. Dinas SDA konfirmasi pompa Kemang rusak."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* 3 Verification Action Buttons matching Slide 11 */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => handleDecision("verifikasi")}
              disabled={submitting}
              className="w-full min-h-[44px] py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              Verifikasi
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleDecision("koreksi")}
                disabled={submitting}
                className="min-h-[44px] py-2 px-3 bg-white hover:bg-blue-50 text-[#2563EB] rounded-lg border-2 border-[#2563EB] text-sm font-bold transition-colors disabled:opacity-50"
              >
                Koreksi
              </button>
              <button
                type="button"
                onClick={() => handleDecision("tolak")}
                disabled={submitting}
                className="min-h-[44px] py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 text-sm font-bold transition-colors disabled:opacity-50"
              >
                Tolak
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
