"use client";

import type { SocialFacets, SocialSort } from "@/lib/api";

const SORT_LABEL: Record<SocialSort, string> = {
  laju: "Laju tertinggi",
  terbaru: "Terbaru",
  volume: "Volume terbanyak",
  negatif: "Paling banyak keluhan",
};

export function SocialFilterBar({
  facets,
  category,
  agency,
  sort,
  onCategory,
  onAgency,
  onSort,
}: {
  facets: SocialFacets | null;
  category: string;
  agency: string;
  sort: SocialSort;
  onCategory: (id: string) => void;
  onAgency: (id: string) => void;
  onSort: (s: SocialSort) => void;
}) {
  const categories = facets?.categories ?? [];
  const agencies = facets?.agencies ?? [];
  const groups = Array.from(new Set(agencies.map((a) => a.group)));
  // Kategori tanpa konten disembunyikan agar pill tetap ringkas, kecuali yang sedang dipilih.
  const visibleCats = categories.filter((c) => c.count > 0 || c.id === category);
  const hasFilter = Boolean(category || agency);

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="agency-filter" className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Instansi
          </label>
          <select
            id="agency-filter"
            value={agency}
            onChange={(e) => onAgency(e.target.value)}
            className="max-w-[16rem] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="">Semua instansi</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {agencies
                  .filter((a) => a.group === g)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} ({a.count}
                      {a.negative ? `, ${a.negative} negatif` : ""})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          <label htmlFor="sort-filter" className="ml-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Urutkan
          </label>
          <select
            id="sort-filter"
            value={sort}
            onChange={(e) => onSort(e.target.value as SocialSort)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {(Object.keys(SORT_LABEL) as SocialSort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        {hasFilter && (
          <button
            onClick={() => {
              onCategory("");
              onAgency("");
            }}
            className="self-start text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400"
          >
            Hapus filter
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter kategori">
        <button
          onClick={() => onCategory("")}
          aria-pressed={!category}
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
            !category
              ? "bg-fuchsia-600 text-white ring-fuchsia-600"
              : "bg-zinc-50 text-zinc-700 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
          }`}
        >
          Semua kategori{facets ? ` (${facets.total})` : ""}
        </button>
        {visibleCats.map((c) => {
          const active = c.id === category;
          return (
            <button
              key={c.id}
              onClick={() => onCategory(active ? "" : c.id)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                active
                  ? "bg-fuchsia-600 text-white ring-fuchsia-600"
                  : "bg-zinc-50 text-zinc-700 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
              }`}
            >
              {c.label} <span className={active ? "text-white/80" : "text-zinc-400"}>{c.count}</span>
            </button>
          );
        })}
        {facets && visibleCats.length === 0 && <span className="text-xs text-zinc-500">Belum ada konten pada rentang ini.</span>}
      </div>
      <p className="text-2xs text-zinc-500">
        Satu konten bisa masuk lebih dari satu kategori dan menyebut beberapa instansi. Angka di setiap pilihan sudah memperhitungkan filter lain
        yang aktif.
      </p>
    </div>
  );
}
