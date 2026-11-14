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
  menunggu_verifikasi?: number;
  belum_terpetakan_count?: number;
  belum_terpetakan_pct?: number;
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

export interface DashboardAiHighlight {
  label: string;
  text: string;
  severity: "critical" | "warning" | "info" | "positive" | string;
}

export interface DashboardAiInsightData {
  headline: string;
  highlights: DashboardAiHighlight[];
  rekomendasi: string;
  ai_engine_used: string;
  generated_at: string;
  cached?: boolean;
}

export async function fetchDashboardAiInsight(refresh = false): Promise<DashboardAiInsightData> {
  const res = await fetch(`${API_BASE_URL}/dashboard/ai-insight?refresh=${refresh ? "true" : "false"}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Gagal memuat wawasan ringkasan AI");
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
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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

export async function generateSocialReport(timeRange: string = "24h", scopeKode: string = "ID") {
  const params = new URLSearchParams({ time_range: timeRange, scope_kode: scopeKode });
  const res = await fetch(`${API_BASE_URL}/reports/social?${params.toString()}`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Gagal menyusun laporan Social Pulse");
  }
  return res.json() as Promise<{ id: number; judul: string; periode: string }>;
}

export function getReportViewUrl(reportId: number) {
  return `/api/v1/reports/${reportId}/view`;
}

export async function fetchAuditLogs(limit = 50) {
  const res = await fetch(`${API_BASE_URL}/audit/logs?limit=${limit}`, { cache: "no-store" });
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

/** Dipancarkan AppShell setelah tarik berita selesai; halaman memuat ulang datanya sendiri. */
export const DATA_SYNCED_EVENT = "tip:data-synced";

export function onDataSynced(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DATA_SYNCED_EVENT, handler);
  return () => window.removeEventListener(DATA_SYNCED_EVENT, handler);
}

export async function uploadCaseEvidence(caseId: number, file: File, uploadedBy: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("uploaded_by", uploadedBy);
  const res = await fetch(`${API_BASE_URL}/cases/${caseId}/evidence`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Gagal mengunggah ${file.name}`);
  return res.json() as Promise<{ id: number; filename: string; download_url: string }>;
}

/** Bukti yang diunggah ke storage (bukan tautan luar) butuh token, jadi diunduh lewat fetch. */
export function isStoredEvidenceUrl(url: string): boolean {
  return /^\/api\/v1\/cases\/\d+\/evidence\/\d+\/download$/.test(url);
}

