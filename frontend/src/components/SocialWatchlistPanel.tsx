"use client";

import { FormEvent, Fragment, useState } from "react";
import type { SocialWatchlist } from "@/lib/api";
import { MediaAvatarStack } from "@/components/SourceLogos";
import { Sparkline, VelocityBadge, formatWib } from "@/components/SocialCharts";

export function SocialWatchlistPanel({
  data,
  isLoading,
  extraTerms,
  onAddTerm,
  onRemoveTerm,
}: {
  data: SocialWatchlist | null;
  isLoading: boolean;
  extraTerms: string[];
  onAddTerm: (term: string) => void;
  onRemoveTerm: (term: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = draft.trim();
    if (term.length >= 2) onAddTerm(term);
    setDraft("");
  };

  const terms = data?.terms ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Watchlist Kata Kunci di Media Sosial</h2>
          <p className="max-w-2xl text-xs text-zinc-500 dark:text-zinc-400">
            Kata kunci dan sinonim diambil dari profil pemantauan aktif. Kata kunci juga dicocokkan di dalam hashtag,
            misalnya &quot;banjir&quot; cocok dengan #BanjirBekasi. Frasa pengecualian profil tidak ikut dihitung.
          </p>
          {data && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              <strong>{data.active_terms}</strong> dari {data.total_terms} kata kunci muncul,{" "}
              <strong>{data.rising_terms}</strong> sedang naik.
            </p>
          )}
        </div>

        <form onSubmit={submit} className="flex w-full max-w-sm items-center gap-2">
          <label htmlFor="watch-term" className="sr-only">
            Tambah kata kunci pantauan
          </label>
          <input
            id="watch-term"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tambah kata kunci, mis. nama program"
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Pantau
          </button>
        </form>
      </div>

      {extraTerms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Kata kunci tambahan (hanya di peramban ini):</span>
          {extraTerms.map((t) => (
            <button
              key={t}
              onClick={() => onRemoveTerm(t)}
              className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2.5 py-1 font-medium text-fuchsia-700 hover:bg-fuchsia-500/20 dark:text-fuchsia-300"
              aria-label={`Hapus kata kunci ${t}`}
            >
              {t} <span aria-hidden="true">&times;</span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/75 text-2xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Kata Kunci</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Konten</th>
                <th scope="col" className="px-4 py-3 font-bold">Status Laju</th>
                <th scope="col" className="px-4 py-3 font-bold">Pola Waktu</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Negatif</th>
                <th scope="col" className="px-4 py-3 font-bold">Platform</th>
                <th scope="col" className="px-4 py-3 font-bold text-right">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading && !data ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                    Menghitung kecocokan kata kunci...
                  </td>
                </tr>
              ) : terms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-500">
                    Belum ada kata kunci. Isi kata kunci di profil pemantauan, atau tambahkan di kolom di atas.
                  </td>
                </tr>
              ) : (
                terms.map((t) => {
                  const isOpen = expanded === t.term;
                  return (
                    <Fragment key={t.term}>
                      <tr className={t.mention_count === 0 ? "opacity-60" : undefined}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{t.term}</div>
                          <div className="text-2xs text-zinc-500">
                            {t.kind}
                            {t.profiles.length > 0 && ` · ${t.profiles.join(", ")}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {t.mention_count}
                          {t.growth_pct !== null && t.mention_count > 0 && (
                            <div className={`text-2xs font-semibold ${t.growth_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
                              {t.growth_pct >= 0 ? "+" : ""}
                              {t.growth_pct}%
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <VelocityBadge status={t.velocity_status} />
                        </td>
                        <td className="px-4 py-3">
                          <Sparkline data={t.timeline} label={`Pola waktu ${t.term}`} />
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          {t.mention_count > 0 ? `${t.sentiment_pct.negatif}%` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {t.platforms.length > 0 ? (
                            <MediaAvatarStack sources={t.platforms} max={3} size="sm" />
                          ) : (
                            <span className="text-2xs text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {t.top_mentions.length > 0 ? (
                            <button
                              onClick={() => setExpanded(isOpen ? null : t.term)}
                              aria-expanded={isOpen}
                              className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400"
                            >
                              {isOpen ? "Tutup" : `Lihat ${t.top_mentions.length}`}
                            </button>
                          ) : (
                            <span className="text-2xs text-zinc-400">-</span>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-zinc-50/60 dark:bg-zinc-950/40">
                          <td colSpan={7} className="px-4 py-3">
                            <ul className="space-y-2">
                              {t.top_mentions.map((m) => (
                                <li key={m.id} className="flex flex-col gap-0.5 text-xs sm:flex-row sm:items-baseline sm:gap-3">
                                  <span className="shrink-0 font-mono text-2xs text-zinc-500">{formatWib(m.published_at)} WIB</span>
                                  <span className="shrink-0 font-semibold text-zinc-700 dark:text-zinc-300">
                                    {m.penulis ?? m.platform}
                                  </span>
                                  <span className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-300">{m.judul}</span>
                                  {m.url && (
                                    <a
                                      href={m.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 font-semibold text-fuchsia-600 hover:underline dark:text-fuchsia-400"
                                    >
                                      Buka sumber
                                    </a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
