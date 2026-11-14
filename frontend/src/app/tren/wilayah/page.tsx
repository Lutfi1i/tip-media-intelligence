"use client";

import { ChevronRight } from "lucide-react";
import { fmtNum, fmtRelative } from "@/lib/format";
import { platformLabel } from "@/lib/trendFilters";
import { fetchRegionTrends } from "@/lib/trendApi";
import { useTrendFilters } from "@/components/trend/TrendFiltersContext";
import { TrendPageHeader } from "@/components/trend/TrendPageHeader";
import {
  BaselineNotice,
  Kpi,
  PostItem,
  Section,
  SentimentBar,
  StatusBadge,
  topLabel,
  TrendState,
  useTrendData,
} from "@/components/trend/TrendUi";
import { EmptyState } from "@/components/ui";

export default function TrenWilayahPage() {
  const { filters, setFilters } = useTrendFilters();
  const { data, loading, error, reload } = useTrendData(fetchRegionTrends);
  const act = data?.aktivitas;
  const topPlatform = topLabel(act?.platform);
  const childLevel = filters.lokasi === "ID" ? "provinsi" : filters.lokasi.length === 2 ? "kota/kabupaten" : null;

  return (
    <div className="space-y-6">
      <TrendPageHeader
        title="Tren Wilayah"
        description="Tren lokal, kuliner, tempat yang ramai, keluhan, dan percakapan publik di wilayah yang dipilih."
      />

      <TrendState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data && act && (
          <>
            <BaselineNotice baseline={data.baseline} />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Postingan" value={fmtNum(act.postingan)} hint={data.periode.label} />
              <Kpi label="Akun unik" value={fmtNum(act.akun_unik)} hint="Dari postingan yang menyertakan nama akun" />
              <Kpi
                label="Sentimen negatif"
                value={`${fmtNum(act.sentimen_pct.negatif ?? 0, 1)}%`}
                hint="Dari seluruh postingan"
              />
              <Kpi
                label="Platform teraktif"
                value={topPlatform ? platformLabel(topPlatform[0]) : "-"}
                hint={topPlatform ? `${fmtNum(topPlatform[1])} postingan` : undefined}
              />
            </div>

            {act.postingan === 0 ? (
              <EmptyState
                title={`Belum ada percakapan tentang ${filters.lokasiNama} pada periode ini.`}
                description="Coba periode yang lebih panjang atau pilih wilayah induknya."
              />
            ) : (
              <>
                <Section title={`Top 10 tren lokal: ${filters.lokasiNama}`} hint="Diurutkan dari jumlah postingan.">
                  {data.top_tren.length === 0 ? (
                    <p className="text-xs text-zinc-500">Belum cukup postingan untuk membentuk tren.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-zinc-500 dark:text-zinc-400">
                          <tr className="border-b border-zinc-200 dark:border-zinc-800">
                            <th className="py-2 pr-3">#</th>
                            <th className="py-2 pr-3">Topik</th>
                            <th className="py-2 pr-3">Kategori</th>
                            <th className="py-2 pr-3">Tren</th>
                            <th className="py-2 text-right">Postingan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {data.top_tren.map((t, i) => (
                            <tr key={t.topic_key}>
                              <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{i + 1}</td>
                              <td className="py-2 pr-3 font-semibold text-zinc-900 dark:text-zinc-100">{t.topik}</td>
                              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{t.kategori}</td>
                              <td className="py-2 pr-3">
                                <StatusBadge status={t.status} growth={t.pertumbuhan_pct} />
                              </td>
                              <td className="py-2 text-right font-mono">{fmtNum(t.postingan)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {data.bagian.map((b) => (
                    <Section key={b.id} title={b.judul} hint={`${fmtNum(b.postingan)} postingan`}>
                      {b.postingan === 0 ? (
                        <p className="text-xs text-zinc-500">Belum ada postingan untuk bagian ini.</p>
                      ) : (
                        <>
                          {b.kata_kunci.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {b.kata_kunci.map((k) => (
                                <span
                                  key={k.key}
                                  className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                                >
                                  {k.label} <span className="font-mono text-zinc-500">{k.jumlah}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {b.contoh.map((p) => (
                              <PostItem key={p.id} p={p} />
                            ))}
                          </ul>
                        </>
                      )}
                    </Section>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Section title="Aktivitas dan percakapan publik" hint="Porsi sentimen dan platform.">
                    <SentimentBar pct={act.sentimen_pct} />
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {Object.entries(act.platform).map(([name, n]) => (
                        <li key={name} className="flex justify-between">
                          <span className="text-zinc-700 dark:text-zinc-300">{platformLabel(name)}</span>
                          <span className="font-mono text-zinc-600 dark:text-zinc-400">{fmtNum(n)}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>

                  <Section title="Berita yang sedang ramai" hint="Berita terbaru dari portal yang menyebut wilayah ini.">
                    {data.berita.length === 0 ? (
                      <p className="text-xs text-zinc-500">Belum ada berita yang menyebut wilayah ini pada periode ini.</p>
                    ) : (
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {data.berita.map((n) => (
                          <li key={n.id} className="py-2.5">
                            <a href={n.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100">
                              {n.judul}
                            </a>
                            <div className="mt-0.5 text-2xs text-zinc-500">{n.penerbit} &bull; {fmtRelative(n.published_at)}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </div>

                {childLevel && (
                  <Section
                    title={`Aktivitas per ${childLevel}`}
                    hint={`Klik untuk melihat tren ${childLevel} tersebut. Dihitung dari nama wilayah yang disebut di postingan.`}
                  >
                    {data.sub_wilayah.length === 0 ? (
                      <p className="text-xs text-zinc-500">Postingan belum menyebut {childLevel} tertentu.</p>
                    ) : (
                      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                        {data.sub_wilayah.map((r) => (
                          <li key={r.kode}>
                            <button
                              type="button"
                              onClick={() => setFilters({ lokasi: r.kode, lokasiNama: r.nama })}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            >
                              <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{r.nama}</span>
                              <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                                {fmtNum(r.postingan)}
                                {r.negatif > 0 && <span className="text-red-600 dark:text-red-400">{fmtNum(r.negatif)} neg</span>}
                                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </TrendState>
    </div>
  );
}
