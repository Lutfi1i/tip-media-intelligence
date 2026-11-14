"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AuthUser,
  fetchCurrentUser,
  fetchIssueDetail,
  ISSUE_QUEUE_KEY,
  submitIssueReview,
  IssueDetail,
} from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { ThreatLevelPill, SourceBadge } from "@/components/RadarUi";
import { CaseStatusBadge, ConfirmDialog, IssueStatusBadge, Notice } from "@/components/ui";

type Keputusan = "verifikasi" | "koreksi" | "tolak";

const KEPUTUSAN_LABEL: Record<Keputusan, string> = {
  verifikasi: "Verifikasi",
  koreksi: "Koreksi",
  tolak: "Tolak",
};

export default function IssueDetailPage() {
  const params = useParams();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewerCatatan, setReviewerCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<Keputusan | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [nextIssueId, setNextIssueId] = useState<number | null>(null);

  useEffect(() => {
    fetchCurrentUser().then((res) => setAuthUser(res.user));
  }, []);

  // Isu berikutnya diambil dari urutan antrean terakhir yang dilihat pengguna.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(ISSUE_QUEUE_KEY);
      const ids: number[] = raw ? JSON.parse(raw) : [];
      const idx = ids.indexOf(Number(issueId));
      setNextIssueId(idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null);
    } catch {
      setNextIssueId(null);
    }
  }, [issueId]);

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

  const catatanWajib = (k: Keputusan) => k !== "verifikasi";

  const handleDecision = async (keputusan: Keputusan) => {
    if (!issue) return;
    if (catatanWajib(keputusan) && !reviewerCatatan.trim()) {
      setPending(null);
      setActionError(`Isi catatan dulu: alasan ${KEPUTUSAN_LABEL[keputusan].toLowerCase()} wajib dicatat untuk audit.`);
      document.getElementById("catatan-analis")?.focus();
      return;
    }
    setSubmitting(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await submitIssueReview(issue.id, {
        reviewer_id: authUser ? String(authUser.id) : "tanpa-login",
        reviewer_nama: authUser ? authUser.nama : "Pengguna tanpa login",
        keputusan,
        catatan:
          reviewerCatatan ||
          (keputusan === "verifikasi"
            ? "Fakta dan lokasi telah diverifikasi analis ke instansi terkait."
            : ""),
      });
      setActionSuccess(
        `Keputusan ${KEPUTUSAN_LABEL[keputusan]} tersimpan dan tercatat di audit trail.`
      );
      await loadDetail();
    } catch (err: any) {
      setActionError(err.message || "Gagal menyimpan keputusan");
    } finally {
      setSubmitting(false);
      setPending(null);
    }
  };

  if (loading) {
    return (
      <div className="panel p-16 text-center bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
        <div className="inline-block w-8 h-8 border-2 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">
          Memindai Berkas Isu &amp; Kredibilitas Sumber...
        </p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="panel border-red-500/40 p-8 max-w-lg mx-auto my-8 bg-red-500/5">
        <h2 className="text-base font-bold text-red-600 dark:text-red-400 font-mono">Isu Tidak Ditemukan</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono mt-1 mb-4">
          {error || "Data isu tidak tersedia dalam basis data radar."}
        </p>
        <Link
          href="/isu"
          className="text-zinc-900 dark:text-white text-xs font-mono font-bold hover:underline"
        >
          &larr; Kembali ke daftar antrean isu
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            Berkas isu &bull; {issue.kode_referensi}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
            Verifikasi Analis &amp; Bukti Sumber
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/isu"
            className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-3.5 py-2 rounded-md border border-zinc-300 dark:border-zinc-800 transition-colors"
          >
            &larr; Antrean
          </Link>
          {nextIssueId && (
            <Link
              href={`/isu/${nextIssueId}`}
              className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-3.5 py-2 rounded-md border border-zinc-300 dark:border-zinc-800 transition-colors"
            >
              Isu berikutnya &rarr;
            </Link>
          )}
        </div>
      </div>

      {actionSuccess && (
        <Notice tone="success" onClose={() => setActionSuccess(null)}>
          {actionSuccess}
          {nextIssueId && (
            <>
              {" "}
              <Link href={`/isu/${nextIssueId}`} className="underline underline-offset-2 font-bold">
                Lanjut ke isu berikutnya
              </Link>
            </>
          )}
        </Notice>
      )}
      {actionError && <Notice tone="error" message={actionError} onClose={() => setActionError(null)} />}

      {/* Main Split: Incident Evidence & Analyst Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 8 Cols: Issue Dossier & Real News Items */}
        <section className="lg:col-span-8 panel p-6 sm:p-7 space-y-6 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2.5">
              <ThreatLevelPill level={issue.level} score={issue.skor} />
              <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                {issue.wilayah} &bull; {issue.kategori}
              </span>
            </div>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              Pertama terdeteksi: {fmtDateTime(issue.first_seen)}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">
              {issue.judul}
            </h2>
          </div>

          {/* AI Intelligence Brief */}
          <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-1.5">
            <div className="text-[11px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
              RINGKASAN INTELIJEN AI &amp; PEDOMAN LAPANGAN
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-mono">
              {issue.ringkasan}
            </p>
          </div>

          {/* Evidence Articles from Real Sources */}
          <div>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 font-mono">
                Artikel Bukti &bull; {issue.items.length} Laporan Terverifikasi
              </h3>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Volume: {issue.current_volume} konten
              </span>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {issue.items.length > 0 ? (
                issue.items.map((item) => (
                  <div key={item.id} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <SourceBadge source={item.penerbit} />
                      <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        {fmtDateTime(item.published_at)}
                      </span>
                    </div>

                    <a
                      href={item.url_kanonik}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:underline transition-colors block"
                    >
                      {item.judul} ↗
                    </a>

                    {item.isi && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {item.isi}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-zinc-400 font-mono">
                  Belum ada artikel terhubung ke isu ini.
                </div>
              )}
            </div>
          </div>

          {/* 6-Factor Risk Score Breakdown */}
          {issue.alasan_skor && issue.alasan_skor.faktor && (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 font-mono">
                Rincian 6 Faktor Skor Risiko ({Math.round(issue.skor)}/100)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                {Object.entries(issue.alasan_skor.faktor).map(([key, f]: any) => (
                  <div
                    key={key}
                    className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                      <span>{key.replace(/_/g, " ")}</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">
                        Bobot {f.bobot}
                      </span>
                    </div>
                    <div className="text-lg font-black font-mono text-zinc-900 dark:text-white mt-1">
                      {f.nilai}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right 4 Cols: Verification Action Panel */}
        <section className="lg:col-span-4 panel p-6 space-y-6 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <p className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
              KEPUTUSAN ANALIS
            </p>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white mt-1 font-mono flex items-center gap-2">
              Status: <IssueStatusBadge status={issue.status} />
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
              Dicatat atas nama{" "}
              <strong className="text-zinc-700 dark:text-zinc-300">
                {authUser ? authUser.nama : "pengguna tanpa login"}
              </strong>
              .
            </p>
          </div>

          {issue.case && (
            <Link
              href={`/kasus?kasus=${issue.case.id}`}
              className="block p-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
                  Kasus #{issue.case.id}
                </span>
                <CaseStatusBadge status={issue.case.status} />
              </div>
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-1">
                {issue.case.pic_nama ? `PIC: ${issue.case.pic_nama}` : "Belum ada PIC"} &bull; tenggat{" "}
                {fmtDateTime(issue.case.tenggat)}
              </div>
              <div className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 mt-1.5">
                Kelola di Papan Kasus &rarr;
              </div>
            </Link>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="catatan-analis"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5 font-mono"
              >
                Catatan Verifikasi Lapangan
              </label>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1.5">
                Wajib diisi untuk Koreksi dan Tolak.
              </p>
              <textarea
                id="catatan-analis"
                rows={4}
                value={reviewerCatatan}
                onChange={(e) => setReviewerCatatan(e.target.value)}
                placeholder="Tuliskan hasil konfirmasi dengan unit dinas terkait atau catatan khusus..."
                className="w-full text-xs p-3 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-2 font-mono">
              <button
                type="button"
                onClick={() => handleDecision("verifikasi")}
                disabled={submitting}
                className="w-full min-h-[42px] px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-md transition-colors disabled:opacity-50 shadow-xs"
              >
                {submitting ? "Memproses..." : "Verifikasi Isu Valid"}
              </button>

              <button
                type="button"
                onClick={() => setPending("koreksi")}
                disabled={submitting}
                className="w-full min-h-[42px] px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold border border-zinc-300 dark:border-zinc-800 rounded-md transition-colors disabled:opacity-50"
              >
                Koreksi Data / Label
              </button>

              <button
                type="button"
                onClick={() => setPending("tolak")}
                disabled={submitting}
                className="w-full min-h-[42px] px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 text-xs font-bold border border-red-500/30 rounded-md transition-colors disabled:opacity-50"
              >
                Tolak Isu (False Alarm)
              </button>
            </div>
          </div>

          {/* Audit Trail Preview */}
          {issue.reviews && issue.reviews.length > 0 && (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="text-[10px] font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                RIWAYAT VERIFIKASI TERAKHIR
              </div>
              {issue.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-mono space-y-1"
                >
                  <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {rev.reviewer_nama}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-zinc-700 dark:text-zinc-300">
                      {rev.keputusan}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">{rev.catatan}</p>
                  <p className="text-zinc-400 text-[10px]">{fmtDateTime(rev.waktu)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending === "tolak" ? "Tolak isu ini?" : "Simpan koreksi?"}
        confirmLabel={pending === "tolak" ? "Ya, tolak isu" : "Ya, simpan koreksi"}
        tone={pending === "tolak" ? "danger" : "default"}
        busy={submitting}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && handleDecision(pending)}
      >
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            {pending === "tolak"
              ? "Isu ditandai sebagai false alarm dan keluar dari antrean prioritas."
              : "Label isu ditandai dikoreksi oleh analis."}
          </p>
          <p className="text-xs">
            Catatan:{" "}
            {reviewerCatatan.trim() ? (
              <span className="text-zinc-800 dark:text-zinc-200">{reviewerCatatan.trim()}</span>
            ) : (
              <span className="text-red-600 dark:text-red-400 font-semibold">belum diisi (wajib)</span>
            )}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
