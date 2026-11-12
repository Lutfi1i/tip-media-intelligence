"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchPeriodComparison, SocialComparison, SocialDeltaRow } from "@/lib/api";
import { formatCompact, wibDateRange } from "@/components/SocialCharts";

function Delta({ row }: { row: Pick<SocialDeltaRow, "delta" | "change_pct" | "b"> }) {
  if (row.delta === 0) return <span className="text-zinc-400">tetap</span>;
  const up = row.delta > 0;
  return (
    <span className={up ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}>
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {row.delta}
      {row.change_pct !== null ? ` (${up ? "+" : ""}${row.change_pct}%)` : row.b === 0 ? " (baru)" : ""}
    </span>
  );
}

const TOPIC_STATUS: Record<string, string> = {
  baru: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  naik: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  turun: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  hilang: "bg-zinc-500/10 text-zinc-500",
  tetap: "bg-zinc-500/10 text-zinc-500",
};

function DeltaTable({
  title,
  rows,
  extra,
  empty,
}: {
  title: string;
  rows: SocialDeltaRow[];
  extra?: (r: SocialDeltaRow) => React.ReactNode;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-zinc-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-2xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-2">Nama</th>
                <th scope="col" className="px-4 py-2 text-right">Periode ini</th>
                <th scope="col" className="px-4 py-2 text-right">Pembanding</th>
                <th scope="col" className="px-4 py-2 text-right">Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-zinc-800 dark:text-zinc-200">
                    {r.label} {extra?.(r)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{r.a}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-500">{r.b}</td>
                  <td className="px-4 py-2 text-right">
                    <Delta row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SocialPeriodComparison({
  timeRange,
  scopeKode,
  scopeMode,
  multiCodes,
  platform,
}: {
  timeRange: string;
  scopeKode: string;
  scopeMode: string;
  multiCodes?: string;
  platform?: string;
}) {
  const [data, setData] = useState<SocialComparison | null>(null);
  const [compare, setCompare] = useState<{ start: string; end: string } | null>(null);
  const [draft, setDraft] = useState(() => wibDateRange(-13, -7));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPeriodComparison(timeRange, scopeKode, scopeMode, multiCodes, platform, compare ?? undefined)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Perbandingan gagal dimuat."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [timeRange, scopeKode, scopeMode, multiCodes, platform, compare]);

  const applyCustom = (e: FormEvent) => {
    e.preventDefault();
    if (draft.end < draft.start) return setError("Tanggal akhir pembanding lebih awal dari tanggal mulai.");
    setCompare({ ...draft });
  };

  const cards: { label: string; key: "mentions" | "negative_pct" | "accounts" | "views"; suffix?: string }[] = [
    { label: "Konten", key: "mentions" },
    { label: "Negatif", key: "negative_pct", suffix: "%" },
    { label: "Akun unik", key: "accounts" },
    { label: "Tayangan", key: "views" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Bandingkan Periode</h2>
          {data && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <strong className="text-zinc-700 dark:text-zinc-300">{data.period_a.label}</strong> dibandingkan dengan{" "}
              <strong className="text-zinc-700 dark:text-zinc-300">{data.period_b.label}</strong>, {data.scope_name}.
            </p>
          )}
        </div>
        <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-2 text-2xs text-zinc-500">
          <button
            type="button"
            onClick={() => setCompare(null)}
            aria-pressed={!compare}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
              !compare ? "bg-fuchsia-600 text-white ring-fuchsia-600" : "text-zinc-700 ring-zinc-300 dark:text-zinc-200 dark:ring-zinc-700"
            }`}
          >
            Periode sebelumnya
          </button>
          <label className="flex flex-col">
            Pembanding dari
            <input type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              className="mt-0.5 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
          </label>
          <label className="flex flex-col">
            sampai
            <input type="date" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              className="mt-0.5 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
          </label>
          <button type="submit" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            Bandingkan
          </button>
        </form>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
      {data?.note && <p className="text-xs text-amber-700 dark:text-amber-400">{data.note}</p>}
      {loading && !data && <p className="text-sm text-zinc-500">Menghitung perbandingan...</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((c) => {
              const a = data.summary_a[c.key];
              const b = data.summary_b[c.key];
              return (
                <div key={c.key} className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="text-2xs font-semibold uppercase tracking-wider text-zinc-500">{c.label}</div>
                  <div className="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
                    {a === null ? "-" : c.key === "views" ? formatCompact(a) : a}
                    {a !== null && c.suffix}
                  </div>
                  <div className="text-2xs text-zinc-500">
                    pembanding {b === null ? "-" : c.key === "views" ? formatCompact(b) : b}
                    {b !== null && c.suffix}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DeltaTable title="Topik" rows={data.topics} empty="Belum ada topik yang muncul di kedua periode."
              extra={(r) => r.status && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-3xs font-semibold ${TOPIC_STATUS[r.status] ?? ""}`}>{r.status}</span>} />
            <DeltaTable title="Kategori" rows={data.categories} empty="Belum ada konten berkategori." />
            <DeltaTable title="Instansi" rows={data.agencies} empty="Belum ada instansi yang disebut."
              extra={(r) => <span className="text-2xs text-zinc-500">(negatif {r.negative_a ?? 0} / {r.negative_b ?? 0})</span>} />
            <section className="space-y-4">
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Emosi (persentase konten)</h3>
                {data.emotions.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">Tidak ada kata emosi terdeteksi.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs">
                    {data.emotions.map((e) => (
                      <li key={e.id} className="flex justify-between gap-2">
                        <span className="text-zinc-700 dark:text-zinc-300">{e.label}</span>
                        <span className="font-mono">
                          {e.a_pct}% <span className="text-zinc-400">vs {e.b_pct}%</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <DeltaTable title="Platform" rows={data.platforms} empty="Belum ada konten." />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
