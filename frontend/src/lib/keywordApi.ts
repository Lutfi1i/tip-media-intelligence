/** Klien API menu Pantau Keyword (/api/v1/keyword). Bentuk data mengikuti backend/app/services/keyword_monitor.py. */

import { API_BASE_URL } from "./api";

export type Sentiment = "positif" | "netral" | "negatif";
export const SENTIMENTS: Sentiment[] = ["positif", "netral", "negatif"];
export type KeywordPeriod = "today" | "7d" | "30d";

export interface KeywordProject {
  id: number;
  nama: string;
  kata_kunci: string[];
  kecualikan: string[];
  aktif: boolean;
  dibuat: string | null;
  terakhir_ditarik: string | null;
  status_tarik: "menunggu" | "berjalan" | "ok" | "gagal" | null;
  galat_tarik: string | null;
  sebutan_baru_terakhir: number | null;
}

export interface KeywordProjectRow extends KeywordProject {
  sebutan_7h: number;
  positif_7h: number;
  netral_7h: number;
  negatif_7h: number;
}

export type SentCounts = Record<Sentiment, number>;

export interface Mention {
  id: number;
  item_id: number;
  judul: string;
  cuplikan: string;
  url: string | null;
  platform: string;
  sumber: string;
  published_at: string;
  sentimen: Sentiment;
  sentimen_sumber: "kamus" | "ai" | "manual";
  sentimen_alasan: string | null;
  isu: string | null;
  views: number | null;
  interaksi: number | null;
}

export interface GroupRow extends SentCounts {
  nama: string;
  sebutan: number;
}

export interface KeywordDashboard {
  proyek: KeywordProject;
  periode: { key: KeywordPeriod; mulai: string; akhir: string; mulai_sebelumnya: string };
  ringkasan: {
    sebutan: number;
    sebutan_sebelumnya: number;
    perubahan_pct: number | null;
    pembanding_lengkap: boolean;
    sentimen: SentCounts;
    sentimen_sebelumnya: SentCounts;
    jangkauan_views: number | null;
    jangkauan_cakupan: number;
    interaksi: number | null;
    interaksi_cakupan: number;
    sumber_unik: number;
    dinilai_ai: number;
    dikoreksi_manual: number;
  };
  timeline: ({ t: string; total: number } & SentCounts)[];
  platform: GroupRow[];
  sumber_teratas: GroupRow[];
  isu: GroupRow[];
  isu_belum_dilabeli: number;
  kata_konteks: { kata: string; jumlah: number; sentimen: Sentiment }[];
  hashtag: { tag: string; jumlah: number }[];
  populer: Mention[];
  negatif_terbaru: Mention[];
  sumber_data: { nama: string; status: string | null; galat: string | null; terakhir_berhasil: string | null }[];
  ai_tersedia: boolean;
}

export interface MentionPage {
  total: number;
  per_sentimen: SentCounts;
  halaman: number;
  per_halaman: number;
  sebutan: Mention[];
}

async function call<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/keyword${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    let detail = fallback;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // pakai pesan bawaan
    }
    throw new Error(detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const fetchKeywordProjects = () =>
  call<{ proyek: KeywordProjectRow[]; maks_kata: number }>("", "Daftar keyword gagal dimuat");

export const createKeywordProject = (nama: string, kata_kunci: string[], kecualikan: string[]) =>
  call<KeywordProject>("", "Keyword gagal ditambahkan", json("POST", { nama, kata_kunci, kecualikan }));

export const updateKeywordProject = (
  id: number,
  patch: Partial<{ nama: string; kata_kunci: string[]; kecualikan: string[]; aktif: boolean }>,
) => call<KeywordProject>(`/${id}`, "Keyword gagal disimpan", json("PATCH", patch));

export const deleteKeywordProject = (id: number) => call<void>(`/${id}`, "Keyword gagal dihapus", { method: "DELETE" });

export const refreshKeywordProject = (id: number) =>
  call<{ dimulai: boolean; proyek: KeywordProject }>(`/${id}/tarik`, "Tarikan gagal dimulai", { method: "POST" });

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  return q.toString();
};

export const fetchKeywordDashboard = (id: number, periode: KeywordPeriod, platform: string) =>
  call<KeywordDashboard>(`/${id}?${query({ periode, platform })}`, "Ringkasan keyword gagal dimuat");

export const fetchMentions = (
  id: number,
  p: { periode: KeywordPeriod; platform: string; sentimen?: Sentiment; isu?: string; urut: "terbaru" | "populer"; halaman: number },
) => call<MentionPage>(`/${id}/sebutan?${query(p)}`, "Sebutan gagal dimuat");

export const setMentionSentiment = (projectId: number, mentionId: number, sentimen: Sentiment) =>
  call<{ id: number; sentimen: Sentiment; sentimen_sumber: string }>(
    `/${projectId}/sebutan/${mentionId}`,
    "Sentimen gagal disimpan",
    json("PATCH", { sentimen }),
  );
