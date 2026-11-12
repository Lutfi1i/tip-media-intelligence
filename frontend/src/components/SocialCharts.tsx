"use client";

import { useState } from "react";
import type { SocialTimelineBucket, SocialVelocityStatus } from "@/lib/api";

export const VELOCITY_STYLE: Record<SocialVelocityStatus | "TIDAK ADA", { badge: string; dot: string; hint: string }> = {
  "LONJAKAN TINGGI": {
    badge: "bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/30 dark:text-rose-300",
    dot: "bg-rose-500",
    hint: "Volume jauh di atas baseline (rasio >= 3x atau z-score >= 3)",
  },
  MENINGKAT: {
    badge: "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300",
    dot: "bg-amber-500",
    hint: "Volume naik di atas baseline (rasio >= 1,5x atau z-score >= 1,5)",
  },
  BARU: {
    badge: "bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/30 dark:text-violet-300",
    dot: "bg-violet-500",
    hint: "Belum ada baseline untuk dibandingkan: data periode sebelumnya belum terkumpul",
  },
  STABIL: {
    badge: "bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/30 dark:text-sky-300",
    dot: "bg-sky-500",
    hint: "Volume sesuai baseline",
  },
  MENURUN: {
    badge: "bg-slate-500/15 text-slate-700 ring-1 ring-slate-500/30 dark:text-slate-300",
    dot: "bg-slate-500",
    hint: "Volume di bawah baseline",
  },
  "SINYAL LEMAH": {
    badge: "bg-zinc-500/10 text-zinc-600 ring-1 ring-zinc-500/20 dark:text-zinc-400",
    dot: "bg-zinc-400",
    hint: "Volume di bawah ambang minimum untuk disebut lonjakan",
  },
  "TIDAK ADA": {
    badge: "bg-zinc-500/10 text-zinc-500 ring-1 ring-zinc-500/20 dark:text-zinc-400",
    dot: "bg-zinc-300",
    hint: "Tidak ada percakapan yang cocok",
  },
};

