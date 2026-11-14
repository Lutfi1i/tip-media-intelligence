"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { platformLabel } from "@/lib/trendFilters";
import { AccountRow, fetchAccounts } from "@/lib/trendApi";
import { useTrendFilters } from "@/components/trend/TrendFiltersContext";
import { TrendPageHeader } from "@/components/trend/TrendPageHeader";
import { Metric, Section, TrendState, useTrendData } from "@/components/trend/TrendUi";
import { EmptyState, Notice } from "@/components/ui";

const SORTS = [
  { value: "views", label: "Total views" },
  { value: "followers", label: "Followers" },
  { value: "pertumbuhan", label: "Pertumbuhan followers" },
  { value: "engagement", label: "Engagement rate" },
  { value: "postingan", label: "Jumlah postingan" },
];

function Growth({ v }: { v: number | null }) {
  if (v === null) return <span className="text-zinc-400 dark:text-zinc-600" title="Akun perlu teramati minimal dua kali">-</span>;
  return (
    <span className={`font-mono ${v > 0 ? "text-emerald-700 dark:text-emerald-400" : v < 0 ? "text-red-700 dark:text-red-400" : ""}`}>
      {v > 0 ? "+" : ""}{fmtNum(v)}
    </span>
  );
}

function AccountName({ a }: { a: AccountRow }) {
  return a.contoh_url ? (
    <a href={a.contoh_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100">
      {a.akun}
      <ExternalLink className="ml-1 inline h-3 w-3 text-zinc-400" aria-hidden="true" />
    </a>
  ) : (
    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{a.akun}</span>
  );
}

export default function AkunPopulerPage() {
  const { filters } = useTrendFilters();
  const [urut, setUrut] = useState("views");
  const { data, loading, error, reload } = useTrendData((f) => fetchAccounts(f, urut), [urut]);

  return (
    <div className="space-y-6">
      <TrendPageHeader
        title="Influencer & Akun Populer"
        description={
          filters.lokasi === "ID"
            ? "Akun yang paling aktif dan paling banyak ditonton dalam percakapan yang terpantau."
            : `Akun dan kreator yang aktif membahas ${filters.lokasiNama}.`
        }
        actions={
          <select
            value={urut}
            onChange={(e) => setUrut(e.target.value)}
            aria-label="Urutkan akun"
            className="min-h-[38px] rounded-md border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>Urut: {s.label}</option>
            ))}
          </select>
        }
      />

      <TrendState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data && (
          <>
            <Notice tone="info">
              {fmtNum(data.postingan_dengan_akun)} dari {fmtNum(data.total_postingan)} postingan menyertakan nama akun, dan{" "}
              {fmtNum(data.akun_dengan_metrik)} akun punya angka followers atau views (terutama YouTube). Pertumbuhan followers
              dihitung dari akun yang teramati lebih dari sekali dalam periode ini. Engagement rate = interaksi dibagi views.
            </Notice>

            {data.akun.length === 0 ? (
              <EmptyState title="Belum ada akun yang teridentifikasi untuk filter ini." description="Coba periode yang lebih panjang." />
            ) : (
              <>
                {Object.keys(data.teratas_per_platform).length > 0 && (
                  <Section title="Akun teratas per platform" hint="Diurutkan dari views lalu interaksi.">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(data.teratas_per_platform).map(([platform, rows]) => (
                        <div key={platform} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                          <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{platformLabel(platform)}</div>
                          <ol className="mt-2 space-y-1.5 text-sm">
                            {rows.map((a) => (
                              <li key={a.akun} className="flex items-center justify-between gap-2">
                                <span className="truncate"><AccountName a={a} /></span>
                                <span className="shrink-0 text-2xs text-zinc-500">
                                  {a.total_views !== null ? `${fmtNum(a.total_views)} views` : `${a.postingan} postingan`}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                <Section title="Daftar akun" hint={data.periode.label}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[56rem] text-left text-sm">
                      <thead className="text-xs text-zinc-500 dark:text-zinc-400">
                        <tr className="border-b border-zinc-200 dark:border-zinc-800">
                          <th className="py-2 pr-3">Akun</th>
                          <th className="py-2 pr-3 text-right">Postingan</th>
                          <th className="py-2 pr-3 text-right">Followers</th>
                          <th className="py-2 pr-3 text-right">Pertumbuhan</th>
                          <th className="py-2 pr-3 text-right">Rata-rata views</th>
                          <th className="py-2 pr-3 text-right">Engagement</th>
                          <th className="py-2 pr-3">Kategori</th>
                          <th className="py-2">Wilayah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {data.akun.map((a) => (
                          <tr key={a.akun}>
                            <td className="py-2 pr-3">
                              <AccountName a={a} />
                              <div className="text-2xs text-zinc-500">{a.platform.map(platformLabel).join(", ")}</div>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{fmtNum(a.postingan)}</td>
                            <td className="py-2 pr-3 text-right"><Metric value={a.followers} compact /></td>
                            <td className="py-2 pr-3 text-right"><Growth v={a.pertumbuhan_followers} /></td>
                            <td className="py-2 pr-3 text-right"><Metric value={a.rata_views} compact /></td>
                            <td className="py-2 pr-3 text-right">
                              {a.engagement_rate_pct === null ? <Metric value={null} compact /> : <span className="font-mono">{fmtNum(a.engagement_rate_pct, 2)}%</span>}
                            </td>
                            <td className="py-2 pr-3 text-xs text-zinc-600 dark:text-zinc-300">{a.kategori.join(", ") || "-"}</td>
                            <td className="py-2 text-xs text-zinc-600 dark:text-zinc-300">{a.wilayah || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </>
            )}
          </>
        )}
      </TrendState>
    </div>
  );
}
