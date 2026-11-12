export const API_BASE_URL =
  typeof window !== "undefined"
    ? "/api/v1"
    : process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1";

export interface DashboardKPI {
  mention_unik: number;
  mention_growth_pct: number;
  isu_prioritas: number;
  critical_count: number;
  high_count: number;
  wilayah_terdampak: number;
  total_wilayah_terpantau: number;
  menunggu_aksi: number;
  lewat_tenggat: number;
}

export interface TrendPoint {
  day: string;
  label?: string;
  volume: number;
  negative_pct: number;
}

export interface RegionSummary {
  kode_wilayah: string;
  nama: string;
  lat: number;
  lng: number;
  mention_count: number;
  unique_content_count: number;
  sentiment_negative_pct: number;
  top_issue: string | null;
  confidence: number;
  tier: string;
}

export interface IssueItem {
  id: number;
  kode_referensi: string;
  judul: string;
  wilayah: string;
  kategori: string;
  skor: number;
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: string;
  ringkasan: string;
  current_volume: number;
  repost_count: number;
  first_seen: string;
  last_updated: string;
}

export interface IssueDetail extends IssueItem {
  alasan_skor: {
    skor_akhir: number;
    level: string;
    respons: string;
    faktor: Record<
      string,
      { bobot: string; nilai: number; kontribusi: number; catatan: string }
    >;
  };
  pihak_terlibat: string[];
  hal_belum_diketahui: string;
  baseline_volume: number;
  items: Array<{
    id: number;
    url_kanonik: string;
    judul: string;
    isi: string;
    penerbit: string;
    published_at: string;
    is_repost: boolean;
  }>;
  reviews: Array<{
    id: number;
    reviewer_nama: string;
    keputusan: string;
    catatan: string;
    waktu: string;
  }>;
  alerts: Array<{
    id: number;
    level: string;
    kanal: string;
    terkirim_at: string;
    status: string;
  }>;
  case?: {
    id: number;
    pic_nama: string;
    unit: string;
    status: string;
    tenggat: string;
    bukti: Array<{ waktu: string; catatan: string; url?: string; oleh: string }>;
    riwayat: Array<{
      waktu: string;
      status_sebelum?: string;
      status_baru: string;
      catatan: string;
    }>;
  };
}

export interface CaseCard {
  id: number;
  issue_id: number;
  pic_id: string | null;
  pic_nama: string | null;
  unit: string;
  tenggat: string;
  status: "menunggu" | "ditangani" | "selesai";
  bukti: Array<{ waktu: string; catatan: string; url?: string; oleh: string }>;
  riwayat: Array<{
    waktu: string;
    status_sebelum?: string;
    status_baru: string;
    catatan: string;
  }>;
}

export interface MonitoringProfile {
  id: number;
  nama: string;
  unit: string;
  status: string;
  versi: number;
  rule: {
    wilayah: string[];
    keyword: string[];
    sinonim: string[];
    pengecualian: string[];
    kategori: string[];
    ambang_multiplier: number;
  };
}

