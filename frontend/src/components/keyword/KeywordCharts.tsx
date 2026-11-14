"use client";

import { useState } from "react";
import { fmtNum, fmtPct } from "@/lib/format";
import { GroupRow, SentCounts, Sentiment, SENTIMENTS } from "@/lib/keywordApi";

export const SENT_LABEL: Record<Sentiment, string> = { positif: "Positif", netral: "Netral", negatif: "Negatif" };
export const SENT_VAR: Record<Sentiment, string> = {
  positif: "var(--sent-pos)",
  netral: "var(--sent-neu)",
  negatif: "var(--sent-neg)",
};

export const sumSent = (c: SentCounts) => c.positif + c.netral + c.negatif;
export const pctOf = (n: number, total: number) => (total ? (n / total) * 100 : 0);

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= v / 4)! * mag;
  return Math.ceil(v / step) * step;
}

export function SentLegend({ counts }: { counts?: SentCounts }) {
  const total = counts ? sumSent(counts) : 0;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-700 dark:text-zinc-200" aria-label="Legenda sentimen">
      {SENTIMENTS.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SENT_VAR[s] }} aria-hidden="true" />
          {SENT_LABEL[s]}
          {counts && (
            <span className="font-mono text-zinc-500 dark:text-zinc-400">
              {fmtNum(counts[s])} ({fmtPct(pctOf(counts[s], total))})
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Sebutan per jam/hari, ditumpuk per sentimen (negatif di dasar agar lonjakan negatif terlihat). */
export function SentimentTimeline({
  points,
  hourly,
}: {
  points: ({ t: string; total: number } & SentCounts)[];
  hourly: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="text-xs text-zinc-500">Belum ada data.</p>;
  const max = niceMax(Math.max(1, ...points.map((p) => p.total)));
  // Backend mengirim waktu lokal WIB tanpa zona; dibaca apa adanya, tidak digeser zona browser.
  const fmt = (iso: string, full: boolean) => {
    if (hourly) return iso.slice(11, 16).replace(":", ".") + (full ? " WIB" : "");
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    return d.toLocaleDateString("id-ID", { timeZone: "UTC", day: "numeric", month: "short", ...(full ? { weekday: "short" } : {}) });
  };
  const labelEvery = Math.ceil(points.length / 7);
  const order: Sentiment[] = ["negatif", "netral", "positif"];

  return (
    <div className="space-y-3">
      <SentLegend />
      <div className="relative flex text-2xs text-zinc-500 dark:text-zinc-400">
        <div className="flex w-8 shrink-0 flex-col justify-between pb-5 text-right font-mono" style={{ height: 200 }}>
          <span>{fmtNum(max)}</span>
          <span>{fmtNum(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative ml-2 min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[180px]">
            <div className="absolute inset-x-0 top-0 border-t" style={{ borderColor: "var(--chart-grid)" }} />
            <div className="absolute inset-x-0 top-1/2 border-t" style={{ borderColor: "var(--chart-grid)" }} />
            <div className="absolute inset-x-0 bottom-0 border-t border-zinc-300 dark:border-zinc-700" />
          </div>
          <div className="flex h-[180px] items-end gap-[2px]">
            {points.map((p, i) => (
              <div
                key={p.t}
                className="relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${fmt(p.t, true)}: ${p.total} sebutan, ${p.positif} positif, ${p.netral} netral, ${p.negatif} negatif`}
              >
                <div
                  className="flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity"
                  style={{ height: `${(p.total / max) * 100}%`, opacity: hover === null || hover === i ? 1 : 0.45 }}
                >
                  {order.map((s) =>
                    p[s] > 0 ? <div key={s} style={{ flexGrow: p[s], flexBasis: 0, minHeight: 2, background: SENT_VAR[s] }} /> : null,
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex h-4 gap-[2px]">
            {points.map((p, i) => (
              <div key={p.t} className="min-w-0 flex-1 whitespace-nowrap text-center">
                {i % labelEvery === 0 ? fmt(p.t, false) : ""}
              </div>
            ))}
          </div>
          {hover !== null && (
            <div
              role="tooltip"
              className={`pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900 ${
                hover < points.length * 0.2 ? "" : hover > points.length * 0.8 ? "-translate-x-full" : "-translate-x-1/2"
              }`}
              style={{ left: `${((hover + 0.5) / points.length) * 100}%` }}
            >
              <div className="whitespace-nowrap font-semibold text-zinc-900 dark:text-zinc-100">
                {fmt(points[hover].t, true)}: {fmtNum(points[hover].total)} sebutan
              </div>
              {SENTIMENTS.map((s) => (
                <div key={s} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
                  <span className="h-2 w-2 rounded-sm" style={{ background: SENT_VAR[s] }} aria-hidden="true" />
                  {SENT_LABEL[s]}
                  <span className="ml-auto pl-3 font-mono">{fmtNum(points[hover][s])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-300">Tampilkan tabel</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-3">{hourly ? "Jam" : "Tanggal"}</th>
                <th className="py-1 pr-3 text-right">Sebutan</th>
                {SENTIMENTS.map((s) => (
                  <th key={s} className="py-1 pr-3 text-right">{SENT_LABEL[s]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {points.map((p) => (
                <tr key={p.t}>
                  <td className="py-1 pr-3">{fmt(p.t, true)}</td>
                  <td className="py-1 pr-3 text-right font-mono">{p.total}</td>
                  {SENTIMENTS.map((s) => (
                    <td key={s} className="py-1 pr-3 text-right font-mono">{p[s]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Donat porsi sentimen dengan angka bersih (positif dikurangi negatif) di tengah. */
export function SentimentDonut({ counts, size = 160 }: { counts: SentCounts; size?: number }) {
  const total = sumSent(counts);
  const r = 15.9155; // keliling 100
  let offset = 25;
  const net = total ? Math.round(((counts.positif - counts.negatif) / total) * 100) : null;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        viewBox="0 0 42 42"
        width={size}
        height={size}
        role="img"
        aria-label={`Sentimen: ${SENTIMENTS.map((s) => `${SENT_LABEL[s]} ${counts[s]}`).join(", ")}`}
        className="shrink-0"
      >
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--chart-grid)" strokeWidth="5" />
        {total > 0 &&
          SENTIMENTS.map((s) => {
            const pct = pctOf(counts[s], total);
            if (!pct) return null;
            // Celah 0,8 antarsegmen sebagai pemisah permukaan.
            const gap = pct >= 100 ? 0 : 0.8;
            const el = (
              <circle
                key={s}
                cx="21"
                cy="21"
                r={r}
                fill="none"
                stroke={SENT_VAR[s]}
                strokeWidth="5"
                strokeDasharray={`${Math.max(0, pct - gap)} ${100 - Math.max(0, pct - gap)}`}
                strokeDashoffset={offset}
              />
            );
            offset -= pct;
            return el;
          })}
        <text x="21" y="20.5" textAnchor="middle" className="fill-zinc-900 dark:fill-white" style={{ fontSize: 7, fontWeight: 800 }}>
          {net === null ? "-" : `${net > 0 ? "+" : ""}${net}`}
        </text>
        <text x="21" y="26.5" textAnchor="middle" className="fill-zinc-500 dark:fill-zinc-400" style={{ fontSize: 2.8 }}>
          skor sentimen
        </text>
      </svg>
      <div className="min-w-0 space-y-2">
        {SENTIMENTS.map((s) => (
          <div key={s} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: SENT_VAR[s] }} aria-hidden="true" />
            <span className="w-16 text-zinc-700 dark:text-zinc-200">{SENT_LABEL[s]}</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-white">{fmtNum(counts[s])}</span>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{fmtPct(pctOf(counts[s], total))}</span>
          </div>
        ))}
        <p className="max-w-[16rem] text-2xs text-zinc-500 dark:text-zinc-400">
          Skor = persen positif dikurangi persen negatif. Rentang -100 sampai +100.
        </p>
      </div>
    </div>
  );
}

/** Satu batang bertumpuk per baris (platform, sumber, topik), panjang relatif terhadap baris terbesar. */
export function GroupSentBars({
  rows,
  label = (n: string) => n,
  onSelect,
}: {
  rows: GroupRow[];
  label?: (n: string) => string;
  /** Bila diisi, tiap baris menjadi tombol (mis. buka sebutan untuk isu itu). */
  onSelect?: (nama: string) => void;
}) {
  if (!rows.length) return <p className="text-xs text-zinc-500">Belum ada data.</p>;
  const max = Math.max(...rows.map((r) => r.sebutan));
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const body = (
          <>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-zinc-800 dark:text-zinc-100" title={label(r.nama)}>
              {label(r.nama)}
            </span>
            <span className="shrink-0 font-mono text-zinc-600 dark:text-zinc-300">
              {fmtNum(r.sebutan)}
              <span className="ml-2 text-2xs" style={{ color: "var(--sent-pos)" }} title="positif">
                +{r.positif}
              </span>
              <span className="ml-1.5 text-2xs" style={{ color: "var(--sent-neg)" }} title="negatif">
                -{r.negatif}
              </span>
            </span>
          </div>
          <div
            className="mt-1 flex h-2 gap-[2px]"
            style={{ width: `${Math.max(4, (r.sebutan / max) * 100)}%` }}
            role="img"
            aria-label={`${label(r.nama)}: ${r.positif} positif, ${r.netral} netral, ${r.negatif} negatif`}
          >
            {SENTIMENTS.map((s) =>
              r[s] > 0 ? (
                <div key={s} className="first:rounded-l last:rounded-r" style={{ flexGrow: r[s], flexBasis: 0, background: SENT_VAR[s] }} />
              ) : null,
            )}
          </div>
          </>
        );
        return (
          <li key={r.nama} className="min-w-0">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(r.nama)}
                className="block w-full rounded-md px-1.5 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
              >
                {body}
              </button>
            ) : (
              <div className="px-1.5 py-1">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Awan kata: ukuran mengikuti jumlah, warna mengikuti sentimen dominan, dengan label teks untuk pembaca layar. */
export function WordCloud({ words }: { words: { kata: string; jumlah: number; sentimen: Sentiment }[] }) {
  if (!words.length) return <p className="text-xs text-zinc-500">Belum cukup sebutan untuk membentuk konteks.</p>;
  const max = Math.max(...words.map((w) => w.jumlah));
  const min = Math.min(...words.map((w) => w.jumlah));
  // Urutan abjad agar kata besar tidak selalu menumpuk di awal.
  const sorted = [...words].sort((a, b) => a.kata.localeCompare(b.kata));
  const color: Record<Sentiment, string> = {
    positif: "var(--sent-pos)",
    negatif: "var(--sent-neg)",
    netral: "",
  };
  return (
    <div>
      <ul className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5" aria-label="Kata yang sering muncul bersama keyword">
        {sorted.map((w) => {
          const t = max === min ? 0.5 : (w.jumlah - min) / (max - min);
          return (
            <li
              key={w.kata}
              className={`font-bold leading-tight ${w.sentimen === "netral" ? "text-zinc-600 dark:text-zinc-300" : ""}`}
              style={{ fontSize: `${0.75 + t * 1.1}rem`, color: color[w.sentimen] || undefined }}
              title={`${w.kata}: ${w.jumlah} sebutan, cenderung ${w.sentimen}`}
            >
              {w.kata}
              <span className="sr-only">: {w.jumlah} sebutan, cenderung {w.sentimen}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-2xs text-zinc-500 dark:text-zinc-400">
        Ukuran = jumlah sebutan. Hijau cenderung positif, merah cenderung negatif, abu-abu netral.
      </p>
    </div>
  );
}