export async function downloadCaseEvidence(url: string, fallbackName: string) {
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (res.status === 401) throw new Error("Sesi berakhir. Masuk lagi untuk mengunduh bukti.");
  if (!res.ok) throw new Error("File bukti tidak ditemukan");
  const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = match?.[1] || fallbackName;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export interface AlertItem {
  id: number;
  issue_id: number;
  level: string;
  penerima: string;
  kanal: string;
  konten_pesan: string;
  terkirim_at: string;
  diakui_at: string | null;
  status: string;
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  const res = await fetch(`${API_BASE_URL}/alerts`, { cache: "no-store", headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Gagal memuat notifikasi");
  return res.json();
}

export async function acknowledgeAlert(alertId: number, userNama: string): Promise<AlertItem> {
  const res = await fetch(
    `${API_BASE_URL}/alerts/${alertId}/acknowledge?user_nama=${encodeURIComponent(userNama)}`,
    { method: "POST", headers: getAuthHeaders() }
  );
  if (!res.ok) throw new Error("Gagal menandai notifikasi");
  return res.json();
}

export interface IssueSearchHit {
  id: number;
  kode_referensi: string;
  judul: string;
  wilayah: string;
  kategori: string;
  level: string;
  skor: number;
  status: string;
}

export async function searchIssuesFulltext(q: string, limit = 8): Promise<IssueSearchHit[]> {
  const res = await fetch(
    `${API_BASE_URL}/issues/search/fulltext?q=${encodeURIComponent(q)}&limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Pencarian gagal");
  const data = await res.json();
  return data.items || [];
}

/** sessionStorage: urutan id isu yang tampil di antrean, untuk tombol "isu berikutnya" di detail. */
export const ISSUE_QUEUE_KEY = "tip_isu_queue";

/** true bila backend menjawab. Dipakai indikator koneksi di header. */
export async function checkBackendOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/sources`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
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
  jawa_regions?: JabodetabekRegionGeo[];
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

// ==========================================
// RADAR SOCIAL PULSE INTELLIGENCE INTERFACES
// ==========================================

export type SocialVelocityStatus =
  | "LONJAKAN TINGGI"
  | "MENINGKAT"
  | "BARU"
  | "STABIL"
  | "MENURUN"
  | "SINYAL LEMAH";

export interface SocialTimelineBucket {
  t: string;
  count: number;
}

/** Angka engagement bernilai null bila sumber tidak menyediakannya (bukan nol). */
export interface SocialEngagementSummary {
  posts_with_data: number;
  coverage_pct: number;
  likes: number | null;
  shares: number | null;
  replies: number | null;
  views: number | null;
  interactions: number | null;
}

export interface SocialVelocity {
  status: SocialVelocityStatus;
  score: number;
  growth_pct: number | null;
  ratio: number;
  z_score: number;
  baseline_mean: number;
  baseline_std: number;
  baseline_windows: number;
}

export interface SocialPeriod {
  key: string;
  start: string;
  end: string;
  label: string;
}

export interface SocialBrief {
  title: string;
  period: SocialPeriod;
  points: { kind: string; text: string; url?: string | null }[];
  generated_at: string;
}

export interface SocialPulseOverview {
  time_range: string;
  period: SocialPeriod;
  scope_kode: string;
  scope_name: string;
  scope_mode: "context" | "strict" | "regional";
  total_mentions: number;
  previous_mentions: number | null;
  mention_growth_pct: number | null;
  trending_topics_count: number;
  emerging_trends_count: number;
  surging_trends_count: number;
  new_trends_count: number;
  coordination_flags: number;
  negative_ratio_pct: number;
  sentiment_breakdown: {
    positif: number;
    netral: number;
    negatif: number;
    campuran: number;
    "tidak pasti": number;
  };
  active_platforms_count: number;
  platform_distribution: Record<string, number>;
  emotion_breakdown: SocialEmotionShare[];
  unique_accounts: number;
  author_coverage_pct: number;
  engagement: SocialEngagementSummary;
  timeline: SocialTimelineBucket[];
  baseline: {
    windows_available: number;
    windows_target: number;
    coverage_since: string | null;
    min_surge_volume: number;
  };
  data_coverage?: {
    total_collected: number;
    relevant_to_scope: number;
    uncertain_count: number;
    direct_count: number;
    excluded_count?: number;
    unclustered_count?: number;
  };
  last_updated: string;
}

export interface SocialSampleMention {
  id: number;
  judul: string;
  isi: string;
  penerbit: string | null;
  penulis: string | null;
  platform: string;
  url: string | null;
  published_at: string;
  sentimen: string;
  emosi?: string[];
  geo_context?: string | null;
  geo_confidence?: "High" | "Medium" | "Low" | "Unknown" | null;
  engagement?: {
    likes: number | null;
    shares: number | null;
    replies: number | null;
    views: number | null;
    followers: number | null;
  };
}

export interface CorrelatedIssueSummary {
  id: number;
  kode_referensi: string;
  judul: string;
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  skor: number;
  status: string;
  linked_posts?: number;
}

export interface SocialAccountSummary {
  handle: string;
  posts: number;
  platforms: string[];
  followers: number | null;
  interactions: number | null;
}

export interface SocialCoordinationCluster {
  posts: number;
  distinct_accounts: number;
  span_minutes: number;
  flagged: boolean;
  sample_text: string;
  accounts: string[];
}

export interface SocialTopicNote {
  id: number;
  topic_key: string;
  topic_label: string;
  status: string;
  status_label: string;
  catatan: string | null;
  aktor: string;
  peran: string;
  created_at: string;
  count?: number;
}

export interface SocialEmotionShare {
  id: string;
  label: string;
  count: number;
  pct: number;
}

export interface SocialFacetRef {
  id: string;
  label: string;
  count: number;
}

export interface SocialFilters {
  category?: string;
  agency?: string;
}

export type SocialSort = "laju" | "terbaru" | "volume" | "negatif";

function appendFilters(params: URLSearchParams, filters?: SocialFilters) {
  if (filters?.category) params.append("category", filters.category);
  if (filters?.agency) params.append("agency", filters.agency);
}

export interface SocialFacets {
  time_range: string;
  total: number;
  categories: SocialFacetRef[];
  agencies: (SocialFacetRef & { group: string; negative: number })[];
}

export interface SocialAgencyRow {
  id: string;
  label: string;
  group: string;
  mention_count: number;
  share_of_voice_pct: number;
  negative_count: number;
  sentiment_pct: { positif: number; netral: number; negatif: number; campuran?: number };
  velocity_status: SocialVelocityStatus | "TIDAK ADA";
  velocity_score: number;
  growth_pct: number | null;
  velocity: SocialVelocity;
  timeline: SocialTimelineBucket[];
  platforms: string[];
  top_topics: string[];
  categories: SocialFacetRef[];
  emotions: SocialEmotionShare[];
  top_negative: SocialSampleMention[];
  latest: SocialSampleMention[];
  engagement: SocialEngagementSummary;
}

export interface SocialAgencyBoard {
  time_range: string;
  scope_kode: string;
  scope_name: string;
  total_posts: number;
  posts_mentioning_agency: number;
  agencies: SocialAgencyRow[];
}

export interface SocialTrendingTopic {
  rank: number;
  categories: SocialFacetRef[];
  agencies: SocialFacetRef[];
  emotions: SocialEmotionShare[];
  analyst_note: SocialTopicNote | null;
  topic_key: string;
  topic: string;
  topic_type: "hashtag" | "frasa" | "kategori" | "lainnya";
  hashtags: string[];
  related_phrases: string[];
  mention_count: number;
  growth_pct: number | null;
  velocity_score: number;
  velocity_status: SocialVelocityStatus;
  velocity: SocialVelocity;
  platforms: string[];
  sentiment_pct: {
    positif: number;
    netral: number;
    negatif: number;
    campuran?: number;
  };
  locations: string[];
  correlated_issue: CorrelatedIssueSummary | null;
  first_detected: string;
  last_seen: string;
  timeline: SocialTimelineBucket[];
  baseline_per_bucket: number | null;
  peak_at: string | null;
  engagement: SocialEngagementSummary;
  accounts: {
    unique_accounts: number;
    author_coverage_pct: number;
    top_accounts: SocialAccountSummary[];
    top_account_share_pct: number | null;
    concentration_hhi: number | null;
  };
  coordination: {
    flagged: boolean;
    duplicate_share_pct: number;
    clusters: SocialCoordinationCluster[];
  };
  propagation: SocialPropagation;
  sample_mentions: SocialSampleMention[];
}

export interface SocialPropagationStep {
  platform: string;
  first_at: string;
  lag_minutes: number;
  posts: number;
  first_author: string | null;
  first_url: string | null;
}

export interface SocialPropagation {
  origin: string | null;
  span_minutes: number | null;
  steps: SocialPropagationStep[];
}

export type SocialHealthState =
  | "aktif"
  | "terlambat"
  | "kosong"
  | "gagal"
  | "belum_ditarik"
  | "nonaktif"
  | "tanpa_sumber";

export interface SocialSourceHealth {
  id: number;
  nama: string;
  method: string;
  state: SocialHealthState;
  status_izin: string;
  last_fetch_at: string | null;
  last_success_at: string | null;
  last_fetch_count: number | null;
  last_error: string | null;
  frekuensi_menit: number;
}

export interface SocialPlatformMetric {
  name: string;
  code: string;
  icon: string;
  official_status: string;
  health_state: SocialHealthState;
  type: string;
  is_connected: boolean;
  sources: SocialSourceHealth[];
  note: string | null;
  time_range: string;
  mention_count: number;
  negative_sentiment_pct: number;
  positive_sentiment_pct: number;
  last_data_at: string | null;
  last_success_at: string | null;
  engagement: SocialEngagementSummary;
  author_coverage_pct: number;
}

export interface SocialCorrelation {
  social_topic: string;
  topic_key: string;
  hashtags: string[];
  mention_count: number;
  linked_posts: number;
  velocity_score: number;
  velocity_status: SocialVelocityStatus;
  platforms: string[];
  issue: CorrelatedIssueSummary;
  first_detected: string;
}

export interface SocialWatchTerm {
  term: string;
  kind: "kata kunci" | "sinonim" | "tambahan";
  profiles: string[];
  mention_count: number;
  velocity_status: SocialVelocityStatus | "TIDAK ADA";
  velocity_score: number;
  growth_pct: number | null;
  velocity: SocialVelocity;
  sentiment_pct: { positif: number; netral: number; negatif: number; campuran?: number };
  platforms: string[];
  timeline: SocialTimelineBucket[];
  engagement: SocialEngagementSummary;
  top_mentions: SocialSampleMention[];
}

export interface SocialWatchlist {
  time_range: string;
  scope_kode: string;
  scope_name: string;
  total_terms: number;
  active_terms: number;
  rising_terms: number;
  terms: SocialWatchTerm[];
}

export interface SocialEscalationResult {
  time_range: string;
  evaluated_topics: number;
  created: string[];
  updated: string[];
  skipped: { topic: string; reason: string }[];
}

export interface GeoSearchResult {
  kode: string;
  nama: string;
  tingkat: "nasional" | "provinsi" | "kabupaten" | "kecamatan" | "kelurahan";
  konteks: string;
}

export interface GeoHierarchyResponse {
  provinces: Array<{ kode: string; nama: string; pulau: string }>;
  kabupaten: Array<{ kode: string; nama: string; provinsi_kode: string; provinsi_nama: string; tipe: string }>;
  kecamatan: Array<{ kode: string; nama: string; kabupaten_kode: string; kabupaten_nama: string; provinsi_kode: string; provinsi_nama: string }>;
  kelurahan: Array<{ kode: string; nama: string; kecamatan_kode: string; kecamatan_nama: string; kabupaten_nama: string; provinsi_nama: string }>;
}

export interface GeoComparisonItem {
  scope_kode: string;
  region_name: string;
  total_mentions: number;
  growth_pct: number | null;
  trending_topics_count: number;
  emerging_trends_count: number;
  negative_sentiment_pct: number;
  top_topic: string | null;
}

export async function fetchSocialPulseOverview(
  timeRange: string = "24h",
  scopeKode: string = "ID",
  scopeMode: string = "context",
  multiCodes?: string,
  filters?: SocialFilters
): Promise<SocialPulseOverview> {
  const params = new URLSearchParams({
    time_range: timeRange,
    scope_kode: scopeKode,
    scope_mode: scopeMode,
  });
  if (multiCodes) params.append("multi_codes", multiCodes);
  appendFilters(params, filters);

  const res = await fetch(`${API_BASE_URL}/social-pulse/overview?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil overview Social Pulse");
  return res.json();
}

export async function fetchSocialTrends(
  platform?: string,
  timeRange: string = "24h",
  limit: number = 15,
  scopeKode: string = "ID",
  scopeMode: string = "context",
  multiCodes?: string,
  filters?: SocialFilters,
  sort: SocialSort = "laju"
): Promise<SocialTrendingTopic[]> {
  const params = new URLSearchParams();
  if (platform && platform !== "Semua") params.append("platform", platform);
  params.append("time_range", timeRange);
  params.append("limit", limit.toString());
  params.append("scope_kode", scopeKode);
  params.append("scope_mode", scopeMode);
  params.append("sort", sort);
  if (multiCodes) params.append("multi_codes", multiCodes);
  appendFilters(params, filters);

  const res = await fetch(`${API_BASE_URL}/social-pulse/trends?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil tren Social Pulse");
  return res.json();
}

export async function fetchSocialPlatforms(
  scopeKode: string = "ID",
  scopeMode: string = "context",
  multiCodes?: string,
  timeRange: string = "7d"
): Promise<SocialPlatformMetric[]> {
  const params = new URLSearchParams({
    scope_kode: scopeKode,
    scope_mode: scopeMode,
    time_range: timeRange,
  });
  if (multiCodes) params.append("multi_codes", multiCodes);

  const res = await fetch(`${API_BASE_URL}/social-pulse/platforms?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil metrik platform Social Pulse");
  return res.json();
}

export async function fetchSocialCorrelations(
  scopeKode: string = "ID",
  scopeMode: string = "context",
  multiCodes?: string
): Promise<SocialCorrelation[]> {
  const params = new URLSearchParams({
    scope_kode: scopeKode,
    scope_mode: scopeMode,
  });
  if (multiCodes) params.append("multi_codes", multiCodes);

  const res = await fetch(`${API_BASE_URL}/social-pulse/correlations?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil korelasi isu Social Pulse");
  return res.json();
}

export async function fetchSocialWatchlist(
  timeRange: string = "24h",
  scopeKode: string = "ID",
  scopeMode: string = "context",
  multiCodes?: string,
  extraTerms?: string[],
  filters?: SocialFilters
): Promise<SocialWatchlist> {
  const params = new URLSearchParams({
    time_range: timeRange,
    scope_kode: scopeKode,
    scope_mode: scopeMode,
  });
  if (multiCodes) params.append("multi_codes", multiCodes);
  if (extraTerms && extraTerms.length > 0) params.append("terms", extraTerms.join(","));
  appendFilters(params, filters);

  const res = await fetch(`${API_BASE_URL}/social-pulse/watchlist?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil watchlist kata kunci");
  return res.json();
}

export async function fetchSocialFacets(
  timeRange: string,
  scopeKode: string,
  scopeMode: string,
  multiCodes?: string,
  platform?: string,
  filters?: SocialFilters
): Promise<SocialFacets> {
  const params = new URLSearchParams({ time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode });
  if (multiCodes) params.append("multi_codes", multiCodes);
  if (platform && platform !== "Semua") params.append("platform", platform);
  appendFilters(params, filters);
  const res = await fetch(`${API_BASE_URL}/social-pulse/facets?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil faset kategori dan instansi");
  return res.json();
}

export async function fetchAgencyBoard(
  timeRange: string,
  scopeKode: string,
  scopeMode: string,
  multiCodes?: string,
  category?: string
): Promise<SocialAgencyBoard> {
  const params = new URLSearchParams({ time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode });
  if (multiCodes) params.append("multi_codes", multiCodes);
  if (category) params.append("category", category);
  const res = await fetch(`${API_BASE_URL}/social-pulse/agencies?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil papan instansi");
  return res.json();
}

export async function fetchSocialBrief(
  timeRange: string,
  scopeKode: string,
  scopeMode: string,
  multiCodes?: string,
  filters?: SocialFilters
): Promise<SocialBrief> {
  const params = new URLSearchParams({ time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode });
  if (multiCodes) params.append("multi_codes", multiCodes);
  appendFilters(params, filters);
  const res = await fetch(`${API_BASE_URL}/social-pulse/brief?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil ringkasan situasi");
  return res.json();
}

export async function fetchSocialTopicNotes(
  topicKey: string
): Promise<{ statuses: Record<string, string>; notes: SocialTopicNote[] }> {
  const res = await fetch(`${API_BASE_URL}/social-pulse/notes?topic_key=${encodeURIComponent(topicKey)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil catatan analis");
  return res.json();
}

export async function addSocialTopicNote(payload: {
  topic_key: string;
  topic_label: string;
  status: string;
  catatan?: string;
  aktor: string;
  peran?: string;
}): Promise<SocialTopicNote> {
  const res = await fetch(`${API_BASE_URL}/social-pulse/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Catatan gagal disimpan");
  }
  return res.json();
}

export interface SocialDeltaRow {
  id: string;
  label: string;
  a: number;
  b: number;
  delta: number;
  change_pct: number | null;
  status?: "baru" | "naik" | "turun" | "hilang" | "tetap";
  negative_a?: number;
  negative_b?: number;
}

export interface SocialComparisonSummary {
  mentions: number;
  negative_pct: number;
  accounts: number;
  views: number | null;
}

export interface SocialComparison {
  scope_kode: string;
  scope_name: string;
  period_a: SocialPeriod;
  period_b: SocialPeriod;
  summary_a: SocialComparisonSummary;
  summary_b: SocialComparisonSummary;
  categories: SocialDeltaRow[];
  agencies: SocialDeltaRow[];
  topics: SocialDeltaRow[];
  emotions: { id: string; label: string; a_pct: number; b_pct: number }[];
  platforms: SocialDeltaRow[];
  note: string | null;
}

export async function fetchPeriodComparison(
  timeRange: string,
  scopeKode: string,
  scopeMode: string,
  multiCodes?: string,
  platform?: string,
  compare?: { start: string; end: string }
): Promise<SocialComparison> {
  const params = new URLSearchParams({ time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode });
  if (multiCodes) params.append("multi_codes", multiCodes);
  if (platform && platform !== "Semua") params.append("platform", platform);
  if (compare) {
    params.append("compare_start", compare.start);
    params.append("compare_end", compare.end);
  }
  const res = await fetch(`${API_BASE_URL}/social-pulse/compare?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Gagal memuat perbandingan periode");
  }
  return res.json();
}

export interface SocialAlertRuleInput {
  nama: string;
  term?: string | null;
  category?: string | null;
  agency?: string | null;
  platform?: string | null;
  scope_kode: string;
  metric: string;
  threshold: number;
  window: string;
  cooldown_menit: number;
  aktif: boolean;
  dibuat_oleh: string;
}

export interface SocialAlertRule extends SocialAlertRuleInput {
  id: number;
  created_at: string | null;
  last_triggered_at: string | null;
  deskripsi: string;
}

export interface SocialAlertEvent {
  id: number;
  rule_id: number;
  rule_nama: string;
  triggered_at: string;
  metric: string;
  value: number;
  threshold: number;
  window: string;
  ringkasan: string;
  samples: SocialSampleMention[];
  status: "baru" | "dilihat";
  dilihat_oleh: string | null;
}

async function jsonOrError<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : fallback);
  }
  return res.json();
}

export async function fetchSocialAlertRules(): Promise<{ metrics: Record<string, string>; windows: string[]; rules: SocialAlertRule[] }> {
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/alert-rules`, { cache: "no-store" }), "Gagal mengambil aturan alert");
}

export async function createSocialAlertRule(rule: SocialAlertRuleInput): Promise<SocialAlertRule> {
  return jsonOrError(
    await fetch(`${API_BASE_URL}/social-pulse/alert-rules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rule) }),
    "Aturan gagal dibuat"
  );
}

export async function updateSocialAlertRule(id: number, rule: SocialAlertRuleInput): Promise<SocialAlertRule> {
  return jsonOrError(
    await fetch(`${API_BASE_URL}/social-pulse/alert-rules/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rule) }),
    "Aturan gagal diubah"
  );
}

export async function deleteSocialAlertRule(id: number): Promise<{ deleted: number }> {
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/alert-rules/${id}`, { method: "DELETE" }), "Aturan gagal dihapus");
}

export async function testSocialAlertRule(id: number): Promise<{ value: number; threshold: number; would_trigger: boolean; volume: number; negatif: number; baseline_ready: boolean }> {
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/alert-rules/${id}/test`, { method: "POST" }), "Aturan gagal diuji");
}

export async function evaluateSocialAlertRules(): Promise<{ checked: number; triggered: SocialAlertEvent[] }> {
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/alert-rules/evaluate`, { method: "POST" }), "Aturan gagal dicek");
}

export async function fetchSocialAlertEvents(status?: string, limit = 50): Promise<{ unread: number; events: SocialAlertEvent[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.append("status", status);
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/alert-events?${params.toString()}`, { cache: "no-store" }), "Gagal mengambil riwayat alert");
}

export async function ackSocialAlertEvent(id: number, aktor: string): Promise<SocialAlertEvent> {
  return jsonOrError(
    await fetch(`${API_BASE_URL}/social-pulse/alert-events/${id}/ack`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktor }) }),
    "Gagal menandai alert"
  );
}

