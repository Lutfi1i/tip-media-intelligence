"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { fmtDateTime, fmtNum, fmtRelative, fmtSignedPct } from "@/lib/format";
import {
  createKeywordProject,
  deleteKeywordProject,
  fetchKeywordDashboard,
  fetchKeywordProjects,
  KeywordDashboard,
  KeywordPeriod,
  KeywordProject,
  KeywordProjectRow,
  refreshKeywordProject,
  SENTIMENTS,
  updateKeywordProject,
} from "@/lib/keywordApi";
import { ConfirmDialog, ErrorPanel, Modal, Notice } from "@/components/ui";
import { Section } from "@/components/trend/TrendUi";
import {
  GroupSentBars,
  pctOf,
  SENT_LABEL,
  SENT_VAR,
  SentimentDonut,
  SentimentTimeline,
  WordCloud,
} from "@/components/keyword/KeywordCharts";
import { KeywordInfographic, platformName } from "@/components/keyword/KeywordInfographic";
import { MentionList } from "@/components/keyword/MentionList";

const PERIODS: { value: KeywordPeriod; label: string }[] = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
];

// Nilai sama dengan RawItem.platform di backend. "berita" = portal berita online.
const PLATFORMS = ["Semua", "berita", "YouTube", "Bluesky", "Telegram", "X (Twitter)", "TikTok", "Instagram", "Threads"];

type Tab = "ringkasan" | "sebutan" | "infografis";
const TABS: { value: Tab; label: string }[] = [
  { value: "ringkasan", label: "Ringkasan" },
  { value: "sebutan", label: "Sebutan" },
  { value: "infografis", label: "Infografis" },
];

const inputCls =
  "w-full min-h-[40px] rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const btnCls =
  "inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
const primaryCls =
  "inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";

const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const isBusy = (p?: KeywordProject | null) => p?.status_tarik === "berjalan" || p?.status_tarik === "menunggu";

// ---------------------------------------------------------------------------
// Form keyword
// ---------------------------------------------------------------------------

