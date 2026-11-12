"use client";

import { useState } from "react";
import type { SocialBrief } from "@/lib/api";

const KIND_LABEL: Record<string, string> = {
  volume: "Volume",
  lonjakan: "Lonjakan",
  topik: "Topik",
  instansi: "Instansi",
  jangkauan: "Jangkauan",
  koordinasi: "Perlu dicek",
  catatan: "Catatan",
};

export function SocialBriefCard({ brief, isLoading }: { brief: SocialBrief | null; isLoading: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!brief) {
    return isLoading ? (
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">Menyusun ringkasan...</div>
    ) : null;
  }

  const plain = [brief.title, ...brief.points.map((p) => `- ${p.text}${p.url ? ` ${p.url}` : ""}`)].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="brief-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="brief-title" className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {brief.title}
        </h2>
        <button
          onClick={copy}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {copied ? "Tersalin" : "Salin ringkasan"}
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {brief.points.map((p, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <span className="mt-0.5 w-24 shrink-0 text-2xs font-semibold uppercase tracking-wider text-zinc-500">{KIND_LABEL[p.kind] ?? p.kind}</span>
            <span className="min-w-0">
              {p.text}
              {p.url && (
                <>
                  {" "}
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-fuchsia-600 hover:underline dark:text-fuchsia-400">
                    Buka
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