export interface SocialHeatmap {
  period: SocialPeriod;
  total: number;
  located: number;
  unlocated: number;
  max_cell: number;
  columns: { id: string; label: string; total: number }[];
  rows: { region: string; total: number; negative: number; cells: Record<string, { count: number; negative: number }> }[];
}

export async function fetchSocialHeatmap(
  timeRange: string,
  scopeKode: string,
  scopeMode: string,
  multiCodes?: string,
  platform?: string,
  agency?: string
): Promise<SocialHeatmap> {
  const params = new URLSearchParams({ time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode });
  if (multiCodes) params.append("multi_codes", multiCodes);
  if (platform && platform !== "Semua") params.append("platform", platform);
  if (agency) params.append("agency", agency);
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/heatmap?${params.toString()}`, { cache: "no-store" }), "Gagal memuat peta panas");
}

export interface SocialWatchedAccountRow {
  id: number;
  handle: string;
  label: string | null;
  kelompok: string;
  kelompok_label: string;
  catatan: string | null;
  dibuat_oleh: string;
  created_at: string | null;
  posts: number;
  mentions: number;
  mention_sentiment: { positif: number; netral: number; negatif: number } | null;
  platforms: string[];
  last_post_at: string | null;
  timeline: SocialTimelineBucket[];
  latest_posts: SocialSampleMention[];
  top_mentions: SocialSampleMention[];
}

export interface SocialWatchedAccounts {
  period: SocialPeriod;
  groups: Record<string, string>;
  accounts: SocialWatchedAccountRow[];
  suggestions: (SocialAccountSummary & { handle_norm: string })[];
}

export async function fetchSocialWatchedAccounts(timeRange: string, scopeKode: string, scopeMode: string, multiCodes?: string): Promise<SocialWatchedAccounts> {
  const params = new URLSearchParams({ time_range: timeRange, scope_kode: scopeKode, scope_mode: scopeMode });
  if (multiCodes) params.append("multi_codes", multiCodes);
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/watched-accounts?${params.toString()}`, { cache: "no-store" }), "Gagal memuat akun pantauan");
}

