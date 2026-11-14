/** Filter global menu Tren Sosial: lokasi, periode, platform. Disimpan di URL. */

export type TrendPeriod = "today" | "7d" | "30d";

export interface TrendFilters {
  /** Kode wilayah Kemendagri: "ID", "32", "32.71". */
  lokasi: string;
  lokasiNama: string;
  periode: TrendPeriod;
  /** Nama platform seperti di backend, atau "Semua". */
  platform: string;
}

export const DEFAULT_TREND_FILTERS: TrendFilters = {
  lokasi: "ID",
  lokasiNama: "Indonesia",
  periode: "today",
  platform: "Semua",
};

export const TREND_PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
];

// Facebook tidak dipantau (keputusan K4). Nilai harus sama dengan RawItem.platform di backend.
export const TREND_PLATFORMS: { value: string; label: string }[] = [
  { value: "Semua", label: "Semua platform" },
  { value: "TikTok", label: "TikTok" },
  { value: "Instagram", label: "Instagram" },
  { value: "YouTube", label: "YouTube" },
  { value: "Threads", label: "Threads" },
  { value: "X (Twitter)", label: "X" },
];

const PERIOD_VALUES = new Set(TREND_PERIODS.map((p) => p.value));
const PLATFORM_VALUES = new Set(TREND_PLATFORMS.map((p) => p.value));
const KODE_RE = /^(ID|\d{2}(\.\d{2})?)$/;

export function parseTrendFilters(search: string): TrendFilters {
  const q = new URLSearchParams(search);
  const lokasi = q.get("lokasi") || "";
  const periode = q.get("periode") as TrendPeriod;
  const platform = q.get("platform") || "";
  const validLokasi = KODE_RE.test(lokasi) ? lokasi : DEFAULT_TREND_FILTERS.lokasi;
  return {
    lokasi: validLokasi,
    lokasiNama:
      validLokasi === "ID" ? "Indonesia" : q.get("nama") || validLokasi,
    periode: PERIOD_VALUES.has(periode) ? periode : DEFAULT_TREND_FILTERS.periode,
    platform: PLATFORM_VALUES.has(platform) ? platform : DEFAULT_TREND_FILTERS.platform,
  };
}

export function trendFiltersToSearch(f: TrendFilters): string {
  const q = new URLSearchParams();
  if (f.lokasi !== "ID") {
    q.set("lokasi", f.lokasi);
    q.set("nama", f.lokasiNama);
  }
  if (f.periode !== DEFAULT_TREND_FILTERS.periode) q.set("periode", f.periode);
  if (f.platform !== DEFAULT_TREND_FILTERS.platform) q.set("platform", f.platform);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function periodLabel(p: TrendPeriod): string {
  return TREND_PERIODS.find((x) => x.value === p)?.label ?? p;
}

export function platformLabel(p: string): string {
  return TREND_PLATFORMS.find((x) => x.value === p)?.label ?? p;
}
