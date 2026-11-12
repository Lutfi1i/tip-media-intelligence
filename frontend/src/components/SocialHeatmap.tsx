"use client";

import type { SocialHeatmap as HeatmapData } from "@/lib/api";

// Skala berurutan satu warna (fuchsia), terang ke gelap. Teks berganti putih pada dua tingkat tergelap.
const STEPS = [0.12, 0.26, 0.42, 0.62, 0.85];

function step(count: number, max: number): number {
  if (count <= 0 || max <= 0) return -1;
  return Math.min(STEPS.length - 1, Math.floor((count / max) * STEPS.length - 1e-9));
}

function ranges(max: number): string[] {
  return STEPS.map((_, i) => {
    const lo = Math.floor((i / STEPS.length) * max) + 1;
    const hi = Math.max(lo, Math.floor(((i + 1) / STEPS.length) * max));
    return lo === hi ? `${lo}` : `${lo}-${hi}`;
  });
}

export function SocialHeatmap({
  data,
  isLoading,
  onPickCategory,
}: {
  data: HeatmapData | null;
  isLoading: boolean;
  onPickCategory: (categoryId: string) => void;
}) {
  if (!data) {
    return <p className="text-sm text-zinc-500">{isLoading ? "Menyusun peta panas..." : "Data belum tersedia."}</p>;
  }
  const { rows, columns, max_cell: max } = data;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Peta Panas Wilayah x Kategori</h2>
          <p className="max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">
            Jumlah konten medsos per kota/kabupaten dan kategori, {data.period.label}. Lokasi kecamatan atau kawasan dinaikkan ke kota/kabupatennya.
            {` ${data.located} dari ${data.total} konten punya lokasi; ${data.unlocated} tanpa lokasi tidak ditampilkan.`} Klik sel untuk melihat tren kategori itu.
          </p>
        </div>
        {max > 0 && (
          <div className="flex items-center gap-1 text-2xs text-zinc-500" aria-label="Legenda skala jumlah konten">
            <span className="mr-1">Konten:</span>
            {ranges(max).map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="inline-block h-3 w-5 rounded-sm" style={{ backgroundColor: `rgba(192, 38, 211, ${STEPS[i]})` }} />
                <span className="mr-1">{r}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Belum ada konten berlokasi pada periode ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="text-xs">
            <caption className="sr-only">Jumlah konten per wilayah dan kategori</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-2xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                  Wilayah
                </th>
                <th scope="col" className="px-2 py-2 text-right text-2xs uppercase tracking-wider text-zinc-500">Total</th>
                {columns.map((c) => (
                  <th key={c.id} scope="col" className="p-0.5 align-bottom">
                    {/* Label diputar diposisikan absolut agar tidak melebarkan kolom. */}
                    <div className="relative h-28 w-10">
                      <span className="absolute bottom-1 left-4 origin-bottom-left -rotate-45 whitespace-nowrap text-2xs font-medium text-zinc-600 dark:text-zinc-300">
                        {c.label}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.region} className="border-t border-zinc-100 dark:border-zinc-800">
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 text-left font-medium text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {r.region}
                  </th>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                    {r.total}
                    {r.negative > 0 && <span className="ml-1 text-2xs text-zinc-500">({r.negative} neg)</span>}
                  </td>
                  {columns.map((c) => {
                    const cell = r.cells[c.id];
                    const s = cell ? step(cell.count, max) : -1;
                    return (
                      <td key={c.id} className="p-0.5">
                        {cell ? (
                          <button
                            onClick={() => onPickCategory(c.id)}
                            title={`${r.region}, ${c.label}: ${cell.count} konten, ${cell.negative} negatif`}
                            className={`h-8 w-10 rounded-sm font-mono text-2xs font-semibold ring-offset-1 hover:ring-2 hover:ring-fuchsia-500 ${
                              s >= 3 ? "text-white" : "text-zinc-800 dark:text-zinc-100"
                            }`}
                            style={{ backgroundColor: `rgba(192, 38, 211, ${STEPS[Math.max(s, 0)]})` }}
                          >
                            {cell.count}
                          </button>
                        ) : (
                          <span className="block h-8 w-10" aria-hidden="true" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
