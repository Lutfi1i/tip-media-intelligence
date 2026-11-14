"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { fmtNum } from "@/lib/format";
import { platformLabel } from "@/lib/trendFilters";
import { fetchHashtagData, fetchKeyHistory, KeyHistory, KeyRow } from "@/lib/trendApi";
import { TrendPageHeader } from "@/components/trend/TrendPageHeader";
import { useTrendFilters } from "@/components/trend/TrendFiltersContext";
import { CompareLines, seriesColor } from "@/components/trend/TrendCharts";
import { BaselineNotice, Section, StatusBadge, TrendState, useTrendData } from "@/components/trend/TrendUi";

const MAX_COMPARE = 5;
const INITIAL_ROWS = 10;

function KeyTable({
  rows,
  selected,
  onToggle,
  extra,
}: {
  rows: KeyRow[];
  selected: string[];
  onToggle: (key: string) => void;
  extra?: { header: string; cell: (r: KeyRow) => React.ReactNode };
}) {
  const [showAll, setShowAll] = useState(false);
  if (rows.length === 0) return <p className="text-xs text-zinc-500">Belum ada data untuk filter ini.</p>;
  const visible = showAll ? rows : rows.slice(0, INITIAL_ROWS);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-zinc-500 dark:text-zinc-400">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-3">Kata</th>
            <th className="py-2 pr-3 text-right">Postingan</th>
            <th className="hidden py-2 pr-3 text-right sm:table-cell">Sumber</th>
            {extra && <th className="py-2 pr-3 text-right">{extra.header}</th>}
            <th className="py-2 pr-3">Tren</th>
            <th className="py-2"><span className="sr-only">Bandingkan</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {visible.map((r) => {
            const idx = selected.indexOf(r.key);
            return (
              <tr key={r.key}>
                <td className="py-2 pr-3">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.label}</div>
                  <div className="text-2xs text-zinc-500">{r.platform.map(platformLabel).join(", ")}</div>
                </td>
                <td className="py-2 pr-3 text-right font-mono">{fmtNum(r.jumlah)}</td>
                <td className="hidden py-2 pr-3 text-right sm:table-cell">
                  <span className="font-mono">{fmtNum(r.sumber)}</span>
                  {r.sumber < 2 && (
                    <span className="ml-1 rounded bg-amber-100 px-1 text-2xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" title="Hanya dipakai satu akun atau sumber, belum menyebar">
                      1 sumber
                    </span>
                  )}
                </td>
                {extra && <td className="py-2 pr-3 text-right font-mono">{extra.cell(r)}</td>}
                <td className="py-2 pr-3">
                  <StatusBadge status={r.status} growth={r.pertumbuhan_pct} />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onToggle(r.key)}
                    disabled={idx < 0 && selected.length >= MAX_COMPARE}
                    aria-pressed={idx >= 0}
                    title={idx >= 0 ? "Hapus dari grafik" : "Tambahkan ke grafik perbandingan"}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    style={idx >= 0 ? { borderColor: seriesColor(idx), color: seriesColor(idx) } : undefined}
                  >
                    {idx >= 0 ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > INITIAL_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
        >
          {showAll ? "Tampilkan lebih sedikit" : `Tampilkan semua (${rows.length})`}
        </button>
      )}
    </div>
  );
}

export default function HashtagKeywordPage() {
  const { filters } = useTrendFilters();
  const { data, loading, error, reload } = useTrendData(fetchHashtagData);
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const history = useTrendData<KeyHistory | null>(
    (f) => (selected.length ? fetchKeyHistory(f, selected) : Promise.resolve(null)),
    [selected.join("|")]
  );

  // Isi grafik dengan 3 hashtag multi-sumber teratas agar tidak kosong saat pertama dibuka.
  // Hanya sekali; pilihan pengguna setelahnya tidak ditimpa.
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || !data) return;
    autoPicked.current = true;
    const top = data.hashtag.filter((r) => r.sumber >= 2).slice(0, 3).map((r) => r.key);
    if (top.length) setSelected((s) => (s.length ? s : top));
  }, [data]);

  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : s.length >= MAX_COMPARE ? s : [...s, key]));

  const addFree = (e: FormEvent) => {
    e.preventDefault();
    const term = freeText.trim();
    if (term && !selected.includes(term) && selected.length < MAX_COMPARE) setSelected((s) => [...s, term]);
    setFreeText("");
  };

  return (
    <div className="space-y-6">
      <TrendPageHeader
        title="Hashtag & Keyword"
        description="Hashtag dan keyword yang sedang ramai, yang mulai naik, yang khas wilayah ini, dan riwayatnya selama 30 hari."
      />

      <Section
        title="Perbandingan dan riwayat tren (30 hari)"
        hint="Klik + di tabel di bawah, atau ketik keyword bebas. Maksimal 5."
      >
        <form onSubmit={addFree} className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Contoh: kuliner bogor atau #wisatabogor"
            aria-label="Tambah keyword"
            className="min-h-[36px] min-w-[14rem] flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={!freeText.trim() || selected.length >= MAX_COMPARE}
            className="min-h-[36px] rounded-md bg-zinc-900 px-4 text-xs font-bold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Tambahkan
          </button>
          {selected.length > 0 && (
            <button type="button" onClick={() => setSelected([])} className="min-h-[36px] px-2 text-xs font-semibold text-zinc-600 hover:underline dark:text-zinc-300">
              Kosongkan
            </button>
          )}
        </form>
        {selected.length === 0 ? (
          <p className="text-xs text-zinc-500">Belum ada keyword yang dipilih.</p>
        ) : history.error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{history.error}</p>
        ) : history.data ? (
          <div className={history.loading ? "opacity-60" : ""}>
            <CompareLines dates={history.data.tanggal} series={history.data.seri} />
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Memuat riwayat...</p>
        )}
      </Section>

      <TrendState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data && (
          <>
            <BaselineNotice baseline={data.baseline} />

            <Section title="Keyword yang mulai naik" hint="Hashtag atau frasa dari minimal dua sumber dengan laju tercepat dibanding periode sebelumnya.">
              {data.mulai_naik.length === 0 ? (
                <p className="text-xs text-zinc-500">Belum ada keyword yang naik pada filter ini.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.mulai_naik.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => toggle(r.key)}
                      className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{r.label}</span>
                      <span className="font-mono text-xs text-zinc-500">{fmtNum(r.jumlah)}</span>
                      <StatusBadge status={r.status} />
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {filters.lokasi !== "ID" && (
              <Section
                title={`Keyword lokal ${filters.lokasiNama}`}
                hint="Kata yang porsinya di wilayah ini minimal dua kali lipat porsinya secara nasional. Kolom Lokal = persen kemunculan nasional yang berasal dari wilayah ini."
              >
                <KeyTable
                  rows={data.lokal}
                  selected={selected}
                  onToggle={toggle}
                  extra={{ header: "Lokal", cell: (r) => `${r.porsi_lokal_pct ?? "-"}%` }}
                />
              </Section>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Section title="Trending hashtag" hint={`Dari ${fmtNum(data.postingan)} postingan.`}>
                <KeyTable rows={data.hashtag} selected={selected} onToggle={toggle} />
              </Section>
              <Section title="Trending keyword" hint="Frasa dua kata yang sering muncul bersama.">
                <KeyTable rows={data.keyword} selected={selected} onToggle={toggle} />
              </Section>
            </div>
          </>
        )}
      </TrendState>
    </div>
  );
}
