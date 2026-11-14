"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { platformLabel } from "@/lib/trendFilters";
import { fetchReport, reportFileUrl } from "@/lib/trendApi";
import { useTrendFilters } from "@/components/trend/TrendFiltersContext";
import { TrendPageHeader } from "@/components/trend/TrendPageHeader";
import { DailyBars } from "@/components/trend/TrendCharts";
import { BaselineNotice, Kpi, Metric, Section, SentimentBar, StatusBadge, TrendState, useTrendData } from "@/components/trend/TrendUi";

const JENIS: Record<string, string> = { today: "Laporan harian", "7d": "Laporan mingguan", "30d": "Laporan bulanan" };

const linkBtn =
  "inline-flex min-h-[38px] items-center gap-2 rounded-md px-4 text-sm font-bold transition-colors";

export default function LaporanInsightPage() {
  const { filters } = useTrendFilters();
  const { data, loading, error, reload } = useTrendData(fetchReport);
  const jenis = JENIS[filters.periode] || "Laporan";
  const maxPlatform = Math.max(1, ...(data?.platform.map((p) => p.postingan) || [1]));
  const childLevel = filters.lokasi === "ID" ? "provinsi" : "kota/kabupaten";

  return (
    <div className="space-y-6">
      <TrendPageHeader
        title="Laporan & Insight"
        description="Pilih periode Hari ini, 7 hari, atau 30 hari untuk laporan harian, mingguan, atau bulanan. Isi unduhan sama dengan pratinjau di bawah."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={reportFileUrl(filters, "pdf")} className={`${linkBtn} bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900`}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Unduh PDF
            </a>
            <a
              href={reportFileUrl(filters, "excel")}
              className={`${linkBtn} border border-zinc-300 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900`}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Unduh Excel
            </a>
          </div>
        }
      />

      <TrendState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data && (
          <>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {jenis}: {data.lokasi.nama}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {data.periode.label}, platform {platformLabel(data.platform_filter).toLowerCase()}
              </p>
            </div>

            <BaselineNotice baseline={data.baseline} />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Kpi label="Postingan" value={fmtNum(data.ringkasan.postingan)} />
              <Kpi label="Akun unik" value={fmtNum(data.ringkasan.akun_unik)} />
              <Kpi label="Tren terdeteksi" value={fmtNum(data.ringkasan.tren)} />
              <Kpi label="Tren naik" value={fmtNum(data.ringkasan.tren_naik)} />
              <Kpi
                label="Interaksi"
                value={data.ringkasan.engagement.interactions === null ? "tidak tersedia" : fmtNum(data.ringkasan.engagement.interactions)}
                hint={`Dari ${fmtNum(data.ringkasan.engagement.posts_with_data)} postingan bermetrik`}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Section title="Pertumbuhan postingan per hari" hint="Tanggal dalam WIB.">
                  <DailyBars data={data.harian} />
                </Section>
              </div>
              <Section title="Sentimen">
                <SentimentBar pct={data.ringkasan.sentimen_pct} />
              </Section>
            </div>

            <Section title="Topik paling populer">
              {data.topik.length === 0 ? (
                <p className="text-xs text-zinc-500">Belum ada topik untuk filter ini.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-zinc-500 dark:text-zinc-400">
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className="py-2 pr-3">#</th>
                        <th className="py-2 pr-3">Topik</th>
                        <th className="hidden py-2 pr-3 sm:table-cell">Kategori</th>
                        <th className="py-2 pr-3 text-right">Postingan</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 text-right">Negatif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {data.topik.map((t, i) => (
                        <tr key={t.topik}>
                          <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{i + 1}</td>
                          <td className="py-2 pr-3">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{t.topik}</div>
                            {t.hashtag.length > 0 && (
                              <div className="mt-0.5 truncate text-2xs text-zinc-500 dark:text-zinc-400">{t.hashtag.join(" ")}</div>
                            )}
                          </td>
                          <td className="hidden py-2 pr-3 text-zinc-600 dark:text-zinc-300 sm:table-cell">
                            {t.kategori === t.topik ? <span className="text-zinc-400">-</span> : t.kategori}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">{fmtNum(t.postingan)}</td>
                          <td className="py-2 pr-3"><StatusBadge status={t.status} growth={t.pertumbuhan_pct} /></td>
                          <td className="py-2 text-right font-mono">{fmtNum(t.negatif_pct, 1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Section title="Perbandingan antarplatform" hint={'Tanda "-" berarti platform tidak menyediakan angka interaksi atau views.'}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-zinc-500 dark:text-zinc-400">
                      <tr className="border-b border-zinc-200 dark:border-zinc-800">
                        <th className="py-2 pr-3">Platform</th>
                        <th className="py-2 pr-3">Postingan</th>
                        <th className="py-2 pr-3 text-right">Interaksi</th>
                        <th className="py-2 pr-3 text-right">Views</th>
                        <th className="py-2 text-right">Negatif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {data.platform.map((p) => (
                        <tr key={p.platform}>
                          <td className="py-2 pr-3 font-semibold text-zinc-900 dark:text-zinc-100">{platformLabel(p.platform)}</td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded bg-zinc-100 dark:bg-zinc-800">
                                <div className="h-1.5 rounded" style={{ width: `${(p.postingan / maxPlatform) * 100}%`, background: "var(--series-1)" }} />
                              </div>
                              <span className="font-mono text-xs">{fmtNum(p.postingan)}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right text-xs"><Metric value={p.interaksi} compact /></td>
                          <td className="py-2 pr-3 text-right text-xs"><Metric value={p.views} compact /></td>
                          <td className="py-2 text-right font-mono text-xs">{fmtNum(p.negatif_pct, 1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title={`Perbandingan antar${childLevel}`} hint="Dari nama wilayah yang disebut di postingan.">
                {data.wilayah.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    {filters.lokasi.length > 2 ? "Pilih provinsi atau Indonesia untuk membandingkan wilayah." : "Postingan belum menyebut wilayah tertentu."}
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {data.wilayah.slice(0, 12).map((w) => (
                      <li key={w.kode} className="flex justify-between gap-2">
                        <span className="truncate text-zinc-800 dark:text-zinc-200">{w.nama}</span>
                        <span className="shrink-0 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {fmtNum(w.postingan)}
                          {w.negatif > 0 && <span className="ml-2 text-red-600 dark:text-red-400">{fmtNum(w.negatif)} neg</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {[
                { title: "Hashtag teratas", rows: data.hashtag },
                { title: "Keyword teratas", rows: data.keyword },
              ].map(({ title, rows }) => (
                <Section key={title} title={title} hint="Dipakai minimal dua sumber berbeda.">
                  {rows.length === 0 ? (
                    <p className="text-xs text-zinc-500">Belum ada.</p>
                  ) : (
                    <ol className="space-y-1 text-sm">
                      {rows.map((k) => (
                        <li key={k.key} className="flex justify-between gap-2">
                          <span className="truncate text-zinc-800 dark:text-zinc-200">{k.label}</span>
                          <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{fmtNum(k.jumlah)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </Section>
              ))}
            </div>
          </>
        )}
      </TrendState>
    </div>
  );
}
