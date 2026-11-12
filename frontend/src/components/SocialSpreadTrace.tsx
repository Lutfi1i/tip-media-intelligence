"use client";

import { useEffect, useState } from "react";
import { fetchSpreadTrace, SocialSpreadTrace as Trace } from "@/lib/api";
import { VolumeTimeline, formatWib } from "@/components/SocialCharts";

function duration(minutes: number): string {
  const m = Math.abs(minutes);
  if (m < 60) return `${m} menit`;
  if (m < 1440) return `${Math.floor(m / 60)} jam ${m % 60 ? `${m % 60} menit` : ""}`.trim();
  return `${Math.floor(m / 1440)} hari ${Math.floor((m % 1440) / 60)} jam`;
}

function summary(t: Trace): string {
  if (!t.first) return "Tidak ada konten yang cocok pada periode ini.";
  const who = t.first.penulis ?? t.first.penerbit ?? t.first.channel;
  let s = `Pertama muncul di ${t.first.channel} (${who}) pada ${formatWib(t.first.published_at)} WIB.`;
  if (t.lag_minutes !== null) {
    s += t.lag_minutes >= 0
      ? ` Media berita menyusul ${duration(t.lag_minutes)} setelah postingan medsos pertama.`
      : ` Medsos menyusul ${duration(t.lag_minutes)} setelah berita pertama.`;
  } else if (t.social_count && !t.news_count) {
    s += " Belum diliput media berita yang terkumpul.";
  } else if (t.news_count && !t.social_count) {
    s += " Belum ada percakapan medsos yang terkumpul.";
  }
  return s;
}

export function SocialSpreadTrace({
  timeRange,
  scopeKode,
  scopeMode,
  topicKey,
  q,
}: {
  timeRange: string;
  scopeKode: string;
  scopeMode: string;
  topicKey?: string;
  q?: string;
}) {
  const [data, setData] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicKey && !q) return;
    let cancelled = false;
    setData(null);
    setError(null);
    fetchSpreadTrace({ time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode, topic_key: topicKey, q })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Jejak penyebaran gagal dimuat."));
    return () => {
      cancelled = true;
    };
  }, [timeRange, scopeKode, scopeMode, topicKey, q]);

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Jejak penyebaran</h4>
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {!data && !error && <p className="text-xs text-zinc-500">Menelusuri asal dan urutan kanal...</p>}
      {data && (
        <>
          <p className="text-sm text-zinc-800 dark:text-zinc-200">{summary(data)}</p>
          <p className="text-2xs text-zinc-500">
            {data.total} konten cocok ({data.social_count} medsos, {data.news_count} berita), {data.period.label}. Waktu memakai waktu terbit yang
            tercatat sumber; untuk sumber penemuan seperti Google News bisa sedikit berbeda dari waktu posting asli.
          </p>

          {data.channels.length > 0 && (
            <ol className="space-y-1 text-xs">
              {data.channels.map((c, i) => (
                <li key={c.channel} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-5 shrink-0 font-mono text-2xs text-zinc-400">{i + 1}.</span>
                  <span className={`font-semibold ${c.group === "berita" ? "text-sky-700 dark:text-sky-300" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {c.channel}
                  </span>
                  <span className="text-2xs text-zinc-500">
                    {i === 0 ? "pertama" : `+${duration(c.minutes_after_first)}`} · {c.count} konten
                    {c.accounts ? ` · ${c.accounts} akun` : ""}
                  </span>
                  {c.first_url && (
                    <a href={c.first_url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-2xs text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                      {c.first_title}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}

          {data.total > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <VolumeTimeline data={data.timeline.medsos} baselinePerBucket={null} height={90} title="Medsos" />
              <VolumeTimeline data={data.timeline.berita} baselinePerBucket={null} height={90} title="Berita" />
            </div>
          )}
        </>
      )}
    </section>
  );
}
