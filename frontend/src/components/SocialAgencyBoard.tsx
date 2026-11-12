"use client";

import { Fragment, useState } from "react";
import type { SocialAgencyBoard as Board, SocialSampleMention } from "@/lib/api";
import { MediaAvatarStack } from "@/components/SourceLogos";
import { Sparkline, VelocityBadge, formatWib } from "@/components/SocialCharts";

function MentionList({ title, items }: { title: string; items: SocialSampleMention[] }) {
  return (
    <div>
      <h4 className="mb-1.5 text-2xs font-bold uppercase tracking-wider text-zinc-500">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">Tidak ada.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <li key={m.id} className="text-xs">
              <div className="text-2xs text-zinc-500">
                <span className="font-mono">{formatWib(m.published_at)} WIB</span> · {m.penulis ?? m.platform}
              </div>
              <div className="text-zinc-800 dark:text-zinc-200">{m.judul}</div>
              {m.url && (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-2xs font-semibold text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                  Buka sumber
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SocialAgencyBoard({
  data,
  isLoading,
  onFocusAgency,
}: {
  data: Board | null;
  isLoading: boolean;
  onFocusAgency: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = data?.agencies ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Papan Instansi: {data?.scope_name ?? "-"}</h2>
        <p className="max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">
          Instansi yang disebut dalam percakapan medsos, diurutkan dari jumlah konten bernada negatif. Share of voice adalah porsi sebutan
          instansi ini dari seluruh sebutan instansi.
          {data && ` ${data.posts_mentioning_agency} dari ${data.total_posts} konten menyebut setidaknya satu instansi.`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/75 text-2xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Instansi</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">Sebutan</th>
                <th scope="col" className="px-4 py-3 font-bold">Share of voice</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">Negatif</th>
                <th scope="col" className="px-4 py-3 font-bold">Laju</th>
                <th scope="col" className="px-4 py-3 font-bold">Pola Waktu</th>
                <th scope="col" className="px-4 py-3 font-bold">Topik</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading && !data ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">Menghitung sebutan instansi...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">
                    Belum ada instansi yang disebut pada rentang dan cakupan ini.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isOpen = open === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className={`align-top ${r.mention_count === 0 ? "opacity-60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.label}</div>
                          <div className="text-2xs text-zinc-500">{r.group}</div>
                          {r.platforms.length > 0 && <MediaAvatarStack sources={r.platforms} max={3} size="sm" className="mt-1" />}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {r.mention_count}
                          {r.growth_pct !== null && r.mention_count > 0 && (
                            <div className={`text-2xs font-semibold ${r.growth_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
                              {r.growth_pct >= 0 ? "+" : ""}
                              {r.growth_pct}%
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                              <div className="h-full rounded-full bg-fuchsia-500 dark:bg-fuchsia-400" style={{ width: `${r.share_of_voice_pct}%` }} />
                            </div>
                            <span className="text-xs text-zinc-700 dark:text-zinc-300">{r.share_of_voice_pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{r.negative_count}</div>
                          {r.mention_count > 0 && <div className="text-2xs text-zinc-500">{r.sentiment_pct.negatif}%</div>}
                          {r.emotions[0] && <div className="text-2xs text-zinc-500">{r.emotions[0].label.toLowerCase()}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <VelocityBadge status={r.velocity_status} />
                        </td>
                        <td className="px-4 py-3">
                          <Sparkline data={r.timeline} label={`Pola waktu sebutan ${r.label}`} />
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                          {r.top_topics.length ? r.top_topics.join(", ") : r.categories.map((c) => c.label).join(", ") || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <button
                              onClick={() => setOpen(isOpen ? null : r.id)}
                              aria-expanded={isOpen}
                              className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400"
                            >
                              {isOpen ? "Tutup" : "Contoh"}
                            </button>
                            {r.mention_count > 0 && (
                              <button onClick={() => onFocusAgency(r.id)} className="text-2xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                                Lihat tren
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-zinc-50/60 dark:bg-zinc-950/40">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid gap-4 md:grid-cols-2">
                              <MentionList title="Konten negatif teratas" items={r.top_negative} />
                              <MentionList title="Konten terbaru" items={r.latest} />
                            </div>
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