export async function addSocialWatchedAccount(payload: { handle: string; label?: string; kelompok: string; catatan?: string; dibuat_oleh: string }) {
  return jsonOrError(
    await fetch(`${API_BASE_URL}/social-pulse/watched-accounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    "Akun gagal ditambahkan"
  );
}

export async function deleteSocialWatchedAccount(id: number) {
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/watched-accounts/${id}`, { method: "DELETE" }), "Akun gagal dihapus");
}

export interface SocialSearchParams {
  q: string;
  platform: string;
  category: string;
  agency: string;
  emotion: string;
  sentimen: string;
  author: string;
  sort: string;
}

export interface SocialSearchItem {
  id: number;
  judul: string;
  isi: string;
  platform: string;
  penulis: string | null;
  penerbit: string | null;
  url: string | null;
  published_at: string;
  fetched_at?: string | null;
  sentimen: string;
  lokasi: string | null;
  kategori: string[];
  instansi: string[];
  emosi: string[];
  geo_context: string;
  geo_confidence?: string;
  engagement: { likes: number | null; shares: number | null; replies: number | null; views: number | null; interactions: number | null };
}

export interface LiveFetchSummary {
  scope_kode: string;
  location_query: string;
  fetched_at: string;
  cached: boolean;
  cooldown_seconds: number;
  dibaca: number;
  baru: number;
  duplikat: number;
  platforms: string[];
  errors: string[];
}

