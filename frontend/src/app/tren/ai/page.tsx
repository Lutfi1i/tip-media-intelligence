"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { fetchSocialTrends, SocialTrendingTopic } from "@/lib/api";
import { fmtNum, fmtRelative } from "@/lib/format";
import { platformLabel } from "@/lib/trendFilters";
import { analyzeTopic, summarizeTrends, TopicAnalysis, TrendSummary } from "@/lib/trendApi";
import { useTrendFilters } from "@/components/trend/TrendFiltersContext";
import { TrendPageHeader } from "@/components/trend/TrendPageHeader";
import { PostItem, Section, SentimentBar, StatusBadge, TrendState, useTrendData } from "@/components/trend/TrendUi";
import { Notice } from "@/components/ui";

const btnPrimary =
  "inline-flex min-h-[38px] items-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const btnGhost =
  "inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      setDone(false);
    }
  };
  return (
    <button type="button" onClick={copy} className={btnGhost}>
      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {done ? "Tersalin" : label}
    </button>
  );
}

function AiMeta({ meta, cache }: { meta?: { model: string; token: number | null; dibuat: string }; cache?: boolean }) {
  if (!meta) return null;
  return (
    <p className="text-2xs text-zinc-500 dark:text-zinc-400">
      Dibuat AI ({meta.model}) {fmtRelative(meta.dibuat)}
      {cache ? ", dari cache" : ""}. Periksa dengan postingan sumber sebelum dipakai.
    </p>
  );
}

