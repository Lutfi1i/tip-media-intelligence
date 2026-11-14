"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { fmtDateTime, fmtNum, fmtRelative } from "@/lib/format";
import {
  fetchMentions,
  KeywordPeriod,
  Mention,
  MentionPage,
  SentCounts,
  Sentiment,
  SENTIMENTS,
  setMentionSentiment,
} from "@/lib/keywordApi";
import { Notice } from "@/components/ui";
import { SENT_LABEL, SENT_VAR } from "./KeywordCharts";
import { platformName } from "./KeywordInfographic";

const selectCls =
  "min-h-[36px] rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const SOURCE_TEXT: Record<Mention["sentimen_sumber"], string> = {
  ai: "dinilai AI",
  manual: "dikoreksi analis",
  kamus: "kamus kata, menunggu AI",
};

function SentimentPicker({ m, onChange, busy }: { m: Mention; onChange: (s: Sentiment) => void; busy: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <label className="sr-only" htmlFor={`sent-${m.id}`}>
        Sentimen sebutan
      </label>
      <div className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: SENT_VAR[m.sentimen] }} aria-hidden="true" />
        <select
          id={`sent-${m.id}`}
          value={m.sentimen}
          disabled={busy}
          onChange={(e) => onChange(e.target.value as Sentiment)}
          className="min-h-[32px] rounded-md border border-zinc-300 bg-white px-1.5 text-xs font-semibold text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {SENTIMENTS.map((s) => (
            <option key={s} value={s}>
              {SENT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <span className="text-2xs text-zinc-500 dark:text-zinc-400">{SOURCE_TEXT[m.sentimen_sumber]}</span>
    </div>
  );
}

function MentionRow({ m, onIssue, onSentiment, busy }: { m: Mention; onIssue: (isu: string) => void; onSentiment: (s: Sentiment) => void; busy: boolean }) {
  return (
    <li className="flex gap-3 border-l-[3px] py-3 pl-3" style={{ borderColor: SENT_VAR[m.sentimen] }}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-zinc-500 dark:text-zinc-400">
          <span className="font-bold text-zinc-700 dark:text-zinc-200">{platformName(m.platform)}</span>
          <span className="truncate">{m.sumber}</span>
          <span title={fmtDateTime(m.published_at)}>{fmtRelative(m.published_at)}</span>
        </div>
        {m.url ? (
          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 line-clamp-3 break-words text-sm font-semibold text-zinc-900 [overflow-wrap:anywhere] hover:underline dark:text-zinc-100"
          >
            {m.judul}
            <ExternalLink className="ml-1 inline h-3 w-3 text-zinc-400" aria-hidden="true" />
          </a>
        ) : (
          <p className="mt-0.5 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{m.judul}</p>
        )}
        {m.cuplikan && <p className="mt-1 line-clamp-2 break-words text-xs text-zinc-600 [overflow-wrap:anywhere] dark:text-zinc-400">{m.cuplikan}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-zinc-500 dark:text-zinc-400">
          {m.isu && (
            <button
              type="button"
              onClick={() => onIssue(m.isu!)}
              className="rounded bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              title="Tampilkan semua sebutan dengan isu ini"
            >
              Isu: {m.isu}
            </button>
          )}
          {m.views !== null && <span className="font-mono">{fmtNum(m.views)} views</span>}
          {m.interaksi !== null && <span className="font-mono">{fmtNum(m.interaksi)} interaksi</span>}
          {m.sentimen_alasan && <span className="italic">{m.sentimen_alasan}</span>}
        </div>
      </div>
      <SentimentPicker m={m} onChange={onSentiment} busy={busy} />
    </li>
  );
}

export function MentionList({
  projectId,
  periode,
  platform,
  issue,
  onIssue,
  onChanged,
}: {
  projectId: number;
  periode: KeywordPeriod;
  platform: string;
  issue: string | null;
  onIssue: (isu: string | null) => void;
  onChanged: () => void;
}) {
  const [sentimen, setSentimen] = useState<Sentiment | "">("");
  const [urut, setUrut] = useState<"terbaru" | "populer">("terbaru");
  const [items, setItems] = useState<Mention[]>([]);
  const [meta, setMeta] = useState<Pick<MentionPage, "total" | "per_sentimen" | "halaman"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (halaman: number) => {
      const id = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const page = await fetchMentions(projectId, {
          periode,
          platform,
          sentimen: sentimen || undefined,
          isu: issue || undefined,
          urut,
          halaman,
        });
        if (id !== seq.current) return;
        setItems((prev) => (halaman === 1 ? page.sebutan : [...prev, ...page.sebutan]));
        setMeta({ total: page.total, per_sentimen: page.per_sentimen, halaman: page.halaman });
      } catch (e) {
        if (id === seq.current) setError(e instanceof Error ? e.message : "Sebutan gagal dimuat");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [projectId, periode, platform, sentimen, issue, urut],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const changeSentiment = async (m: Mention, s: Sentiment) => {
    setSaving(m.id);
    setError(null);
    try {
      await setMentionSentiment(projectId, m.id, s);
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, sentimen: s, sentimen_sumber: "manual", sentimen_alasan: null } : x)));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sentimen gagal disimpan");
    } finally {
      setSaving(null);
    }
  };

  const counts: SentCounts | undefined = meta?.per_sentimen;
  const all = counts ? counts.positif + counts.netral + counts.negatif : 0;
  const tabs: { value: Sentiment | ""; label: string; n?: number }[] = [
    { value: "", label: "Semua", n: all },
    ...SENTIMENTS.map((s) => ({ value: s, label: SENT_LABEL[s], n: counts?.[s] })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Saring sentimen">
          {tabs.map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={sentimen === t.value}
              onClick={() => setSentimen(t.value)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs font-bold ${
                sentimen === t.value
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {t.value && <span className="h-2 w-2 rounded-full" style={{ background: SENT_VAR[t.value] }} aria-hidden="true" />}
              {t.label}
              {t.n !== undefined && <span className="font-mono font-normal opacity-80">{fmtNum(t.n)}</span>}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          Urutkan
          <select value={urut} onChange={(e) => setUrut(e.target.value as "terbaru" | "populer")} className={selectCls}>
            <option value="terbaru">Terbaru</option>
            <option value="populer">Interaksi terbanyak</option>
          </select>
        </label>
      </div>

      {issue && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">Isu:</span>
          <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-1 font-semibold text-white dark:bg-white dark:text-zinc-900">
            {issue}
            <button type="button" onClick={() => onIssue(null)} aria-label="Hapus saringan isu" className="ml-0.5 rounded hover:opacity-70">
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      {error && <Notice tone="error" message={error} onRetry={() => load(1)} />}

      {items.length === 0 && !loading ? (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Tidak ada sebutan untuk saringan ini.</p>
      ) : (
        <ul className={`divide-y divide-zinc-100 dark:divide-zinc-800 ${loading && items.length ? "opacity-60" : ""}`}>
          {items.map((m) => (
            <MentionRow key={m.id} m={m} busy={saving === m.id} onIssue={(i) => onIssue(i)} onSentiment={(s) => changeSentiment(m, s)} />
          ))}
        </ul>
      )}
      {loading && items.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">Memuat sebutan...</p>}

      {meta && items.length < meta.total && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => load(meta.halaman + 1)}
            disabled={loading}
            className="min-h-[38px] rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {loading ? "Memuat..." : `Muat lagi (${fmtNum(meta.total - items.length)} tersisa)`}
          </button>
        </div>
      )}
    </div>
  );
}