export function VelocityBadge({ status }: { status: SocialVelocityStatus | "TIDAK ADA" }) {
  const style = VELOCITY_STYLE[status] ?? VELOCITY_STYLE.STABIL;
  return (
    <span
      title={style.hint}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-bold whitespace-nowrap ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {status}
    </span>
  );
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Backend mengirim waktu UTC tanpa zona ("2026-11-12T08:04:00"). Parse sebagai UTC. */
export function parseUtc(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
}

/** Rentang tanggal WIB relatif hari ini, mis. wibDateRange(-13, -7) = minggu sebelum minggu lalu. */
export function wibDateRange(startOffset: number, endOffset: number): { start: string; end: string } {
  const day = (o: number) => new Date(Date.now() + 7 * 3600_000 + o * 86_400_000).toISOString().slice(0, 10);
  return { start: day(startOffset), end: day(endOffset) };
}

/** Format waktu dalam WIB (Asia/Jakarta), tidak bergantung zona waktu peramban. */
export function formatWib(iso: string | null | undefined, withDate = true): string {
  if (!iso) return "-";
  return parseUtc(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    ...(withDate ? { day: "2-digit", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bucketLabel(iso: string, withDate: boolean): string {
  return formatWib(iso, withDate);
}

/** Sparkline batang kecil untuk baris tabel. Satu seri, tooltip native per batang. */
export function Sparkline({
  data,
  width = 112,
  height = 28,
  label,
}: {
  data: SocialTimelineBucket[];
  width?: number;
  height?: number;
  label: string;
}) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const gap = 1;
  const barW = Math.max(1, (width - gap * (data.length - 1)) / data.length);
  const total = data.reduce((a, b) => a + b.count, 0);
  const withDate = data.length > 1 && new Date(data[data.length - 1].t).getTime() - new Date(data[0].t).getTime() > 86_400_000;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${total} konten, puncak ${max} per interval`}
      className="overflow-visible"
    >
      <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} className="stroke-zinc-200 dark:stroke-zinc-700" strokeWidth={1} />
      {data.map((d, i) => {
        const h = d.count === 0 ? 0 : Math.max(2, (d.count / max) * (height - 2));
        return (
          <g key={d.t}>
            <rect x={i * (barW + gap)} y={0} width={barW} height={height} fill="transparent">
              <title>{`${bucketLabel(d.t, withDate)} WIB: ${d.count} konten`}</title>
            </rect>
            {h > 0 && (
              <rect
                x={i * (barW + gap)}
                y={height - h}
                width={barW}
                height={h}
                rx={Math.min(1.5, barW / 2)}
                className="fill-fuchsia-500 dark:fill-fuchsia-400 pointer-events-none"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Grafik volume per interval dengan garis baseline. Satu seri, sorotan + tooltip saat hover.
 * Plot SVG meregang ke lebar wadah dengan tinggi tetap; label sumbu berupa HTML agar ukuran
 * teksnya tidak ikut terskala di layar lebar maupun sempit.
 */
export function VolumeTimeline({
  data,
  baselinePerBucket,
  height = 140,
  title,
}: {
  data: SocialTimelineBucket[];
  baselinePerBucket: number | null;
  height?: number;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return null;

  const n = data.length;
  const max = Math.max(1, Math.ceil(Math.max(baselinePerBucket ?? 0, ...data.map((d) => d.count))));
  const slot = 100 / n;
  const gapPct = Math.min(0.6, slot * 0.2);
  const pctY = (v: number) => 100 - (v / max) * 100;
  const spanMs = parseUtc(data[n - 1].t).getTime() - parseUtc(data[0].t).getTime();
  const withDate = spanMs > 86_400_000;
  const tickEvery = Math.max(1, Math.round(n / 6));
  const total = data.reduce((a, b) => a + b.count, 0);
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a), data[0]);

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-2xs text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{title}</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-fuchsia-500 dark:bg-fuchsia-400" aria-hidden="true" /> Volume per interval
          </span>
          {baselinePerBucket !== null && (
            <span className="inline-flex items-center gap-1">
              <svg width="14" height="4" aria-hidden="true">
                <line x1="0" x2="14" y1="2" y2="2" className="stroke-zinc-500" strokeWidth="2" strokeDasharray="3 2" />
              </svg>
              Rata-rata baseline
            </span>
          )}
        </span>
      </figcaption>

      <div className="flex gap-2">
        <div className="flex w-6 shrink-0 flex-col justify-between text-right font-mono text-[10px] leading-none text-zinc-400" style={{ height }} aria-hidden="true">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>

        <div className="relative min-w-0 flex-1">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="block w-full"
            style={{ height }}
            role="img"
            aria-label={`${title}: total ${total} konten, puncak ${peak.count} pada ${bucketLabel(peak.t, withDate)} WIB`}
            onMouseLeave={() => setHover(null)}
          >
            {[0, 50, 100].map((yy) => (
              <line key={yy} x1={0} x2={100} y1={yy} y2={yy} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {data.map((d, i) => {
              const x = i * slot;
              return (
                <g key={d.t} onMouseEnter={() => setHover(i)}>
                  <rect x={x} y={0} width={slot} height={100} className={hover === i ? "fill-zinc-500/10" : "fill-transparent"} />
                  {d.count > 0 && (
                    <rect
                      x={x + gapPct / 2}
                      y={pctY(d.count)}
                      width={slot - gapPct}
                      height={100 - pctY(d.count)}
                      className="fill-fuchsia-500 dark:fill-fuchsia-400 pointer-events-none"
                    />
                  )}
                </g>
              );
            })}
            {baselinePerBucket !== null && (
              <line
                x1={0}
                x2={100}
                y1={pctY(baselinePerBucket)}
                y2={pctY(baselinePerBucket)}
                className="stroke-zinc-500 pointer-events-none"
                strokeWidth={2}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          <div className="relative mt-1 h-4 text-[10px] text-zinc-400" aria-hidden="true">
            {data.map((d, i) =>
              i % tickEvery === 0 ? (
                <span key={d.t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(i + 0.5) * slot}%` }}>
                  {bucketLabel(d.t, withDate)}
                </span>
              ) : null
            )}
          </div>

          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-2xs text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
              style={{ left: `${Math.min(90, Math.max(10, (hover + 0.5) * slot))}%` }}
            >
              <div className="font-semibold">{bucketLabel(data[hover].t, true)} WIB</div>
              <div>{data[hover].count} konten</div>
              {baselinePerBucket !== null && <div className="opacity-75">Baseline {baselinePerBucket.toFixed(2)}</div>}
            </div>
          )}
        </div>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Waktu (WIB)</th>
            <th scope="col">Konten</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.t}>
              <td>{bucketLabel(d.t, true)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