function ProjectForm({
  initial,
  maxTerms,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: KeywordProject;
  maxTerms: number;
  submitLabel: string;
  onSubmit: (nama: string, terms: string[], excluded: string[]) => Promise<void>;
  onCancel?: () => void;
}) {
  const [nama, setNama] = useState(initial?.nama ?? "");
  const [others, setOthers] = useState(initial ? initial.kata_kunci.filter((t) => t.toLowerCase() !== initial.nama.toLowerCase()).join(", ") : "");
  const [excluded, setExcluded] = useState(initial?.kecualikan.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const terms = [nama.trim(), ...splitList(others)].filter(Boolean);
  const tooMany = terms.length > maxTerms;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || tooMany) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(nama.trim(), terms, splitList(excluded));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Gagal disimpan");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="kw-nama" className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
          Keyword
        </label>
        <input
          id="kw-nama"
          className={`${inputCls} mt-1`}
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Contoh: BUMN"
          maxLength={60}
          required
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="kw-lain" className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
          Kata lain yang ikut dihitung <span className="font-normal text-zinc-500">(opsional, pisahkan dengan koma)</span>
        </label>
        <input
          id="kw-lain"
          className={`${inputCls} mt-1`}
          value={others}
          onChange={(e) => setOthers(e.target.value)}
          placeholder="Contoh: Badan Usaha Milik Negara, Kementerian BUMN"
        />
        <p className={`mt-1 text-2xs ${tooMany ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
          {terms.length} dari {maxTerms} kata. Sebutan dihitung bila salah satu kata muncul.
        </p>
      </div>
      <div>
        <label htmlFor="kw-kecuali" className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
          Abaikan bila menyebut <span className="font-normal text-zinc-500">(opsional)</span>
        </label>
        <input
          id="kw-kecuali"
          className={`${inputCls} mt-1`}
          value={excluded}
          onChange={(e) => setExcluded(e.target.value)}
          placeholder="Contoh: lowongan, loker"
        />
      </div>
      {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnCls}>
            Batal
          </button>
        )}
        <button type="submit" disabled={busy || !nama.trim() || tooMany} className={primaryCls}>
          {busy ? "Menyimpan..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bagian ringkasan
// ---------------------------------------------------------------------------

function Delta({ cur, prev, invert = false, complete }: { cur: number; prev: number; invert?: boolean; complete: boolean }) {
  if (!complete)
    return (
      <span className="text-zinc-500 dark:text-zinc-400" title="Keyword mulai dipantau di tengah periode pembanding, jadi persen naik/turun belum bisa dihitung dengan adil.">
        pembanding belum lengkap
      </span>
    );
  if (!prev) return <span className="text-zinc-500 dark:text-zinc-400">belum ada pembanding</span>;
  const pct = ((cur - prev) / prev) * 100;
  // Untuk negatif, naik berarti memburuk: warnanya dibalik.
  const good = invert ? pct < 0 : pct > 0;
  const cls = pct === 0 ? "text-zinc-500" : good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400";
  return (
    <span>
      <span className={`font-mono font-bold ${cls}`}>{fmtSignedPct(pct)}</span>
      <span className="text-zinc-500 dark:text-zinc-400"> dari {fmtNum(prev)}</span>
    </span>
  );
}

function StatCard({ label, value, color, children }: { label: string; value: string; color?: string; children?: ReactNode }) {
  return (
    <div className="panel relative min-w-0 overflow-hidden border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#09090B]">
      {color && <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} aria-hidden="true" />}
      <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-black leading-tight text-zinc-900 dark:text-white">{value}</div>
      {children && <div className="mt-1 text-2xs">{children}</div>}
    </div>
  );
}

function Summary({ data, onIssue }: { data: KeywordDashboard; onIssue: (isu: string) => void }) {
  const r = data.ringkasan;
  const total = r.sebutan;
  const hourly = data.periode.key === "today";
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Sebutan" value={fmtNum(total)}>
          <Delta cur={total} prev={r.sebutan_sebelumnya} complete={r.pembanding_lengkap} />
        </StatCard>
        {SENTIMENTS.map((s) => (
          <StatCard key={s} label={`${SENT_LABEL[s]} (${fmtNum(pctOf(r.sentimen[s], total))}%)`} value={fmtNum(r.sentimen[s])} color={SENT_VAR[s]}>
            {s === "netral" ? (
              <span className="text-zinc-500 dark:text-zinc-400">tanpa penilaian</span>
            ) : (
              <Delta cur={r.sentimen[s]} prev={r.sentimen_sebelumnya[s]} invert={s === "negatif"} complete={r.pembanding_lengkap} />
            )}
          </StatCard>
        ))}
        <StatCard label="Jangkauan (views)" value={r.jangkauan_views === null ? "tidak tersedia" : fmtNum(r.jangkauan_views)}>
          <span className="text-zinc-500 dark:text-zinc-400">dari {fmtNum(r.jangkauan_cakupan)} konten berangka</span>
        </StatCard>
        <StatCard label="Interaksi" value={r.interaksi === null ? "tidak tersedia" : fmtNum(r.interaksi)}>
          <span className="text-zinc-500 dark:text-zinc-400">dari {fmtNum(r.interaksi_cakupan)} konten berangka</span>
        </StatCard>
      </div>

      <Section
        title={hourly ? "Sebutan per jam" : "Sebutan per hari"}
        hint={`${fmtNum(r.sumber_unik)} sumber berbeda. Tiap batang dibagi menurut sentimen.`}
      >
        <SentimentTimeline points={data.timeline} hourly={hourly} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Porsi sentimen"
          hint={
            r.dinilai_ai
              ? `${fmtNum(r.dinilai_ai)} dinilai AI terhadap keyword ini, ${fmtNum(r.dikoreksi_manual)} dikoreksi analis.`
              : "Dinilai dengan kamus kata. Penilaian AI berjalan setelah tarikan berikutnya."
          }
        >
          {total ? <SentimentDonut counts={r.sentimen} /> : <p className="text-xs text-zinc-500">Belum ada sebutan di periode ini.</p>}
        </Section>
        <Section
          title="Isu yang dibicarakan"
          hint={
            data.isu_belum_dilabeli
              ? `Klik isu untuk melihat sebutannya. ${fmtNum(data.isu_belum_dilabeli)} sebutan belum dilabeli AI.`
              : "Dikelompokkan AI dari isi sebutan. Klik isu untuk melihat sebutannya."
          }
        >
          <GroupSentBars rows={data.isu} onSelect={onIssue} />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sentimen per platform">
          <GroupSentBars rows={data.platform} label={platformName} />
        </Section>
        <Section title="Sumber teratas" hint="Media untuk berita, akun untuk media sosial.">
          <GroupSentBars rows={data.sumber_teratas} />
        </Section>
      </div>

      <Section title="Konteks percakapan" hint="Kata yang paling sering muncul bersama keyword.">
        <WordCloud words={data.kata_konteks} />
        {data.hashtag.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {data.hashtag.map((h) => (
              <span key={h.tag} className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {h.tag} <span className="font-mono font-normal text-zinc-500">{h.jumlah}</span>
              </span>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sebutan negatif terbaru" hint="Perlu dicek lebih dulu bila ada lonjakan.">
          <BriefList items={data.negatif_terbaru} empty="Tidak ada sebutan negatif di periode ini." />
        </Section>
        <Section title="Interaksi terbanyak" hint="Hanya konten yang platformnya menyediakan angka.">
          <BriefList items={data.populer} empty="Belum ada konten dengan angka interaksi." metric />
        </Section>
      </div>
    </div>
  );
}

function BriefList({ items, empty, metric = false }: { items: KeywordDashboard["populer"]; empty: string; metric?: boolean }) {
  if (!items.length) return <p className="text-xs text-zinc-500 dark:text-zinc-400">{empty}</p>;
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {items.map((m) => (
        <li key={m.id} className="flex gap-2.5 py-2.5">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SENT_VAR[m.sentimen] }} aria-label={m.sentimen} />
          <div className="min-w-0">
            <a
              href={m.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-2 break-words text-sm font-semibold text-zinc-900 [overflow-wrap:anywhere] hover:underline dark:text-zinc-100"
            >
              {m.judul}
            </a>
            <div className="mt-0.5 text-2xs text-zinc-500 dark:text-zinc-400">
              {platformName(m.platform)} &bull; {m.sumber} &bull; {fmtRelative(m.published_at)}
              {metric && m.interaksi !== null && <> &bull; <span className="font-mono">{fmtNum(m.interaksi)}</span> interaksi</>}
              {metric && m.views !== null && <> &bull; <span className="font-mono">{fmtNum(m.views)}</span> views</>}
            </div>
            {m.sentimen_alasan && <div className="mt-0.5 text-2xs italic text-zinc-500 dark:text-zinc-400">{m.sentimen_alasan}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SourceStatus({ data }: { data: KeywordDashboard }) {
  return (
    <details className="panel border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-[#09090B]">
      <summary className="cursor-pointer font-bold text-zinc-800 dark:text-zinc-100">Sumber data keyword ini</summary>
      <ul className="mt-3 space-y-1.5">
        {data.sumber_data.map((s) => (
          <li key={s.nama} className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                s.status === "ok"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : s.status === "gagal"
                    ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {s.status === "ok" ? "berhasil" : s.status === "gagal" ? "gagal" : "belum ditarik"}
            </span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">{s.nama}</span>
            {s.galat && <span className="text-zinc-500 dark:text-zinc-400">{s.galat}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-zinc-500 dark:text-zinc-400">
        Sebutan juga diambil dari semua RSS berita dan kanal Telegram yang sudah dipantau. X, TikTok, Instagram, dan Threads belum
        punya sumber gratis yang diizinkan, jadi sebutan dari platform itu hanya muncul bila sudah ada di data lama.
      </p>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Halaman
// ---------------------------------------------------------------------------

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function PantauKeywordPage() {
  const [projects, setProjects] = useState<KeywordProjectRow[] | null>(null);
  const [maxTerms, setMaxTerms] = useState(5);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [periode, setPeriode] = useState<KeywordPeriod>("7d");
  const [platform, setPlatform] = useState("Semua");
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [issue, setIssue] = useState<string | null>(null);
  const [data, setData] = useState<KeywordDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"tambah" | "ubah" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const seq = useRef(0);

  const current = projects?.find((p) => p.id === selected) ?? null;

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetchKeywordProjects();
      setProjects(res.proyek);
      setMaxTerms(res.maks_kata);
      setListError(null);
      setSelected((sel) => {
        if (sel && res.proyek.some((p) => p.id === sel)) return sel;
        const fromUrl = Number(readParam("id"));
        if (fromUrl && res.proyek.some((p) => p.id === fromUrl)) return fromUrl;
        return res.proyek[0]?.id ?? null;
      });
      return res.proyek;
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Daftar keyword gagal dimuat");
      return null;
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!selected) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchKeywordDashboard(selected, periode, platform);
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Ringkasan gagal dimuat");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [selected, periode, platform]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (selected === null) return;
    setData((d) => (d && d.proyek.id === selected ? d : null));
    loadDashboard();
    const q = new URLSearchParams(window.location.search);
    q.set("id", String(selected));
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  }, [selected, loadDashboard]);

  // Selama tarikan berjalan, cek status tiap 4 detik lalu muat ulang ringkasan saat selesai.
  const busy = isBusy(current);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(async () => {
      const list = await loadProjects();
      const p = list?.find((x) => x.id === selected);
      if (p && !isBusy(p)) loadDashboard();
    }, 4000);
    return () => clearInterval(t);
  }, [busy, selected, loadProjects, loadDashboard]);

  const selectProject = (id: number) => {
    setSelected(id);
    setIssue(null);
    setNotice(null);
  };

  const openIssue = (isu: string | null) => {
    setIssue(isu);
    if (isu) setTab("sebutan");
  };

  const create = async (nama: string, terms: string[], excluded: string[]) => {
    const p = await createKeywordProject(nama, terms, excluded);
    setModal(null);
    await loadProjects();
    selectProject(p.id);
    setTab("ringkasan");
    setNotice(`Keyword "${p.nama}" ditambahkan. Data sedang ditarik dari Bing News, YouTube, Bluesky, dan GDELT, biasanya 1 sampai 2 menit.`);
  };

  const save = async (nama: string, terms: string[], excluded: string[]) => {
    if (!current) return;
    await updateKeywordProject(current.id, { nama, kata_kunci: terms, kecualikan: excluded });
    setModal(null);
    await loadProjects();
    loadDashboard();
  };

  const refresh = async () => {
    if (!current) return;
    try {
      const res = await refreshKeywordProject(current.id);
      setNotice(res.dimulai ? "Tarikan dimulai. Ringkasan diperbarui otomatis setelah selesai." : "Keyword ini sedang ditarik.");
      await loadProjects();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Tarikan gagal dimulai");
    }
  };

  const toggleActive = async () => {
    if (!current) return;
    await updateKeywordProject(current.id, { aktif: !current.aktif });
    await loadProjects();
  };

  const remove = async () => {
    if (!current) return;
    setDeleting(true);
    try {
      await deleteKeywordProject(current.id);
      setConfirmDelete(false);
      setSelected(null);
      setData(null);
      await loadProjects();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Keyword gagal dihapus");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">Pantau Keyword</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Berapa kali sebuah keyword disebut, berapa yang positif dan negatif, isu apa yang dibicarakan, dan dari mana asalnya.
          </p>
        </div>
        {projects && projects.length > 0 && (
          <button type="button" onClick={() => setModal("tambah")} className={primaryCls}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah keyword
          </button>
        )}
      </div>

      {listError && !projects && <ErrorPanel title="Daftar keyword gagal dimuat" message={listError} onRetry={loadProjects} />}
      {!projects && !listError && <p className="py-12 text-center text-sm text-zinc-500">Memuat keyword...</p>}

      {projects && projects.length === 0 && (
        <div className="panel mx-auto max-w-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#09090B]">
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">Keyword pertama</h2>
          <p className="mb-5 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Tulis nama lembaga, merek, tokoh, atau topik. Sistem langsung menarik berita dan postingan yang menyebutnya, lalu menilai
            sentimennya, dan mengulang tarikan setiap jam.
          </p>
          <ProjectForm maxTerms={maxTerms} submitLabel="Mulai pantau" onSubmit={create} />
        </div>
      )}

      {projects && projects.length > 0 && (
        <>
          {/* Pilihan keyword */}
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-2 pb-1" role="tablist" aria-label="Keyword yang dipantau">
              {projects.map((p) => {
                const active = p.id === selected;
                return (
                  <li key={p.id} className="shrink-0">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => selectProject(p.id)}
                      className={`min-h-[52px] min-w-[132px] rounded-lg border px-3 py-2 text-left ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 dark:border-zinc-800 dark:bg-[#09090B] dark:text-zinc-100 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-sm font-bold">
                        {!p.aktif && <Pause className="h-3 w-3" aria-label="dijeda" />}
                        {p.nama}
                      </div>
                      <div className={`mt-0.5 flex gap-2 font-mono text-2xs ${active ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"}`}>
                        <span>{fmtNum(p.sebutan_7h)} / 7 hari</span>
                        <span title="positif">+{p.positif_7h}</span>
                        <span title="negatif">-{p.negatif_7h}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {current && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-black text-zinc-900 dark:text-white">{current.nama}</h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Mencari: {current.kata_kunci.join(", ")}
                    {current.kecualikan.length > 0 && <> &bull; Mengabaikan: {current.kecualikan.join(", ")}</>}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
                    {busy ? (
                      <span className="font-semibold text-sky-700 dark:text-sky-300">Sedang menarik data dan menilai sentimen...</span>
                    ) : current.terakhir_ditarik ? (
                      <>
                        Ditarik {fmtRelative(current.terakhir_ditarik)}
                        {current.sebutan_baru_terakhir !== null && <>, {fmtNum(current.sebutan_baru_terakhir)} sebutan baru</>}.
                        {current.aktif ? " Diulang tiap jam." : " Tarikan otomatis dijeda."}
                      </>
                    ) : (
                      "Belum pernah ditarik."
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={refresh} disabled={busy} className={btnCls}>
                    <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
                    Perbarui
                  </button>
                  <button type="button" onClick={() => setModal("ubah")} className={btnCls}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Ubah
                  </button>
                  <button type="button" onClick={toggleActive} className={btnCls}>
                    {current.aktif ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                    {current.aktif ? "Jeda" : "Lanjutkan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className={`${btnCls} text-red-700 dark:text-red-400`}
                    aria-label={`Hapus keyword ${current.nama}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Hapus</span>
                  </button>
                </div>
              </div>

              {notice && <Notice tone="info" message={notice} onClose={() => setNotice(null)} />}
              {current.status_tarik === "gagal" && current.galat_tarik && (
                <Notice tone="error" message={`Tarikan terakhir gagal: ${current.galat_tarik}`} />
              )}

              {/* Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700" role="radiogroup" aria-label="Periode">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={periode === p.value}
                      onClick={() => setPeriode(p.value)}
                      className={`min-h-[34px] rounded px-3 text-xs font-bold ${
                        periode === p.value ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="sr-only" htmlFor="kw-platform">
                  Platform
                </label>
                <select
                  id="kw-platform"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="min-h-[38px] rounded-md border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p === "Semua" ? "Semua platform" : platformName(p)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tab */}
              <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800" role="tablist" aria-label="Tampilan">
                {TABS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.value}
                    onClick={() => setTab(t.value)}
                    className={`-mb-px min-h-[40px] border-b-2 px-3 text-sm font-bold ${
                      tab === t.value
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    {t.label}
                    {t.value === "sebutan" && data && <span className="ml-1.5 font-mono text-xs font-normal">{fmtNum(data.ringkasan.sebutan)}</span>}
                  </button>
                ))}
              </div>

              {error && !data && <ErrorPanel title="Ringkasan gagal dimuat" message={error} onRetry={loadDashboard} />}
              {!data && !error && <p className="py-12 text-center text-sm text-zinc-500">{loading ? "Memuat ringkasan..." : ""}</p>}

              {data && (
                <div className={`transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
                  {error && <Notice tone="error" message={`Pembaruan gagal: ${error}`} onRetry={loadDashboard} />}
                  {data.ringkasan.sebutan === 0 && !busy && tab !== "sebutan" && (
                    <div className="mb-6">
                      <Notice tone="info">
                        Belum ada sebutan di periode ini. Coba periode lebih panjang, atau tunggu tarikan berikutnya.
                      </Notice>
                    </div>
                  )}
                  {tab === "ringkasan" && <Summary data={data} onIssue={openIssue} />}
                  {tab === "sebutan" && (
                    <Section title="Semua sebutan" hint="Sentimen bisa dikoreksi. Koreksi Anda tidak akan ditimpa AI.">
                      <MentionList
                        projectId={data.proyek.id}
                        periode={periode}
                        platform={platform}
                        issue={issue}
                        onIssue={setIssue}
                        onChanged={loadDashboard}
                      />
                    </Section>
                  )}
                  {tab === "infografis" && (
                    <Section title="Infografis">
                      <KeywordInfographic data={data} />
                    </Section>
                  )}
                  <div className="mt-6">
                    <SourceStatus data={data} />
                  </div>
                  <p className="mt-3 text-2xs text-zinc-500 dark:text-zinc-400">
                    Periode {fmtDateTime(data.periode.mulai)} sampai {fmtDateTime(data.periode.akhir)}, dibandingkan dengan periode
                    sebelumnya yang sama panjang.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal open={modal === "tambah"} onClose={() => setModal(null)} title="Tambah keyword" description="Data ditarik langsung setelah disimpan.">
        <ProjectForm maxTerms={maxTerms} submitLabel="Mulai pantau" onSubmit={create} onCancel={() => setModal(null)} />
      </Modal>
      <Modal open={modal === "ubah" && !!current} onClose={() => setModal(null)} title="Ubah keyword" description="Mengubah kata akan menarik ulang data.">
        {current && <ProjectForm key={current.id} initial={current} maxTerms={maxTerms} submitLabel="Simpan" onSubmit={save} onCancel={() => setModal(null)} />}
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title={`Hapus keyword "${current?.nama ?? ""}"?`}
        description="Daftar sebutan, label sentimen, dan koreksi manual untuk keyword ini ikut terhapus. Berita dan postingan yang sudah ditarik tetap tersimpan."
        confirmLabel="Hapus keyword"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
