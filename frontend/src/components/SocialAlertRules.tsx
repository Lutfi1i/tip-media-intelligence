"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ackSocialAlertEvent,
  createSocialAlertRule,
  deleteSocialAlertRule,
  evaluateSocialAlertRules,
  fetchSocialAlertEvents,
  fetchSocialAlertRules,
  SocialAlertEvent,
  SocialAlertRule,
  SocialAlertRuleInput,
  SocialFacets,
  testSocialAlertRule,
  updateSocialAlertRule,
} from "@/lib/api";
import { formatWib } from "@/components/SocialCharts";

const NAME_KEY = "tip.analystName";
const PLATFORMS = ["", "X (Twitter)", "TikTok", "YouTube", "Threads", "Instagram", "Reddit", "Telegram"];
const inputCls =
  "mt-0.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

const EMPTY: SocialAlertRuleInput = {
  nama: "",
  term: "",
  category: "",
  agency: "",
  platform: "",
  scope_kode: "ID",
  metric: "negatif",
  threshold: 5,
  window: "1h",
  cooldown_menit: 60,
  aktif: true,
  dibuat_oleh: "Analis",
};

export function SocialAlertRules({
  facets,
  scopeKode,
  onEventsChanged,
}: {
  facets: SocialFacets | null;
  scopeKode: string;
  onEventsChanged: () => void;
}) {
  const [rules, setRules] = useState<SocialAlertRule[]>([]);
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<SocialAlertEvent[]>([]);
  const [form, setForm] = useState<SocialAlertRuleInput>({ ...EMPTY, scope_kode: scopeKode });
  const [testResult, setTestResult] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([fetchSocialAlertRules(), fetchSocialAlertEvents()]);
      setRules(r.rules);
      setMetrics(r.metrics);
      setEvents(e.events);
    } catch {
      setError("Aturan alert gagal dimuat.");
    }
  }, []);

  useEffect(() => {
    load();
    try {
      const name = window.localStorage.getItem(NAME_KEY);
      if (name) setForm((f) => ({ ...f, dibuat_oleh: name }));
    } catch {
      // penyimpanan peramban tidak tersedia
    }
  }, [load]);

  useEffect(() => setForm((f) => ({ ...f, scope_kode: scopeKode })), [scopeKode]);

  const set = <K extends keyof SocialAlertRuleInput>(k: K, v: SocialAlertRuleInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const rule = await createSocialAlertRule(form);
      setMessage(`Aturan "${rule.nama}" dibuat: ${rule.deskripsi}.`);
      setForm({ ...EMPTY, scope_kode: scopeKode, dibuat_oleh: form.dibuat_oleh });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aturan gagal dibuat.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (r: SocialAlertRule) => {
    try {
      await updateSocialAlertRule(r.id, { ...ruleToInput(r), aktif: !r.aktif });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aturan gagal diubah.");
    }
  };

  const remove = async (r: SocialAlertRule) => {
    if (!window.confirm(`Hapus aturan "${r.nama}" beserta riwayat alert-nya?`)) return;
    await deleteSocialAlertRule(r.id);
    await load();
    onEventsChanged();
  };

  const test = async (r: SocialAlertRule) => {
    const res = await testSocialAlertRule(r.id);
    const value = r.metric === "lonjakan" ? `${res.value}x` : String(res.value);
    setTestResult((t) => ({
      ...t,
      [r.id]: `Nilai sekarang ${value} (ambang ${r.threshold}). ${res.would_trigger ? "Akan memicu alert." : "Belum memicu."}${
        res.baseline_ready ? "" : " Baseline belum tersedia."
      }`,
    }));
  };

  const evaluate = async () => {
    setBusy(true);
    try {
      const res = await evaluateSocialAlertRules();
      setMessage(`${res.checked} aturan dicek, ${res.triggered.length} memicu alert.`);
      await load();
      onEventsChanged();
    } finally {
      setBusy(false);
    }
  };

  const ack = async (ev: SocialAlertEvent) => {
    await ackSocialAlertEvent(ev.id, form.dibuat_oleh || "Analis");
    await load();
    onEventsChanged();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Aturan Alert</h2>
          <p className="max-w-2xl text-xs text-zinc-500 dark:text-zinc-400">
            Aturan dicek setiap kali data ditarik. Aturan yang terpenuhi mencatat satu alert, lalu menunggu masa jeda sebelum bisa memicu lagi.
            Lonjakan hanya dinilai bila baseline sudah ada dan volume minimal 3 konten.
          </p>
        </div>
        <button onClick={evaluate} disabled={busy} className="self-start rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
          Cek semua aturan sekarang
        </button>
      </div>

      {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col text-2xs text-zinc-500 sm:col-span-2">
          Nama aturan
          <input required value={form.nama} onChange={(e) => set("nama", e.target.value)} placeholder="Mis. Keluhan PLN melonjak" className={inputCls} />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Kata kunci (opsional)
          <input value={form.term ?? ""} onChange={(e) => set("term", e.target.value)} placeholder="Mis. banjir" className={inputCls} />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Platform
          <select value={form.platform ?? ""} onChange={(e) => set("platform", e.target.value)} className={inputCls}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p || "Semua platform"}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Kategori
          <select value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} className={inputCls}>
            <option value="">Semua kategori</option>
            {facets?.categories.filter((c) => c.id !== "lainnya").map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Instansi
          <select value={form.agency ?? ""} onChange={(e) => set("agency", e.target.value)} className={inputCls}>
            <option value="">Semua instansi</option>
            {facets?.agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Metrik
          <select value={form.metric} onChange={(e) => set("metric", e.target.value)} className={inputCls}>
            {Object.entries(metrics).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          {form.metric === "lonjakan" ? "Ambang (kali baseline)" : "Ambang (jumlah konten)"}
          <input type="number" min={form.metric === "lonjakan" ? 1 : 1} step={form.metric === "lonjakan" ? 0.5 : 1} required
            value={form.threshold} onChange={(e) => set("threshold", Number(e.target.value))} className={inputCls} />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Dalam jendela
          <select value={form.window} onChange={(e) => set("window", e.target.value)} className={inputCls}>
            <option value="1h">1 jam</option>
            <option value="6h">6 jam</option>
            <option value="24h">24 jam</option>
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Jeda antar-alert (menit)
          <input type="number" min={5} required value={form.cooldown_menit} onChange={(e) => set("cooldown_menit", Number(e.target.value))} className={inputCls} />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Dibuat oleh
          <input value={form.dibuat_oleh} onChange={(e) => set("dibuat_oleh", e.target.value)} className={inputCls} />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={busy} className="rounded-lg bg-fuchsia-600 px-4 py-2 text-xs font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50">
            Simpan aturan
          </button>
        </div>
        <p className="text-2xs text-zinc-500 sm:col-span-2 lg:col-span-4">Wilayah aturan mengikuti cakupan yang sedang aktif ({scopeKode === "ID" ? "nasional" : scopeKode}).</p>
      </form>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">Aturan ({rules.length})</h3>
          {rules.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-zinc-500">Belum ada aturan.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rules.map((r) => (
                <li key={r.id} className={`px-4 py-3 text-xs ${r.aktif ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.nama}</div>
                      <div className="text-zinc-600 dark:text-zinc-400">{r.deskripsi}</div>
                      <div className="text-2xs text-zinc-500">
                        Jeda {r.cooldown_menit} menit · oleh {r.dibuat_oleh}
                        {r.last_triggered_at ? ` · terakhir memicu ${formatWib(r.last_triggered_at)} WIB` : " · belum pernah memicu"}
                      </div>
                      {testResult[r.id] && <div className="mt-1 text-2xs text-sky-700 dark:text-sky-300">{testResult[r.id]}</div>}
                    </div>
                    <div className="flex shrink-0 gap-2 text-2xs font-semibold">
                      <button onClick={() => test(r)} className="text-sky-700 hover:underline dark:text-sky-300">Uji</button>
                      <button onClick={() => toggle(r)} className="text-zinc-700 hover:underline dark:text-zinc-300">{r.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
                      <button onClick={() => remove(r)} className="text-rose-700 hover:underline dark:text-rose-400">Hapus</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="border-b border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">Riwayat alert</h3>
          {events.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-zinc-500">Belum ada alert yang terpicu.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {events.map((ev) => (
                <li key={ev.id} className="px-4 py-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {ev.status === "baru" && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-2xs font-bold text-rose-700 dark:text-rose-300">Baru</span>}
                        <span className="font-mono text-2xs text-zinc-500">{formatWib(ev.triggered_at)} WIB</span>
                      </div>
                      <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">{ev.ringkasan}</p>
                      {ev.samples.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-2xs text-zinc-500">
                          {ev.samples.map((s) => (
                            <li key={s.id} className="truncate">
                              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.judul}</a> : s.judul}
                            </li>
                          ))}
                        </ul>
                      )}
                      {ev.status === "dilihat" && <div className="mt-0.5 text-2xs text-zinc-400">Dilihat oleh {ev.dilihat_oleh}</div>}
                    </div>
                    {ev.status === "baru" && (
                      <button onClick={() => ack(ev)} className="shrink-0 text-2xs font-semibold text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                        Tandai dilihat
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ruleToInput(r: SocialAlertRule): SocialAlertRuleInput {
  return {
    nama: r.nama,
    term: r.term ?? "",
    category: r.category ?? "",
    agency: r.agency ?? "",
    platform: r.platform ?? "",
    scope_kode: r.scope_kode,
    metric: r.metric,
    threshold: r.threshold,
    window: r.window,
    cooldown_menit: r.cooldown_menit,
    aktif: r.aktif,
    dibuat_oleh: r.dibuat_oleh,
  };
}