const POTENSI_CLS: Record<string, string> = {
  tinggi: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  sedang: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  rendah: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function AiTrendPage() {
  const { filters } = useTrendFilters();
  const trends = useTrendData<SocialTrendingTopic[]>((f) => fetchSocialTrends(f.platform, f.periode, 20, f.lokasi, "context"));
  const [summary, setSummary] = useState<TrendSummary | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TopicAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ?topik=... dari Dashboard: dibaca saat mount, sebelum provider filter menulis ulang URL.
  const pendingTopic = useRef<string | null>(null);
  useEffect(() => {
    pendingTopic.current = new URLSearchParams(window.location.search).get("topik");
  }, []);

  // Hasil lama tidak berlaku lagi bila filter berubah.
  useEffect(() => {
    setSummary(null);
    setAnalysis(null);
    setSelected(null);
    setErr(null);
    setSummaryErr(null);
  }, [filters]);

  useEffect(() => {
    const key = pendingTopic.current;
    if (!key || !trends.data) return;
    pendingTopic.current = null;
    if (trends.data.some((t) => t.topic_key === key)) runAnalysis(key);
    else {
      setSelected(key);
      setErr("Tren yang dipilih dari Dashboard tidak ada pada filter ini. Pilih tren lain dari daftar.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trends.data]);

  const runSummary = async (refresh = false) => {
    setSummaryBusy(true);
    setSummaryErr(null);
    try {
      setSummary(await summarizeTrends(filters, refresh));
    } catch (e) {
      setSummaryErr(e instanceof Error ? e.message : "Ringkasan gagal dibuat");
    } finally {
      setSummaryBusy(false);
    }
  };

  const runAnalysis = async (key: string, refresh = false) => {
    setSelected(key);
    setBusy(true);
    setErr(null);
    if (!refresh) setAnalysis(null);
    try {
      setAnalysis(await analyzeTopic(filters, key, refresh));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analisis gagal");
    } finally {
      setBusy(false);
    }
  };

  const ai = analysis?.ai;

  return (
    <div className="space-y-6">
      <TrendPageHeader
        title="Analisis AI"
        description="Ringkasan tren, penyebab viral, ide konten, caption, hashtag, dan brief video dari AI, berdasarkan postingan yang terkumpul."
      />

      <Section
        title="Ringkasan tren otomatis"
        hint="Merangkum hingga 8 tren teratas untuk filter saat ini."
        actions={
          <button type="button" onClick={() => runSummary(!!summary)} disabled={summaryBusy} className={btnPrimary}>
            {summaryBusy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            {summaryBusy ? "Merangkum..." : summary ? "Buat ulang" : "Buat ringkasan"}
          </button>
        }
      >
        {summaryErr && <Notice tone="error" message={summaryErr} />}
        {!summary ? (
          <p className="text-xs text-zinc-500">Klik &ldquo;Buat ringkasan&rdquo; untuk meminta AI merangkum tren saat ini.</p>
        ) : summary.ai ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{summary.ai.ringkasan}</p>
            {summary.ai.poin.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {summary.ai.poin.map((p, i) => (
                  <li key={i}>
                    <strong className="text-zinc-900 dark:text-zinc-100">{p.topik}:</strong>{" "}
                    <span className="text-zinc-700 dark:text-zinc-300">{p.insight}</span>
                  </li>
                ))}
              </ul>
            )}
            {summary.ai.rekomendasi_topik.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Rekomendasi topik untuk dibuat konten</h3>
                <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                  {summary.ai.rekomendasi_topik.map((r, i) => (
                    <li key={i} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.topik}</div>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{r.alasan}</p>
                      {r.platform && r.platform.length > 0 && (
                        <p className="mt-1 text-2xs text-zinc-500">Platform: {r.platform.join(", ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <AiMeta meta={summary.ai_meta} cache={summary.cache} />
          </div>
        ) : (
          <Notice tone="info" message={summary.ai_error || "AI tidak tersedia."} />
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Section title="Pilih tren" hint="Diurutkan dari laju tercepat.">
            <TrendState loading={trends.loading} error={trends.error} hasData={!!trends.data} onRetry={trends.reload}>
              {trends.data && trends.data.length === 0 ? (
                <p className="text-xs text-zinc-500">Belum ada tren untuk filter ini.</p>
              ) : (
                <ul className="-mx-2 max-h-[32rem] overflow-y-auto">
                  {trends.data?.map((t) => (
                    <li key={t.topic_key}>
                      <button
                        type="button"
                        onClick={() => runAnalysis(t.topic_key)}
                        disabled={busy}
                        aria-pressed={selected === t.topic_key}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm ${
                          selected === t.topic_key ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-zinc-900 dark:text-zinc-100">{t.topic}</span>
                          <span className="text-2xs text-zinc-500">{fmtNum(t.mention_count)} postingan</span>
                        </span>
                        <StatusBadge status={t.velocity_status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TrendState>
          </Section>
        </div>

        <div className="space-y-5 lg:col-span-8">
          {!selected ? (
            <div className="panel flex min-h-[12rem] items-center justify-center border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Pilih tren di sebelah kiri untuk dianalisis.
            </div>
          ) : busy && !analysis ? (
            <div className="panel border border-zinc-200 p-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
              <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden="true" />
              Menganalisis tren...
            </div>
          ) : err ? (
            <Notice tone="error" message={err} onRetry={() => runAnalysis(selected)} />
          ) : analysis ? (
            <>
              <Section
                title={analysis.topik}
                hint={`${fmtNum(analysis.postingan)} postingan di ${analysis.platform.map(platformLabel).join(", ")}`}
                actions={
                  ai && (
                    <button type="button" onClick={() => runAnalysis(analysis.topic_key, true)} disabled={busy} className={btnGhost}>
                      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
                      Analisis ulang
                    </button>
                  )
                }
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Deteksi tren</h3>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <StatusBadge status={analysis.status} growth={analysis.pertumbuhan_pct} />
                      {analysis.tren_baru && <span className="text-xs text-zinc-600 dark:text-zinc-300">Baru muncul pada periode ini</span>}
                    </div>
                    <h3 className="mt-3 text-xs font-bold text-zinc-500 dark:text-zinc-400">Prediksi</h3>
                    <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                      <strong className="capitalize">{analysis.prediksi.arah}</strong>. {analysis.prediksi.alasan}
                    </p>
                    <p className="mt-0.5 text-2xs text-zinc-500">{analysis.prediksi.catatan}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Sentimen</h3>
                    <div className="mt-2">
                      <SentimentBar pct={analysis.sentimen_pct} />
                    </div>
                    {ai?.sentimen && <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{ai.sentimen}</p>}
                  </div>
                </div>
              </Section>

              {!ai ? (
                <Notice tone="info" message={analysis.ai_error || "Bagian AI tidak tersedia."} />
              ) : (
                <>
                  <Section title="Ringkasan dan penyebab viral">
                    <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{ai.ringkasan}</p>
                    {ai.penyebab_viral.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                        {ai.penyebab_viral.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Potensi konten</span>
                      <span className={`rounded px-1.5 py-0.5 text-2xs font-bold capitalize ${POTENSI_CLS[ai.potensi_konten.tingkat] || POTENSI_CLS.rendah}`}>
                        {ai.potensi_konten.tingkat}
                      </span>
                      <span className="text-zinc-700 dark:text-zinc-300">{ai.potensi_konten.alasan}</span>
                    </div>
                  </Section>

                  <Section title="Ide konten">
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {ai.ide_konten.map((idea, i) => (
                        <li key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{idea.judul}</div>
                          <div className="mt-1 text-2xs text-zinc-500">
                            {idea.format}
                            {idea.platform.length > 0 && ` di ${idea.platform.join(", ")}`}
                          </div>
                          <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">{idea.alasan}</p>
                        </li>
                      ))}
                    </ul>
                  </Section>

                  <Section
                    title="Caption dan hashtag"
                    actions={
                      <div className="flex gap-2">
                        <CopyButton text={ai.caption} label="Salin caption" />
                        <CopyButton text={ai.hashtag.join(" ")} label="Salin hashtag" />
                      </div>
                    }
                  >
                    <p className="whitespace-pre-line rounded-md bg-zinc-50 p-3 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">{ai.caption}</p>
                    <p className="mt-2 text-sm font-semibold text-sky-700 dark:text-sky-400">{ai.hashtag.join(" ")}</p>
                  </Section>

                  <Section
                    title={`Brief video: ${ai.brief_video.judul || analysis.topik}`}
                    hint={ai.brief_video.durasi_detik ? `Durasi sekitar ${ai.brief_video.durasi_detik} detik` : undefined}
                    actions={
                      <CopyButton
                        label="Salin brief"
                        text={[
                          ai.brief_video.judul,
                          `Hook: ${ai.brief_video.hook}`,
                          ...ai.brief_video.adegan.map((a) => `${a.detik} | ${a.visual} | ${a.narasi}`),
                          `CTA: ${ai.brief_video.cta}`,
                        ].join("\n")}
                      />
                    }
                  >
                    <p className="text-sm"><strong>Hook:</strong> {ai.brief_video.hook}</p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-zinc-500">
                          <tr className="border-b border-zinc-200 dark:border-zinc-800">
                            <th className="py-1.5 pr-3">Detik</th>
                            <th className="py-1.5 pr-3">Visual</th>
                            <th className="py-1.5">Narasi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {ai.brief_video.adegan.map((a, i) => (
                            <tr key={i} className="align-top">
                              <td className="py-1.5 pr-3 font-mono text-xs">{a.detik}</td>
                              <td className="py-1.5 pr-3 text-zinc-700 dark:text-zinc-300">{a.visual}</td>
                              <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{a.narasi}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-sm"><strong>Ajakan:</strong> {ai.brief_video.cta}</p>
                  </Section>
                  <AiMeta meta={analysis.ai_meta} cache={analysis.cache} />
                </>
              )}

              <Section title="Postingan sumber" hint="Postingan yang dikirim ke AI sebagai bahan analisis. Nomor [id] di analisis merujuk ke sini.">
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {analysis.sumber.map((p) => (
                    <PostItem key={p.id} p={p} extra={<span className="shrink-0 font-mono text-2xs text-zinc-400">[{p.id}]</span>} />
                  ))}
                </ul>
              </Section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
