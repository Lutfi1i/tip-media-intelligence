const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

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
    faktor: Record<string, { bobot: string; nilai: number; kontribusi: number; catatan: string }>;
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
    riwayat: Array<{ waktu: string; status_sebelum?: string; status_baru: string; catatan: string }>;
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
  riwayat: Array<{ waktu: string; status_sebelum?: string; status_baru: string; catatan: string }>;
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
  const res = await fetch(`${API_BASE_URL}/dashboard/summary`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil ringkasan dashboard");
  return res.json();
}

export async function fetchIssues(params?: { status?: string; level?: string; q?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.level) query.set("level", params.level);
  if (params?.q) query.set("q", params.q);

  const res = await fetch(`${API_BASE_URL}/issues?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil daftar isu");
  return res.json();
}

export async function fetchIssueDetail(id: number | string) {
  const res = await fetch(`${API_BASE_URL}/issues/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil detail isu");
  return res.json();
}

export async function submitIssueReview(
  issueId: number,
  payload: { reviewer_id: string; reviewer_nama: string; keputusan: string; catatan?: string }
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
  const url = status ? `${API_BASE_URL}/cases?status=${status}` : `${API_BASE_URL}/cases`;
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

export async function testProfile7d(profileId: number) {
  const res = await fetch(`${API_BASE_URL}/profiles/${profileId}/test-7d`, { method: "POST" });
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
    `${API_BASE_URL}/reports/generate?jenis=${encodeURIComponent(jenis)}&periode=${encodeURIComponent(periode)}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Gagal menghasilkan laporan");
  return res.json();
}

export async function fetchAuditLogs() {
  const res = await fetch(`${API_BASE_URL}/audit/logs`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil log audit");
  return res.json();
}

export async function fetchAiEvaluation() {
  const res = await fetch(`${API_BASE_URL}/audit/ai-evaluation`, { cache: "no-store" });
  if (!res.ok) throw new Error("Gagal mengambil evaluasi AI");
  return res.json();
}

export async function triggerFloodScenario() {
  const res = await fetch(`${API_BASE_URL}/simulation/trigger-flood-scenario`, { method: "POST" });
  if (!res.ok) throw new Error("Gagal memicu simulasi skenario");
  return res.json();
}
