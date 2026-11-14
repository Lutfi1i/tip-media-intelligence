"use client";

import { useEffect, useState } from "react";
import { fetchHashtagCooccurrence, HashtagCooccurrence, SocialFilters } from "@/lib/api";

/** Tagar yang sering dipakai bersama: kelompok (komponen terhubung) dan pasangan terkuat. */
export function SocialHashtagCooccurrence({
  timeRange,
  scopeKode,
  scopeMode,
  multiCodes,
  platform,
  filters,
}: {
  timeRange: string;
  scopeKode: string;
  scopeMode: string;
  multiCodes?: string;
  platform?: string;
  filters?: SocialFilters;
}) {
  const [data, setData] = useState<HashtagCooccurrence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const category = filters?.category;
  const agency = filters?.agency;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHashtagCooccurrence({
      timeRange,
      scopeKode,
      scopeMode,
      multiCodes,
      platform,
      filters: { category, agency },
    })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Data tagar gagal dimuat."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [timeRange, scopeKode, scopeMode, multiCodes, platform, category, agency]);

  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Tagar yang dipakai bersama</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Tagar yang sering muncul di postingan yang sama. Kelompok besar biasanya menandai satu kampanye atau narasi.
          {data && data.total_posts > 0 && (
            <> {data.posts_with_hashtag} dari {data.total_posts} postingan memakai tagar.</>
          )}
        </p>
      </div>

      {loading ? (
        <p className="py-6 text-center text-xs text-zinc-500">Memuat tagar...</p>
      ) : error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : !data || (data.groups.length === 0 && data.pairs.length === 0) ? (
        <p className="py-6 text-center text-xs text-zinc-500">Belum ada tagar yang muncul bersama pada periode ini.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-2xs font-bold uppercase tracking-wider text-zinc-500">Kelompok</h4>
            {data.groups.length === 0 ? (
              <p className="text-xs text-zinc-500">Tidak ada kelompok.</p>
            ) : (
              <ul className="space-y-2">
                {data.groups.slice(0, 6).map((g, i) => (
                  <li key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="flex flex-wrap gap-1">
                      {g.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-fuchsia-50 px-1.5 py-0.5 text-2xs font-semibold text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300"
                        >
                          #{t.replace(/^#/, "")}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-2xs text-zinc-500 dark:text-zinc-400">
                      {g.posts} postingan, {g.accounts} akun
                      {g.platforms.length > 0 && `, ${g.platforms.join(", ")}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-2xs font-bold uppercase tracking-wider text-zinc-500">Pasangan terkuat</h4>
            <table className="w-full text-left text-xs">
              <thead className="text-2xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1.5">Pasangan</th>
                  <th className="py-1.5 text-right">Postingan</th>
                  <th className="py-1.5 text-right">Akun</th>
                  <th className="py-1.5 text-right" title="Seberapa sering keduanya muncul bersama dibanding muncul sendiri-sendiri (0-1)">
                    Keterkaitan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.pairs.slice(0, 10).map((p) => (
                  <tr key={`${p.a}-${p.b}`}>
                    <td className="py-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                      #{p.a.replace(/^#/, "")} + #{p.b.replace(/^#/, "")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{p.posts}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.accounts}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.jaccard.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
