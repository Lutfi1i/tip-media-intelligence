"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  addSocialWatchedAccount,
  deleteSocialWatchedAccount,
  fetchSocialWatchedAccounts,
  SocialSampleMention,
  SocialWatchedAccounts as Data,
} from "@/lib/api";
import { Sparkline, formatWib } from "@/components/SocialCharts";
import { ConfirmDialog } from "@/components/ui";

const NAME_KEY = "tip.analystName";
const inputCls =
  "mt-0.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function PostList({ title, items, empty }: { title: string; items: SocialSampleMention[]; empty: string }) {
  return (
    <div>
      <h4 className="text-2xs font-bold uppercase tracking-wider text-zinc-500">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-1 text-2xs text-zinc-400">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((m) => (
            <li key={m.id} className="text-xs text-zinc-700 [overflow-wrap:anywhere] dark:text-zinc-300">
              <span className="font-mono text-2xs text-zinc-500">{formatWib(m.published_at)}</span>{" "}
              {m.url ? (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{m.judul}</a>
              ) : (
                m.judul
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SocialWatchedAccounts({
  timeRange,
  scopeKode,
  scopeMode,
  multiCodes,
}: {
  timeRange: string;
  scopeKode: string;
  scopeMode: string;
  multiCodes?: string;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [handle, setHandle] = useState("");
  const [label, setLabel] = useState("");
  const [kelompok, setKelompok] = useState("lainnya");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: number; handle: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchSocialWatchedAccounts(timeRange, scopeKode, scopeMode, multiCodes));
    } catch {
      setError("Akun pantauan gagal dimuat.");
    }
  }, [timeRange, scopeKode, scopeMode, multiCodes]);

  useEffect(() => {
    load();
  }, [load]);

  const analyst = () => {
    try {
      return window.localStorage.getItem(NAME_KEY) || "Analis";
    } catch {
      return "Analis";
    }
  };

  const add = async (h: string, l?: string, k = kelompok) => {
    setBusy(true);
    setError(null);
    try {
      await addSocialWatchedAccount({ handle: h, label: l || undefined, kelompok: k, dibuat_oleh: analyst() });
      setHandle("");
      setLabel("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Akun gagal ditambahkan.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (handle.trim()) add(handle.trim(), label.trim());
  };

  const remove = (id: number, h: string) => setPendingRemove({ id, handle: h });

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await deleteSocialWatchedAccount(pendingRemove.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Akun gagal dihapus.");
    } finally {
      setRemoving(false);
      setPendingRemove(null);
    }
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!pendingRemove}
        title={`Berhenti memantau @${pendingRemove?.handle ?? ""}?`}
        description="Akun dihapus dari daftar pantauan. Konten yang sudah terkumpul tetap tersimpan."
        confirmLabel="Ya, berhenti memantau"
        busy={removing}
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
      />
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Akun Pantauan</h2>
        <p className="max-w-3xl text-xs text-zinc-500 dark:text-zinc-400">
          Pantau akun tertentu: berapa kali akun itu memposting, berapa kali akun lain menyebut @akun itu, dan nada sebutannya. Hanya mencakup
          konten yang dikumpulkan dari sumber terdaftar{data ? `, ${data.period.label}` : ""}.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="flex flex-col text-2xs text-zinc-500">
          Akun (@nama atau URL profil)
          <input value={handle} onChange={(e) => setHandle(e.target.value)} required placeholder="@TMCPoldaMetro" className={inputCls} />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Nama tampilan (opsional)
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="TMC Polda Metro Jaya" className={inputCls} />
        </label>
        <label className="flex flex-col text-2xs text-zinc-500">
          Kelompok
          <select value={kelompok} onChange={(e) => setKelompok(e.target.value)} className={inputCls}>
            {Object.entries(data?.groups ?? { lainnya: "Lainnya" }).map(([id, l]) => (
              <option key={id} value={id}>{l}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy} className="rounded-lg bg-fuchsia-600 px-4 py-2 text-xs font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50">
          Pantau akun
        </button>
        {error && <span role="alert" className="w-full text-xs text-rose-600 dark:text-rose-400">{error}</span>}
      </form>

      {data && data.suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500">Akun paling aktif yang belum dipantau:</span>
          {data.suggestions.map((s) => (
            <button
              key={s.handle_norm}
              onClick={() => add(s.handle_norm, undefined, "lainnya")}
              disabled={busy}
              title={`${s.posts} konten pada periode ini. Klik untuk memantau.`}
              className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700 hover:bg-fuchsia-100 hover:text-fuchsia-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-fuchsia-950"
            >
              + {s.handle} ({s.posts})
            </button>
          ))}
        </div>
      )}

      {data && data.accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Belum ada akun yang dipantau.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.accounts.map((a) => (
            <article key={a.id} className="min-w-0 space-y-3 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100">@{a.handle}</h3>
                  <p className="text-2xs text-zinc-500">
                    {a.label ? `${a.label} · ` : ""}
                    {a.kelompok_label} · ditambahkan oleh {a.dibuat_oleh}
                  </p>
                </div>
                <button onClick={() => remove(a.id, a.handle)} className="text-2xs font-semibold text-rose-700 hover:underline dark:text-rose-400">
                  Berhenti pantau
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span><strong className="font-mono text-base text-zinc-900 dark:text-zinc-100">{a.posts}</strong> postingan</span>
                <span><strong className="font-mono text-base text-zinc-900 dark:text-zinc-100">{a.mentions}</strong> disebut</span>
                {a.mention_sentiment && <span className="text-zinc-500">sebutan negatif {a.mention_sentiment.negatif}%</span>}
                <Sparkline data={a.timeline} label={`Aktivitas @${a.handle}`} />
              </div>
              <p className="text-2xs text-zinc-500">
                {a.last_post_at ? `Postingan terakhir ${formatWib(a.last_post_at)} WIB` : "Tidak ada postingan dari akun ini pada periode ini"}
                {a.platforms.length > 0 && ` · ${a.platforms.join(", ")}`}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                <PostList title="Postingan terbaru" items={a.latest_posts} empty="Tidak ada." />
                <PostList title="Disebut oleh akun lain" items={a.top_mentions} empty="Tidak ada." />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
