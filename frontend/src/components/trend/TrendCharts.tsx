"use client";

import { useRef, useState } from "react";
import { fmtNum } from "@/lib/format";

/** Warna seri dari token CSS (globals.css), urutan tetap: seri ke-n selalu slot ke-n. */
export const SERIES_VARS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"];
export const seriesColor = (i: number) => `var(${SERIES_VARS[i % SERIES_VARS.length]})`;

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= v / 4)! * mag;
  return Math.ceil(v / step) * step;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

/** Grafik batang satu seri (mis. postingan per hari). Judul di luar komponen menamai serinya. */
export function DailyBars({ data, unit = "postingan" }: { data: { tanggal: string; postingan: number }[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.postingan)));
  if (!data.length) return <p className="text-xs text-zinc-500">Belum ada data.</p>;
  const labelEvery = Math.ceil(data.length / 7);

  return (
    <div className="relative">
      <div className="flex text-2xs text-zinc-500 dark:text-zinc-400">
        <div className="flex w-8 shrink-0 flex-col justify-between pb-5 text-right font-mono" style={{ height: 180 }}>
          <span>{fmtNum(max)}</span>
          <span>{fmtNum(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative ml-2 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[160px]">
            <div className="absolute inset-x-0 top-0 border-t" style={{ borderColor: "var(--chart-grid)" }} />
            <div className="absolute inset-x-0 top-1/2 border-t" style={{ borderColor: "var(--chart-grid)" }} />
            <div className="absolute inset-x-0 bottom-0 border-t border-zinc-300 dark:border-zinc-700" />
          </div>
          <div className="flex h-[160px] items-end gap-[2px]">
            {data.map((d, i) => (
              <div
                key={d.tanggal}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${shortDate(d.tanggal)}: ${d.postingan} ${unit}`}
              >
                <div
                  className="w-full rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${(d.postingan / max) * 100}%`,
                    minHeight: d.postingan > 0 ? 2 : 0,
                    background: "var(--series-1)",
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex h-4 gap-[2px]">
            {data.map((d, i) => (
              <div key={d.tanggal} className="flex-1 truncate text-center">
                {i % labelEvery === 0 || i === data.length - 1 ? shortDate(d.tanggal) : ""}
              </div>
            ))}
          </div>
          {hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{shortDate(data[hover].tanggal)}</div>
              <div className="font-mono text-zinc-600 dark:text-zinc-300">
                {fmtNum(data[hover].postingan)} {unit}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Garis multi-seri untuk membandingkan keyword per hari. Legend selalu tampil, ada tampilan tabel. */
export function CompareLines({
  dates,
  series,
}: {
  dates: string[];
  series: { key: string; label: string; total: number; harian: number[] }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 600;
  const H = 200;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.harian)));
  const x = (i: number) => (dates.length <= 1 ? W / 2 : (i / (dates.length - 1)) * W);
  const y = (v: number) => H - (v / max) * H;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(dates.length - 1, Math.round(ratio * (dates.length - 1)))));
  };

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda">
        {series.map((s, i) => (
          <li key={s.key} className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <span className="h-0.5 w-4 rounded" style={{ background: seriesColor(i) }} aria-hidden="true" />
            <span className="font-semibold">{s.label}</span>
            <span className="font-mono text-zinc-500 dark:text-zinc-400">{fmtNum(s.total)}</span>
          </li>
        ))}
      </ul>

      <div className="flex text-2xs text-zinc-500 dark:text-zinc-400">
        <div className="flex w-8 shrink-0 flex-col justify-between text-right font-mono" style={{ height: 200 }}>
          <span>{fmtNum(max)}</span>
          <span>{fmtNum(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative ml-2 flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-[200px] w-full overflow-visible"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label="Grafik jumlah postingan per hari untuk keyword terpilih"
          >
            {[0, 0.5].map((f) => (
              <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--chart-grid)" vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={W} y1={H} y2={H} className="stroke-zinc-300 dark:stroke-zinc-700" vectorEffect="non-scaling-stroke" />
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="stroke-zinc-400 dark:stroke-zinc-500" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            )}
            {series.map((s, i) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={seriesColor(i)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                points={s.harian.map((v, j) => `${x(j)},${y(v)}`).join(" ")}
              />
            ))}
          </svg>
          {hover !== null &&
            series.map((s, i) => (
              <span
                key={s.key}
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white dark:border-zinc-950"
                style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(s.harian[hover]) / H) * 200}px`, background: seriesColor(i) }}
                aria-hidden="true"
              />
            ))}
          {hover !== null && (
            <div
              role="tooltip"
              className={`pointer-events-none absolute top-0 z-10 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900 ${
                hover > dates.length / 2 ? "-translate-x-full -ml-3" : "ml-3"
              }`}
              style={{ left: `${(x(hover) / W) * 100}%` }}
            >
              <div className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">{shortDate(dates[hover])}</div>
              {series.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
                  <span className="h-2 w-2 rounded-full" style={{ background: seriesColor(i) }} aria-hidden="true" />
                  <span className="truncate">{s.label}</span>
                  <span className="ml-auto pl-3 font-mono">{fmtNum(s.harian[hover])}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 flex justify-between">
            <span>{shortDate(dates[0])}</span>
            <span>{shortDate(dates[Math.floor(dates.length / 2)])}</span>
            <span>{shortDate(dates[dates.length - 1])}</span>
          </div>
        </div>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-300">Tampilkan tabel</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-3">Tanggal</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 pr-3 text-right">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {dates.map((d, j) => (
                <tr key={d}>
                  <td className="py-1 pr-3">{shortDate(d)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 pr-3 text-right font-mono">{s.harian[j]}</td>
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
