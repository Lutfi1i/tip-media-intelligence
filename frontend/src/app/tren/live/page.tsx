"use client";

import { useEffect, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { searchSocialContent, SocialSearchResult, triggerLiveSocialFetch, DATA_SYNCED_EVENT } from "@/lib/api";
import { fmtNum, fmtRelative, fmtTime } from "@/lib/format";
import { platformLabel } from "@/lib/trendFilters";
import { fetchLiveStats } from "@/lib/trendApi";
import { useTrendFilters } from "@/components/trend/TrendFiltersContext";
import { TrendPageHeader } from "@/components/trend/TrendPageHeader";
import { Kpi, Section, SentimentBar, TrendState, useTrendData } from "@/components/trend/TrendUi";
import { Notice } from "@/components/ui";

const AUTO_REFRESH_MS = 60_000;

const SENTIMENT_TEXT: Record<string, string> = {
  positif: "text-emerald-700 dark:text-emerald-400",
  negatif: "text-red-700 dark:text-red-400",
  campuran: "text-amber-700 dark:text-amber-400",
  netral: "text-zinc-500 dark:text-zinc-400",
};

export default function LiveMonitoringPage() {
  const { filters } = useTrendFilters();
  const stats = useTrendData(fetchLiveStats);
  const feed = useTrendData<SocialSearchResult>((f) =>
    searchSocialContent(
      {
        time_range: f.periode,
        scope_kode: f.lokasi,
        scope_mode: "context",
        platform: f.platform === "Semua" ? "" : f.platform,
        q: "",
        category: "",
        agency: "",
        emotion: "",
        sentimen: "",
        author: "",
        sort: "terbaru",
      },
      1,
      30
    )
  );
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  const reloadStats = stats.reload;
  const reloadFeed = feed.reload;
  // Muat ulang otomatis tiap menit saat tab terlihat.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        reloadStats();
        reloadFeed();
      }
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [reloadStats, reloadFeed]);

  const pullNow = async () => {
    setPulling(true);
    setPullMsg(null);
    try {
      const res = await triggerLiveSocialFetch(filters.lokasi, filters.platform, undefined, true);
      setPullMsg(
        res.errors.length
          ? { tone: "error", text: `Sebagian sumber gagal: ${res.errors.slice(0, 2).join("; ")}. ${res.baru} postingan baru masuk.` }
          : { tone: res.baru ? "success" : "info", text: res.baru ? `${res.baru} postingan baru masuk dari ${res.dibaca} yang dibaca.` : `Tidak ada postingan baru (${res.dibaca} dibaca, semuanya sudah tersimpan).` }
      );
      window.dispatchEvent(new Event(DATA_SYNCED_EVENT));
    } catch (e) {
      setPullMsg({ tone: "error", text: e instanceof Error ? e.message : "Gagal menarik data" });
    } finally {
      setPulling(false);
    }
  };

  const s = stats.data;
  const maxWord = Math.max(1, ...(s?.kata_teratas.map((k) => k.jumlah) || [1]));
  const maxPlatform = Math.max(1, ...Object.values(s?.aktivitas.platform || { x: 1 }));

  return (
    <div className="space-y-6">
      <TrendPageHeader
        title="Percakapan Live"
        description="Percakapan terbaru: jumlah postingan, interaksi, sentimen, kata yang sering muncul, platform, dan lokasi. Diperbarui otomatis tiap menit."
        actions={
          <button
            type="button"
            onClick={pullNow}
            disabled={pulling}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <RefreshCw className={`h-4 w-4 ${pulling ? "animate-spin" : ""}`} aria-hidden="true" />
            {pulling ? "Menarik..." : `Tarik data ${filters.lokasiNama}`}
          </button>
        }
      />

      {pullMsg && <Notice tone={pullMsg.tone} message={pullMsg.text} onClose={() => setPullMsg(null)} />}

      <TrendState loading={stats.loading} error={stats.error} hasData={!!s} onRetry={stats.reload}>
        {s && (
          <>
            {s.sorotan && (
              <div className="panel border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                Paling ramai dibicarakan: <strong>{s.sorotan.topik}</strong> ({fmtNum(s.sorotan.postingan)} postingan
                {s.sorotan.lokasi ? `, terutama di ${s.sorotan.lokasi}` : ""}
                {s.sorotan.sentimen_negatif_pct > 0 ? `, ${fmtNum(s.sorotan.sentimen_negatif_pct, 1)}% bernada negatif` : ""}).
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Postingan" value={fmtNum(s.aktivitas.postingan)} hint={s.periode.label} />
              <Kpi
                label="Interaksi"
                value={s.aktivitas.engagement.interactions === null ? "tidak tersedia" : fmtNum(s.aktivitas.engagement.interactions)}
                hint={`Dari ${fmtNum(s.aktivitas.engagement.posts_with_data)} postingan yang punya metrik`}
              />
              <Kpi label="Akun unik" value={fmtNum(s.aktivitas.akun_unik)} />
              <Kpi
                label="Lokasi terdeteksi"
                value={`${fmtNum(s.lokasi_terdeteksi)} postingan`}
                hint={`dari ${fmtNum(s.aktivitas.postingan)} postingan`}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Section title="Sentimen">
                <SentimentBar pct={s.aktivitas.sentimen_pct} />
              </Section>

              <Section title="Sumber platform">
                <ul className="space-y-2">
                  {Object.entries(s.aktivitas.platform).map(([name, n]) => (
                    <li key={name}>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-700 dark:text-zinc-300">{platformLabel(name)}</span>
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{fmtNum(n)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-1.5 rounded" style={{ width: `${(n / maxPlatform) * 100}%`, background: "var(--series-1)" }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Lokasi yang terdeteksi">
                {s.lokasi_teratas.length === 0 ? (
                  <p className="text-xs text-zinc-500">Belum ada lokasi yang terdeteksi.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {s.lokasi_teratas.map((l) => (
                      <li key={l.nama} className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 truncate text-zinc-700 dark:text-zinc-300">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                          {l.nama}
                        </span>
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{fmtNum(l.postingan)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <Section title="Kata yang sering muncul" hint="Hashtag dan frasa yang dipakai minimal dua akun atau sumber berbeda.">
              {s.kata_teratas.length === 0 ? (
                <p className="text-xs text-zinc-500">Belum ada kata yang dipakai lebih dari satu sumber.</p>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                  {s.kata_teratas.map((k) => (
                    <span
                      key={k.key}
                      className="font-semibold text-zinc-800 dark:text-zinc-100"
                      style={{ fontSize: `${0.75 + (k.jumlah / maxWord) * 0.75}rem` }}
                      title={`${k.jumlah} postingan dari ${k.sumber} sumber`}
                    >
                      {k.label}
                    </span>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </TrendState>

      <Section
        title="Postingan terbaru"
        hint={feed.data ? `${fmtNum(feed.data.total)} postingan pada periode ini, 30 terbaru ditampilkan.` : undefined}
      >
        {feed.error && !feed.data ? (
          <p className="text-xs text-red-600 dark:text-red-400">{feed.error}</p>
        ) : !feed.data ? (
          <p className="text-xs text-zinc-500">Memuat postingan...</p>
        ) : feed.data.items.length === 0 ? (
          <p className="text-xs text-zinc-500">Belum ada postingan untuk filter ini.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {feed.data.items.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">{platformLabel(p.platform)}</span>
                  <span>{p.penulis || p.penerbit || "akun tidak diketahui"}</span>
                  <span title={fmtTime(p.published_at)}>{fmtRelative(p.published_at)}</span>
                  {p.lokasi && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {p.lokasi}
                    </span>
                  )}
                  <span className={`font-semibold capitalize ${SENTIMENT_TEXT[p.sentimen] || SENTIMENT_TEXT.netral}`}>{p.sentimen}</span>
                </div>
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 line-clamp-3 block break-words text-sm font-semibold text-zinc-900 [overflow-wrap:anywhere] hover:underline dark:text-zinc-100"
                  >
                    {p.judul}
                  </a>
                ) : (
                  <p className="mt-1 line-clamp-3 break-words text-sm font-semibold text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100">{p.judul}</p>
                )}
                {(p.engagement.views !== null || p.engagement.interactions !== null) && (
                  <div className="mt-1 flex gap-4 text-2xs text-zinc-500 dark:text-zinc-400">
                    {p.engagement.views !== null && <span>{fmtNum(p.engagement.views)} views</span>}
                    {p.engagement.interactions !== null && <span>{fmtNum(p.engagement.interactions)} interaksi</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
