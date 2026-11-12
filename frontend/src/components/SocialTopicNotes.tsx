"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { addSocialTopicNote, fetchSocialTopicNotes, SocialTopicNote } from "@/lib/api";
import { formatWib } from "@/components/SocialCharts";

const NAME_KEY = "tip.analystName";

export const NOTE_STATUS_STYLE: Record<string, string> = {
  dipantau: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  sudah_dicek: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  hoaks: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  ditangani: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  bukan_isu: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
};

export function SocialTopicNotes({
  topicKey,
  topicLabel,
  onSaved,
}: {
  topicKey: string;
  topicLabel: string;
  onSaved?: () => void;
}) {
  const [notes, setNotes] = useState<SocialTopicNote[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("dipantau");
  const [catatan, setCatatan] = useState("");
  const [aktor, setAktor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchSocialTopicNotes(topicKey);
      setNotes(res.notes);
      setStatuses(res.statuses);
    } catch {
      setError("Riwayat catatan gagal dimuat.");
    }
  }, [topicKey]);

  useEffect(() => {
    load();
    try {
      setAktor(window.localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // penyimpanan peramban tidak tersedia
    }
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!aktor.trim()) return setError("Isi nama analis.");
    setSaving(true);
    setError(null);
    try {
      await addSocialTopicNote({ topic_key: topicKey, topic_label: topicLabel, status, catatan, aktor: aktor.trim() });
      try {
        window.localStorage.setItem(NAME_KEY, aktor.trim());
      } catch {
        // abaikan
      }
      setCatatan("");
      await load();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Catatan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Catatan analis</h4>
      <form onSubmit={submit} className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr]">
        <label className="flex flex-col text-2xs text-zinc-500">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-0.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {Object.entries(statuses).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Nama analis
          <input
            value={aktor}
            onChange={(e) => setAktor(e.target.value)}
            maxLength={120}
            className="mt-0.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500 sm:col-span-2">
          Catatan (opsional)
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Mis. sudah dikonfirmasi ke Dinas SDA, pompa dikirim pukul 14.00"
            className="mt-0.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Menyimpan..." : "Simpan catatan"}
          </button>
          {error && <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
        </div>
      </form>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {notes.map((n) => (
            <li key={n.id} className="text-xs">
              <div className="flex flex-wrap items-center gap-2 text-2xs text-zinc-500">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${NOTE_STATUS_STYLE[n.status] ?? ""}`}>{n.status_label}</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{n.aktor}</span>
                <span className="font-mono">{formatWib(n.created_at)} WIB</span>
              </div>
              {n.catatan && <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">{n.catatan}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
