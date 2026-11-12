"use client";

import { FormEvent, useEffect, useState } from "react";
import { SocialFacets, SocialSearchResult, searchSocialContent, socialSearchExportUrl, SocialSearchParams } from "@/lib/api";
import { RealBrandIcon } from "@/components/SourceLogos";
import { formatCompact, formatWib } from "@/components/SocialCharts";

const PLATFORMS = ["", "X (Twitter)", "TikTok", "YouTube", "Threads", "Instagram", "Reddit", "Telegram"];
const EMOTIONS: [string, string][] = [["marah", "Marah"], ["takut", "Takut"], ["sedih", "Sedih"], ["kecewa", "Kecewa"], ["senang", "Senang"], ["terkejut", "Terkejut"]];
const inputCls =
  "mt-0.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export function SocialContentSearch({
  timeRange,
  scopeKode,
  scopeMode,
  facets,
}: {
  timeRange: string;
  scopeKode: string;
  scopeMode: string;
  facets: SocialFacets | null;
}) {
  const [draft, setDraft] = useState<SocialSearchParams>({ q: "", platform: "", category: "", agency: "", emotion: "", sentimen: "", author: "", sort: "terbaru" });
  const [params, setParams] = useState<SocialSearchParams>(draft);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SocialSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchSocialContent({ ...params, time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode }, page)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Pencarian gagal."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [params, page, timeRange, scopeKode, scopeMode]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setParams({ ...draft });
  };

  const set = (k: keyof SocialSearchParams, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const exportUrl = socialSearchExportUrl({ ...params, time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Cari Konten</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Cari di semua konten medsos yang tersimpan{data ? `, ${data.period.label}` : ""}. Semua kata harus muncul; gunakan tanda kutip untuk frasa,
          mis. &quot;jalan rusak&quot;.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-2 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col text-2xs text-zinc-500 sm:col-span-2">
          Kata kunci
          <input value={draft.q} onChange={(e) => set("q", e.target.value)} placeholder='mis. PLN padam atau "jalan rusak"' className={inputCls} />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Akun
          <input value={draft.author} onChange={(e) => set("author", e.target.value)} placeholder="@namaakun" className={inputCls} />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Platform
          <select value={draft.platform} onChange={(e) => set("platform", e.target.value)} className={inputCls}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p || "Semua platform"}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Kategori
          <select value={draft.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
            <option value="">Semua kategori</option>
            {facets?.categories.filter((c) => c.id !== "lainnya").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Instansi
          <select value={draft.agency} onChange={(e) => set("agency", e.target.value)} className={inputCls}>
            <option value="">Semua instansi</option>
            {facets?.agencies.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Emosi
          <select value={draft.emotion} onChange={(e) => set("emotion", e.target.value)} className={inputCls}>
            <option value="">Semua emosi</option>
            {EMOTIONS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Sentimen
          <select value={draft.sentimen} onChange={(e) => set("sentimen", e.target.value)} className={inputCls}>
            <option value="">Semua sentimen</option>
            <option value="negatif">Negatif</option>
            <option value="netral">Netral</option>
            <option value="positif">Positif</option>
            <option value="campuran">Campuran</option>
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Urutkan
          <select value={draft.sort} onChange={(e) => set("sort", e.target.value)} className={inputCls}>
            <option value="terbaru">Terbaru</option>
            <option value="terlama">Terlama</option>
            <option value="jangkauan">Jangkauan tertinggi</option>
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className="rounded-lg bg-fuchsia-600 px-4 py-2 text-xs font-semibold text-white hover:bg-fuchsia-700">Cari</button>
          <a href={exportUrl} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
            Unduh CSV
          </a>
        </div>
      </form>

      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      {data && (
        <p className="text-xs text-zinc-500">
          {data.total.toLocaleString("id-ID")} konten ditemukan{loading ? ", memuat..." : ""}. Halaman {data.page} dari {data.pages}.
        </p>
      )}

      <ul className="space-y-2">
        {data?.items.map((r) => (
          <li key={r.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-2 text-2xs text-zinc-500">
              <RealBrandIcon name={r.platform} className="h-4 w-4" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{r.penulis ?? r.penerbit ?? r.platform}</span>
              <span className="font-mono">{formatWib(r.published_at)} WIB</span>
              <span className="capitalize">{r.sentimen}</span>
              {r.emosi.map((e) => <span key={e} className="rounded-full bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{e}</span>)}
              {r.kategori.map((c) => <span key={c} className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">{c}</span>)}
              {r.instansi.map((a) => <span key={a} className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">{a}</span>)}
              {r.lokasi && <span>{r.lokasi}</span>}
            </div>
            <p className="mt-1 text-zinc-800 [overflow-wrap:anywhere] dark:text-zinc-200">{r.isi || r.judul}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-2xs text-zinc-500">
              {r.engagement.views !== null && <span>{formatCompact(r.engagement.views)} tayangan</span>}
              {r.engagement.interactions !== null && <span>{formatCompact(r.engagement.interactions)} interaksi</span>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                  Buka sumber
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      {data && data.pages > 1 && (
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-zinc-700">
            Sebelumnya
          </button>
          <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-zinc-700">
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}
