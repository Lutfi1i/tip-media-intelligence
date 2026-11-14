"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { platformLabel } from "@/lib/trendFilters";
import { fetchViral } from "@/lib/trendApi";
import { TrendPageHeader } from "@/components/trend/TrendPageHeader";
import { Metric, Section, TrendState, useTrendData } from "@/components/trend/TrendUi";
import { EmptyState, Notice } from "@/components/ui";

const SORTS = [
  { value: "interaksi", label: "Interaksi terbanyak" },
  { value: "views", label: "Views terbanyak" },
  { value: "laju", label: "Tumbuh paling cepat" },
];

const selectCls =
  "min-h-[38px] rounded-md border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function KontenViralPage() {
  const [urut, setUrut] = useState("interaksi");
  const [kategori, setKategori] = useState("");
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const { data, loading, error, reload } = useTrendData((f) => fetchViral(f, urut, kategori || undefined), [urut, kategori]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/social-pulse/taxonomy`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories((d.categories || []).filter((c: { id: string }) => c.id !== "lainnya")))
      .catch(() => setCategories([]));
  }, []);

  const without = Object.entries(data?.tanpa_metrik || {});
  const withoutTotal = without.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="space-y-6">
      <TrendPageHeader
        title="Konten Viral"
        description="Konten dengan perhatian tertinggi: views, likes, komentar, shares, dan seberapa cepat interaksinya tumbuh."
        actions={
          <div className="flex flex-wrap gap-2">
            <select value={kategori} onChange={(e) => setKategori(e.target.value)} aria-label="Kategori" className={selectCls}>
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <select value={urut} onChange={(e) => setUrut(e.target.value)} aria-label="Urutkan" className={selectCls}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        }
      />

      <TrendState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data && (
          <>
            {withoutTotal > 0 && (
              <Notice tone="info">
                {fmtNum(data.dengan_metrik)} dari {fmtNum(data.total_postingan)} postingan punya angka views atau interaksi.{" "}
                {fmtNum(withoutTotal)} postingan dari {without.map(([p, n]) => `${platformLabel(p)} (${n})`).join(", ")} tidak
                ikut diperingkat karena platform tersebut tidak menyediakan metrik secara gratis.
              </Notice>
            )}

            {data.konten.length === 0 ? (
              <EmptyState
                title="Belum ada konten bermetrik untuk filter ini."
                description="Metrik saat ini tersedia dari YouTube, Bluesky, dan Telegram. Coba periode lebih panjang atau platform YouTube."
              />
            ) : (
              <Section title={`${fmtNum(data.konten.length)} konten teratas`} hint={data.periode.label}>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.konten.map((c, i) => (
                    <li key={c.id} className="flex flex-col rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-2 text-2xs">
                        <span className="font-mono font-bold text-zinc-400">#{i + 1}</span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {c.jenis} &bull; {platformLabel(c.platform)}
                        </span>
                      </div>
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-2 line-clamp-3 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100">
                          {c.judul}
                          <ExternalLink className="ml-1 inline h-3 w-3 text-zinc-400" aria-hidden="true" />
                        </a>
                      ) : (
                        <p className="mt-2 line-clamp-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{c.judul}</p>
                      )}
                      <div className="mt-1 text-2xs text-zinc-500 dark:text-zinc-400">
                        {c.penulis || "akun tidak diketahui"} &bull; {fmtDateTime(c.published_at)}
                      </div>
                      {c.kategori.length > 0 && (
                        <div className="mt-1 text-2xs text-zinc-500 dark:text-zinc-400">{c.kategori.join(", ")}</div>
                      )}
                      <dl className="mt-auto grid grid-cols-4 gap-2 pt-3 text-center text-2xs">
                        {[
                          ["Views", c.views],
                          ["Likes", c.likes],
                          ["Komentar", c.komentar],
                          ["Shares", c.shares],
                        ].map(([label, v]) => (
                          <div key={label as string}>
                            <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                            <dd className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {v === null || v === undefined ? <span className="text-zinc-400">-</span> : fmtNum(v as number)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-2 border-t border-zinc-100 pt-2 text-2xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                        Laju: <Metric value={c.laju_per_jam} /> {c.interaksi !== null ? "interaksi" : "views"} per jam sejak diunggah
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </TrendState>
    </div>
  );
}