export async function fetchDashboardSummary() {
  const res = await fetch(`${API_BASE_URL}/dashboard/summary`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Gagal mengambil ringkasan dashboard");
  return res.json();
}

export async function fetchIssues(params?: {
  status?: string;
  level?: string;
  wilayah?: string;
  q?: string;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.level) query.set("level", params.level);
  if (params?.wilayah) query.set("wilayah", params.wilayah);
  if (params?.q) query.set("q", params.q);

  const res = await fetch(`${API_BASE_URL}/issues?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Gagal mengambil daftar isu");
  return res.json();
}

export async function fetchIssueDetail(id: number | string) {
  const res = await fetch(`${API_BASE_URL}/issues/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Gagal mengambil detail isu");
  return res.json();
}

export async function submitIssueReview(
  issueId: number,
  payload: {
    reviewer_id: string;
    reviewer_nama: string;
    keputusan: string;
    koreksi_label?: Record<string, any>;
    catatan?: string;
  }
) {
  const res = await fetch(`${API_BASE_URL}/issues/${issueId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Gagal mengirim verifikasi analis");
  return res.json();
}

export async function fetchCases(status?: string) {
  const url = status
    ? `${API_BASE_URL}/cases?status=${status}`
    : `${API_BASE_URL}/cases`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil papan kasus");
  return res.json();
}

export async function updateCaseStatus(caseId: number, payload: any) {
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Gagal memperbarui status kasus");
  return res.json();
}

export async function fetchProfiles() {
  const res = await fetch(`${API_BASE_URL}/profiles`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil profil monitoring");
  return res.json();
}

export async function updateProfile(profileId: number, payload: any) {
  const res = await fetch(`${API_BASE_URL}/profiles/${profileId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Gagal menyimpan perubahan profil");
  return res.json();
}

export async function testProfile7d(profileId: number) {
  const res = await fetch(`${API_BASE_URL}/profiles/${profileId}/test-7d`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Gagal menjalankan uji 7 hari");
  return res.json();
}

export async function fetchReports() {
  const res = await fetch(`${API_BASE_URL}/reports`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil arsip laporan");
  return res.json();
}

export async function generateNewReport(jenis: string, periode: string) {
  const res = await fetch(
    `${API_BASE_URL}/reports/generate?jenis=${encodeURIComponent(
      jenis
    )}&periode=${encodeURIComponent(periode)}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Gagal menghasilkan laporan");
  return res.json();
}

export function getReportViewUrl(reportId: number) {
  return `/api/v1/reports/${reportId}/view`;
}

export async function fetchAuditLogs() {
  const res = await fetch(`${API_BASE_URL}/audit/logs`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil log audit");
  return res.json();
}

export async function fetchAiEvaluation() {
  const res = await fetch(`${API_BASE_URL}/audit/ai-evaluation`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Gagal mengambil evaluasi AI");
  return res.json();
}

export async function pollSources(force: boolean = true) {
  const res = await fetch(`${API_BASE_URL}/sources/poll?force=${force}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Gagal menyinkronkan data berita nyata");
  return res.json();
}


export interface GalaxyNode {
  id: string;
  name: string;
  volume: number;
  sentiment_score: number;
  threat_level: "kritis" | "waspada" | "aman";
  orbit_radius: number;
  angle: number;
  top_topic: string;
}

export interface FlowItem {
  source: string;
  topic: string;
  value: number;
}

export interface TriageStats {
  total_evaluated: number;
  incident_accepted: number;
  noise_filtered: number;
  noise_filtered_pct: number;
  fast_dispatch_count: number;
}

export interface LiveArticle {
  id: number;
  judul: string;
  penerbit: string;
  url: string;
  published_at: string | null;
  sentimen: string;
  topik: string;
  lokasi_kejadian: string | null;
  ringkasan: string;
  kredibilitas: number;
}

export interface ProvinceGeo {
  kode: string;
  nama: string;
  pulau: string;
  lat: number;
  lng: number;
  is_focus: boolean;
  status: string;
  keterangan: string;
}

export interface JabodetabekRegionGeo {
  kode: string;
  nama: string;
  jenis: string;
  provinsi: string;
  lat: number;
  lng: number;
  mention_count: number;
  negative_count: number;
  threat_level: "kritis" | "tinggi" | "waspada" | "rendah";
  heat_intensity: number;
  top_issue_title: string | null;
  dominant_topic: string;
}

export interface MediaItem {
  id: number;
  judul: string;
  url: string;
  penerbit: string;
  penulis?: string;
  channel_type: "berita" | "sosmed";
  platform: string;
  published_at: string | null;
  sentimen: string;
  topik: string;
  kategori_masalah: string;
  ringkasan: string;
}

export interface RegionMatchedIssue {
  id: number;
  judul: string;
  status: string;
  kategori: string;
  kategori_masalah: string;
  tingkat_bahaya: string;
  skor: number;
  ringkasan: string;
  volume_24jam: number;
}

export interface RegionalDetailResponse {
  kode: string;
  nama: string;
  jenis: string;
  provinsi: string;
  lat: number;
  lng: number;
  is_focus: boolean;
  total_articles: number;
  total_berita: number;
  total_sosmed: number;
  total_issues: number;
  trend: {
    direction: "naik" | "stabil" | "kondusif";
    negatif_pct: number;
    sentimen: { positif: number; netral: number; negatif: number };
  };
  category_counts: Record<string, number>;
  issues: RegionMatchedIssue[];
  recent_articles: MediaItem[];
  media_items: MediaItem[];
}

export interface IndonesiaGeoOverview {
  status: string;
  focus_area: string;
  provinces: ProvinceGeo[];
  jabodetabek_regions: JabodetabekRegionGeo[];
  total_provinces: number;
  total_active_regions: number;
  generated_at: string;
}

export async function fetchIndonesiaGeo(): Promise<IndonesiaGeoOverview> {
  const res = await fetch(`${API_BASE_URL}/geo/indonesia`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil data peta Indonesia & Jabodetabek");
  return res.json();
}

export async function fetchRegionalDetail(kodeWilayah: string) {
  const res = await fetch(`${API_BASE_URL}/geo/region/${kodeWilayah}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gagal mengambil data wilayah ${kodeWilayah}`);
  return res.json();
}
