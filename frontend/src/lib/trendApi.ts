/** Klien API menu Tren Sosial (/api/v1/tren). Bentuk data mengikuti backend/app/services/trend_service.py. */

import { API_BASE_URL } from "./api";
import { TrendFilters } from "./trendFilters";

export interface PeriodInfo {
  key: string;
  start: string;
  end: string;
  label: string;
}

export interface Engagement {
  posts_with_data: number;
  coverage_pct: number;
  likes: number | null;
  shares: number | null;
  replies: number | null;
  views: number | null;
  interactions: number | null;
}

export interface Activity {
  postingan: number;
  akun_unik: number;
  sentimen_pct: Record<string, number>;
  platform: Record<string, number>;
  engagement: Engagement;
  timeline: { t: string; count: number }[];
}

export interface Baseline {
  tersedia: number;
  target: number;
}

export interface PostBrief {
  id: number;
  judul: string;
  url: string | null;
  platform: string;
  penulis: string | null;
  published_at: string;
  sentimen: string;
  views: number | null;
  interaksi: number | null;
}

export interface KeyCount {
  key: string;
  label: string;
  jumlah: number;
  sumber: number;
}

export interface RegionTrends {
  periode: PeriodInfo;
  lokasi: { kode: string; nama: string };
  aktivitas: Activity;
  baseline: Baseline;
  top_tren: {
    topic_key: string;
    topik: string;
    kategori: string;
    postingan: number;
    status: string;
    pertumbuhan_pct: number | null;
    platform: string[];
    hashtag: string[];
  }[];
  bagian: { id: string; judul: string; postingan: number; kata_kunci: KeyCount[]; contoh: PostBrief[] }[];
  berita: { id: number; judul: string; url: string; penerbit: string; published_at: string }[];
  sub_wilayah: { kode: string; nama: string; postingan: number; negatif: number }[];
}

export interface LiveStats {
  periode: PeriodInfo;
  aktivitas: Activity;
  sentimen: Record<string, number>;
  kata_teratas: KeyCount[];
  lokasi_teratas: { nama: string; postingan: number }[];
  lokasi_terdeteksi: number;
  sorotan: { topik: string; postingan: number; lokasi: string | null; sentimen_negatif_pct: number } | null;
}

export interface KeyRow {
  key: string;
  label: string;
  jumlah: number;
  akun: number;
  sumber: number;
  platform: string[];
  status: string;
  pertumbuhan_pct: number | null;
  skor_laju: number;
  porsi_lokal_pct?: number;
}

export interface HashtagData {
  periode: PeriodInfo;
  postingan: number;
  baseline: Baseline;
  hashtag: KeyRow[];
  keyword: KeyRow[];
  mulai_naik: KeyRow[];
  lokal: KeyRow[];
}

export interface KeyHistory {
  tanggal: string[];
  seri: { key: string; label: string; total: number; harian: number[] }[];
}

export interface ViralItem extends PostBrief {
  isi: string;
  jenis: string;
  likes: number | null;
  komentar: number | null;
  shares: number | null;
  followers: number | null;
  kategori: string[];
  laju_per_jam: number;
}

export interface ViralData {
  periode: PeriodInfo;
  total_postingan: number;
  dengan_metrik: number;
  tanpa_metrik: Record<string, number>;
  konten: ViralItem[];
}

export interface AccountRow {
  akun: string;
  platform: string[];
  postingan: number;
  followers: number | null;
  pertumbuhan_followers: number | null;
  total_views: number | null;
  rata_views: number | null;
  total_interaksi: number | null;
  engagement_rate_pct: number | null;
  kategori: string[];
  wilayah: string | null;
  contoh_url: string | null;
}

export interface AccountData {
  periode: PeriodInfo;
  total_postingan: number;
  postingan_dengan_akun: number;
  akun_dengan_metrik: number;
  akun: AccountRow[];
  teratas_per_platform: Record<string, AccountRow[]>;
}