export interface LiveSocialFeedResult extends SocialSearchResult {
  scope_kode: string;
  scope_mode: string;
  live_fetch: LiveFetchSummary | null;
}

export interface SocialSearchResult {
  period: SocialPeriod;
  query: string;
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: SocialSearchItem[];
}

function searchQuery(p: SocialSearchParams & { time_range: string; scope_kode: string; scope_mode: string }): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v) params.append(k, String(v));
  });
  return params;
}

export async function searchSocialContent(
  p: SocialSearchParams & { time_range: string; scope_kode: string; scope_mode: string },
  page = 1,
  pageSize = 25
): Promise<SocialSearchResult> {
  const params = searchQuery(p);
  params.append("page", String(page));
  params.append("page_size", String(pageSize));
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/search?${params.toString()}`, { cache: "no-store" }), "Pencarian gagal");
}

export function socialSearchExportUrl(p: SocialSearchParams & { time_range: string; scope_kode: string; scope_mode: string }): string {
  return `${API_BASE_URL}/social-pulse/search/export?${searchQuery(p).toString()}`;
}

export async function fetchLiveSocialFeed(
  p: SocialSearchParams & { time_range: string; scope_kode: string; scope_mode: string },
  options: { fetchLive?: boolean; forceFetch?: boolean; page?: number; pageSize?: number } = {}
): Promise<LiveSocialFeedResult> {
  const params = searchQuery(p);
  params.append("fetch_live", String(options.fetchLive ?? true));
  params.append("force_fetch", String(options.forceFetch ?? false));
  params.append("page", String(options.page ?? 1));
  params.append("page_size", String(options.pageSize ?? 30));
  return jsonOrError(
    await fetch(`${API_BASE_URL}/social-pulse/live-feed?${params.toString()}`, { cache: "no-store" }),
    "Gagal memuat stream live media sosial"
  );
}

export async function triggerLiveSocialFetch(
  scopeKode: string,
  platform?: string,
  q?: string,
  force = true
): Promise<LiveFetchSummary> {
  const params = new URLSearchParams({ scope_kode: scopeKode, force: String(force) });
  if (platform && platform !== "Semua") params.append("platform", platform);
  if (q) params.append("q", q);
  return jsonOrError(
    await fetch(`${API_BASE_URL}/social-pulse/live-fetch?${params.toString()}`, { method: "POST" }),
    "Gagal menarik postingan media sosial langsung"
  );
}

export interface SocialSpreadItem {
  id: number;
  judul: string;
  channel: string;
  group: "medsos" | "berita";
  platform: string;
  penulis: string | null;
  penerbit: string | null;
  url: string | null;
  published_at: string;
  sentimen: string;
}

export interface SocialSpreadTrace {
  period: SocialPeriod;
  topic_key: string | null;
  query: string;
  label: string;
  total: number;
  social_count: number;
  news_count: number;
  first: SocialSpreadItem | null;
  first_social: SocialSpreadItem | null;
  first_news: SocialSpreadItem | null;
  origin: "medsos" | "berita" | null;
  lag_minutes: number | null;
  channels: {
    channel: string;
    group: "medsos" | "berita";
    platform: string;
    first_at: string;
    first_title: string;
    first_url: string | null;
    count: number;
    minutes_after_first: number;
    accounts: number;
  }[];
  timeline: { medsos: SocialTimelineBucket[]; berita: SocialTimelineBucket[] };
  early_items: SocialSpreadItem[];
}

export async function fetchSpreadTrace(p: {
  time_range: string;
  scope_kode: string;
  scope_mode: string;
  topic_key?: string;
  q?: string;
}): Promise<SocialSpreadTrace> {
  const params = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v) params.append(k, String(v));
  });
  return jsonOrError(await fetch(`${API_BASE_URL}/social-pulse/spread?${params.toString()}`, { cache: "no-store" }), "Gagal memuat jejak penyebaran");
}

export async function escalateSocialSurges(timeRange: string = "6h"): Promise<SocialEscalationResult> {
  const res = await fetch(`${API_BASE_URL}/social-pulse/escalate?time_range=${timeRange}`, { method: "POST" });
  if (!res.ok) throw new Error("Gagal mengeskalasi lonjakan media sosial");
  return res.json();
}

export async function searchGeoLocations(q: string): Promise<GeoSearchResult[]> {
  const res = await fetch(`${API_BASE_URL}/social-pulse/geo/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchGeoHierarchy(): Promise<GeoHierarchyResponse> {
  const res = await fetch(`${API_BASE_URL}/social-pulse/geo/hierarchy`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil hierarki administratif wilayah");
  return res.json();
}

export async function fetchGeoComparison(codes: string = "32.01.01,32.01.02,32.01.03", timeRange: string = "24h"): Promise<GeoComparisonItem[]> {
  const res = await fetch(`${API_BASE_URL}/social-pulse/comparison?codes=${encodeURIComponent(codes)}&time_range=${timeRange}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal memuat perbandingan wilayah");
  return res.json();
}

export interface HashtagPair {
  a: string;
  b: string;
  posts: number;
  accounts: number;
  jaccard: number;
}

export interface HashtagGroup {
  tags: string[];
  posts: number;
  accounts: number;
  platforms: string[];
}

export interface HashtagCooccurrence {
  time_range: string;
  total_posts: number;
  posts_with_hashtag: number;
  groups: HashtagGroup[];
  pairs: HashtagPair[];
}

export async function fetchHashtagCooccurrence(opts: {
  timeRange: string;
  scopeKode: string;
  scopeMode: string;
  multiCodes?: string;
  platform?: string;
  filters?: SocialFilters;
}): Promise<HashtagCooccurrence> {
  const params = new URLSearchParams({ time_range: opts.timeRange, scope_kode: opts.scopeKode, scope_mode: opts.scopeMode });
  if (opts.multiCodes) params.append("multi_codes", opts.multiCodes);
  if (opts.platform && opts.platform !== "Semua") params.append("platform", opts.platform);
  appendFilters(params, opts.filters);
  const res = await fetch(`${API_BASE_URL}/social-pulse/hashtag-cooccurrence?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal memuat hashtag yang muncul bersama");
  return res.json();
}

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("tip_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AuthUser {
  id: number;
  email: string;
  nama: string;
  role: string;
  wilayah_scope: string[];
  mfa_enabled: boolean;
  is_active?: boolean;
  last_login_at?: string | null;
}

export async function loginUser(email: string, password: string, mfaCode?: string) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, mfa_code: mfaCode || null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal masuk ke sistem");
  }
  const data = await res.json();
  if (data.access_token && typeof window !== "undefined") {
    window.localStorage.setItem("tip_token", data.access_token);
  }
  return data;
}

export async function fetchCurrentUser(): Promise<{ authenticated: boolean; auth_required: boolean; keycloak_enabled: boolean; user: AuthUser | null }> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getAuthHeaders(), cache: "no-store" });
  if (!res.ok) return { authenticated: false, auth_required: false, keycloak_enabled: false, user: null };
  return res.json();
}

export async function listUsers(): Promise<AuthUser[]> {
  const res = await fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error("Gagal memuat daftar pengguna");
  return res.json();
}

export async function createUserAccount(payload: { email: string; nama: string; password: string; role: string; wilayah_scope: string[] }): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal membuat pengguna");
  }
  return res.json();
}

export async function updateUserAccount(id: number, payload: Partial<{ nama: string; role: string; wilayah_scope: string[]; is_active: boolean; password: string }>): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Gagal memperbarui pengguna");
  return res.json();
}

export function getReportPdfUrl(reportId: number): string {
  return `${API_BASE_URL}/reports/${reportId}/pdf`;
}
