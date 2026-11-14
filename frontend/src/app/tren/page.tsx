"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchSocialHeatmap,
  fetchSocialPulseOverview,
  fetchSocialTrends,
  onDataSynced,
  SocialHeatmap,
  SocialPulseOverview,
  SocialTrendingTopic,
} from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { periodLabel, platformLabel } from "@/lib/trendFilters";
import { useTrendFilters } from "@/components/trend/TrendFiltersContext";
import { TrendPageHeader } from "@/components/trend/TrendPageHeader";
import { EmptyState, ErrorPanel, Notice } from "@/components/ui";
import { Kpi, Section, StatusBadge } from "@/components/trend/TrendUi";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { TimelineBars } from "@/components/trend/TrendCharts";

const TREND_LIMIT = 50;
const RISING = new Set(["LONJAKAN TINGGI", "MENINGKAT"]);
const EARLY = new Set(["LONJAKAN TINGGI", "MENINGKAT", "BARU"]);
// Kategori yang biasanya bisa diangkat jadi konten hiburan/informasi, bukan isu sensitif.
const CONTENT_FRIENDLY = new Set(["kuliner", "wisata", "hiburan", "olahraga", "teknologi"]);

/** Baris tren yang bisa diklik untuk langsung dianalisis di menu AI. */
function TrendRow({ t, right }: { t: SocialTrendingTopic; right?: React.ReactNode }) {
  return (
    <li>
      <Link
        href={`/tren/ai?topik=${encodeURIComponent(t.topic_key)}`}
        className="group -mx-2 flex items-start justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
        title="Analisis tren ini dengan AI"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-100">{t.topic}</div>
          <div className="mt-0.5 truncate text-2xs text-zinc-500 dark:text-zinc-400">
            {t.hashtags.slice(0, 3).join(" ") || t.related_phrases.slice(0, 2).join(", ") || "-"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{fmtNum(t.mention_count)}</span>
          <Sparkles className="h-3.5 w-3.5 text-zinc-300 group-hover:text-fuchsia-500 dark:text-zinc-600" aria-hidden="true" />
        </div>
      </Link>
    </li>
  );
}

export default function TrenDashboardPage() {
  const { filters, ready, setFilters } = useTrendFilters();
  const [overview, setOverview] = useState<SocialPulseOverview | null>(null);
  const [trends, setTrends] = useState<SocialTrendingTopic[]>([]);
  const [heatmap, setHeatmap] = useState<SocialHeatmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialError, setPartialError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPartialError(null);
    const { periode, lokasi, platform } = filters;
    const [ov, tr, hm] = await Promise.allSettled([
      fetchSocialPulseOverview(periode, lokasi, "context"),
      fetchSocialTrends(platform, periode, TREND_LIMIT, lokasi, "context"),
      fetchSocialHeatmap(periode, lokasi, "context", undefined, platform),
    ]);
    if (tr.status === "rejected") {
      setError(tr.reason instanceof Error ? tr.reason.message : "Data tren gagal dimuat");
    } else {
      setTrends(tr.value);
    }
    setOverview(ov.status === "fulfilled" ? ov.value : null);
    setHeatmap(hm.status === "fulfilled" ? hm.value : null);
    if (tr.status === "fulfilled" && (ov.status === "rejected" || hm.status === "rejected")) {
      setPartialError("Sebagian data (ringkasan atau wilayah) gagal dimuat. Angka yang tampil tetap dari data yang berhasil.");
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  useEffect(() => onDataSynced(load), [load]);

  const topics = useMemo(() => trends.filter((t) => t.topic_key !== "k:Lainnya"), [trends]);
  const byVolume = useMemo(() => [...topics].sort((a, b) => b.mention_count - a.mention_count), [topics]);
  const rising = topics.filter((t) => RISING.has(t.velocity_status));
  const early = useMemo(
    () => topics.filter((t) => EARLY.has(t.velocity_status)).sort((a, b) => b.velocity_score - a.velocity_score),
    [topics]
  );
  const contentIdeas = useMemo(
    () =>
      topics
        // Hanya kategori UTAMA topik: topik lalu lintas yang kebetulan menyebut aplikasi tidak
        // boleh terbaca sebagai "Teknologi & Digital".
        .filter((t) => CONTENT_FRIENDLY.has(t.categories[0]?.id ?? "") && (t.sentiment_pct?.negatif ?? 0) < 30)
        .slice(0, 6),
    [topics]
  );

  const platformTop = useMemo(() => {
    if (filters.platform !== "Semua") return null;
    const entries = Object.entries(overview?.platform_distribution || {}).sort((a, b) => b[1] - a[1]);
    return entries[0] || null;
  }, [overview, filters.platform]);

  const regionRows = (heatmap?.rows || []).filter((r) => r.total > 0).slice(0, 6);
  const baseline = overview?.baseline;
  const baselineThin = baseline && baseline.windows_available < baseline.windows_target;
  const trendCount =
    filters.platform === "Semua" && overview ? overview.trending_topics_count : topics.length;

  return (
    <div className="space-y-6">
      <TrendPageHeader
        title="Dashboard Tren"
        description="Ringkasan tren percakapan media sosial untuk lokasi, periode, dan platform yang dipilih."
      />

      {error ? (
        <ErrorPanel title="Data tren gagal dimuat" message={error} onRetry={load} />
      ) : loading ? (
        <div className="panel border border-zinc-200 p-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Memuat tren...
        </div>
      ) : topics.length === 0 ? (
        <EmptyState
          title={`Belum ada tren di ${filters.lokasiNama} untuk ${periodLabel(filters.periode).toLowerCase()}.`}
          description="Coba periode yang lebih panjang, platform lain, atau lokasi yang lebih luas."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {filters.periode !== "30d" && (
                <button
                  type="button"
                  onClick={() => setFilters({ periode: filters.periode === "today" ? "7d" : "30d" })}
                  className="min-h-[36px] rounded-md bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Lihat {filters.periode === "today" ? "7 hari" : "30 hari"}
                </button>
              )}
              {filters.platform !== "Semua" && (
                <button
                  type="button"
                  onClick={() => setFilters({ platform: "Semua" })}
                  className="min-h-[36px] rounded-md border border-zinc-300 px-4 text-xs font-bold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Semua platform
                </button>
              )}
            </div>
          }
        />
      ) : (
        <>
          {partialError && <Notice tone="error" message={partialError} onClose={() => setPartialError(null)} />}
          {baselineThin && (
            <Notice tone="info">
              Data pembanding baru {baseline!.windows_available} dari {baseline!.windows_target} periode, jadi sebagian
              besar tren masih berstatus &ldquo;Baru muncul&rdquo; dan status naik belum bisa diandalkan. Akurasinya membaik
              setelah pengumpulan berjalan beberapa hari lagi.
            </Notice>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi
              label="Tren terdeteksi"
              value={`${fmtNum(trendCount)}${filters.platform !== "Semua" && topics.length >= TREND_LIMIT - 1 ? "+" : ""}`}
              hint={overview ? `${fmtNum(overview.total_mentions)} postingan` : undefined}
            />
            <Kpi label="Tren naik" value={fmtNum(rising.length)} hint={`${fmtNum(early.length - rising.length)} baru muncul`} />
            <Kpi label="Topik terbanyak" value={byVolume[0]?.topic ?? "-"} hint={byVolume[0] ? `${fmtNum(byVolume[0].mention_count)} postingan` : undefined} />
            <Kpi
              label="Platform teraktif"
              value={platformTop ? platformLabel(platformTop[0]) : platformLabel(filters.platform)}
              hint={platformTop ? `${fmtNum(platformTop[1])} postingan` : "Sesuai filter"}
            />
            <Kpi
              label="Wilayah teraktif"
              value={regionRows[0]?.region.replace(/ \(tingkat provinsi\)$/, "") ?? "-"}
              hint={regionRows[0] ? `${fmtNum(regionRows[0].total)} postingan` : "Lokasi belum terdeteksi"}
            />
            <Kpi
              label="Sentimen negatif"
              value={overview ? `${fmtNum(overview.negative_ratio_pct, 1)}%` : "-"}
              hint="Dari seluruh postingan"
            />
          </div>

          {overview && overview.timeline.length > 0 && (
            <Section
              title="Volume percakapan"
              hint={`Jumlah postingan per interval, ${overview.period?.label ?? ""}${
                filters.platform !== "Semua" ? " (semua platform)" : ""
              }. Arahkan kursor ke batang untuk melihat angkanya.`}
            >
              <TimelineBars points={overview.timeline} />
            </Section>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Tren naik dan mulai viral" hint="Diurutkan dari laju tercepat dibanding periode sebelumnya.">
              {early.length === 0 ? (
                <p className="text-xs text-zinc-500">Tidak ada tren yang sedang naik.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {early.slice(0, 7).map((t) => (
                    <TrendRow key={t.topic_key} t={t} right={<StatusBadge status={t.velocity_status} />} />
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Topik paling banyak dibicarakan" hint="Jumlah postingan per topik.">
              <ul className="space-y-2">
                {byVolume.slice(0, 8).map((t) => (
                  <li key={t.topic_key}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{t.topic}</span>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{fmtNum(t.mention_count)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-1.5 rounded bg-sky-500"
                        style={{ width: `${Math.max(4, (t.mention_count / (byVolume[0]?.mention_count || 1)) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="Topik yang cocok dibuat konten"
              hint={
                <>
                  Dipilih otomatis dari kategori kuliner, wisata, hiburan, olahraga, dan teknologi dengan sentimen negatif
                  di bawah 30%.{" "}
                  <Link href="/tren/ai" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
                    Minta rekomendasi AI
                  </Link>
                </>
              }
            >
              {contentIdeas.length === 0 ? (
                <p className="text-xs text-zinc-500">Belum ada topik dari kategori tersebut pada filter ini.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {contentIdeas.map((t) => (
                    <TrendRow
                      key={t.topic_key}
                      t={t}
                      right={
                        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-2xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                          {t.categories[0]?.label}
                        </span>
                      }
                    />
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Wilayah dengan aktivitas tertinggi"
              hint={
                heatmap
                  ? `Lokasi terdeteksi pada ${fmtNum(heatmap.located)} dari ${fmtNum(heatmap.total)} postingan.`
                  : undefined
              }
            >
              {regionRows.length === 0 ? (
                <p className="text-xs text-zinc-500">Lokasi postingan belum terdeteksi untuk filter ini.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {regionRows.map((r) => (
                    <li key={r.region} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.region.replace(/ \(tingkat provinsi\)$/, "")}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        {fmtNum(r.total)} postingan
                        {r.negative > 0 && <span className="ml-2 text-red-600 dark:text-red-400">{fmtNum(r.negative)} negatif</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