export interface ReportData {
  periode: PeriodInfo;
  lokasi: { kode: string; nama: string };
  platform_filter: string;
  ringkasan: {
    postingan: number;
    akun_unik: number;
    tren: number;
    tren_naik: number;
    sentimen_pct: Record<string, number>;
    engagement: Engagement;
  };
  baseline: Baseline;
  topik: { topik: string; kategori: string; postingan: number; status: string; pertumbuhan_pct: number | null; negatif_pct: number; hashtag: string[] }[];
  platform: { platform: string; postingan: number; akun: number; interaksi: number | null; views: number | null; negatif_pct: number }[];
  wilayah: { kode: string; nama: string; postingan: number; negatif: number }[];
  harian: { tanggal: string; postingan: number }[];
  hashtag: KeyCount[];
  keyword: KeyCount[];
}

export interface TopicAi {
  ringkasan: string;
  penyebab_viral: string[];
  sentimen: string;
  potensi_konten: { tingkat: string; alasan: string };
  ide_konten: { judul: string; format: string; platform: string[]; alasan: string }[];
  caption: string;
  hashtag: string[];
  brief_video: {
    judul: string;
    durasi_detik: number | null;
    hook: string;
    adegan: { detik: string; visual: string; narasi: string }[];
    cta: string;
  };
}

export interface TopicAnalysis {
  topic_key: string;
  topik: string;
  postingan: number;
  platform: string[];
  sentimen_pct: Record<string, number>;
  kategori: string[];
  lokasi: string[];
  status: string;
  tren_baru: boolean;
  pertumbuhan_pct: number | null;
  prediksi: { arah: string; alasan: string; catatan: string };
  sumber: PostBrief[];
  ai: TopicAi | null;
  ai_error?: string;
  ai_meta?: { model: string; token: number | null; dibuat: string };
  cache?: boolean;
}

export interface TrendSummary {
  ai: {
    ringkasan: string;
    poin: { topik: string; insight: string }[];
    rekomendasi_topik: { topik: string; alasan: string; platform?: string[] }[];
  } | null;
  ai_error?: string;
  ai_meta?: { model: string; token: number | null; dibuat: string };
  tren: number;
  cache?: boolean;
}

export function trendQuery(f: TrendFilters, extra?: Record<string, string | undefined>): string {
  const q = new URLSearchParams({ periode: f.periode, lokasi: f.lokasi, platform: f.platform });
  for (const [k, v] of Object.entries(extra || {})) if (v) q.set(k, v);
  return q.toString();
}

async function getJson<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/tren/${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    let detail = fallback;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // abaikan, pakai pesan bawaan
    }
    throw new Error(detail);
  }
  return res.json();
}

export const fetchRegionTrends = (f: TrendFilters) => getJson<RegionTrends>(`wilayah?${trendQuery(f)}`, "Data wilayah gagal dimuat");
export const fetchLiveStats = (f: TrendFilters) => getJson<LiveStats>(`live?${trendQuery(f)}`, "Statistik live gagal dimuat");
export const fetchHashtagData = (f: TrendFilters) => getJson<HashtagData>(`hashtag?${trendQuery(f)}`, "Data hashtag gagal dimuat");
export const fetchKeyHistory = (f: TrendFilters, keys: string[]) =>
  getJson<KeyHistory>(`hashtag/riwayat?${trendQuery(f, { keys: keys.join(",") })}`, "Riwayat keyword gagal dimuat");
export const fetchViral = (f: TrendFilters, urut: string, kategori?: string) =>
  getJson<ViralData>(`viral?${trendQuery(f, { urut, kategori })}`, "Konten viral gagal dimuat");
export const fetchAccounts = (f: TrendFilters, urut: string) =>
  getJson<AccountData>(`akun?${trendQuery(f, { urut })}`, "Data akun gagal dimuat");
export const fetchReport = (f: TrendFilters) => getJson<ReportData>(`laporan?${trendQuery(f)}`, "Data laporan gagal dimuat");
export const reportFileUrl = (f: TrendFilters, kind: "pdf" | "excel") => `${API_BASE_URL}/tren/laporan/${kind}?${trendQuery(f)}`;

export const analyzeTopic = (f: TrendFilters, topicKey: string, refresh = false) =>
  getJson<TopicAnalysis>(`ai/topik?${trendQuery(f)}`, "Analisis AI gagal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic_key: topicKey, refresh }),
  });

export const summarizeTrends = (f: TrendFilters, refresh = false) =>
  getJson<TrendSummary>(`ai/ringkasan?${trendQuery(f)}`, "Ringkasan AI gagal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
