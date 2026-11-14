"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search } from "lucide-react";
import { IssueSearchHit, searchIssuesFulltext } from "@/lib/api";
import { ThreatLevelPill } from "./RadarUi";

type Result =
  | { kind: "page"; label: string; href: string }
  | { kind: "issue"; hit: IssueSearchHit; href: string };

/**
 * Palet pencarian global: Ctrl+K / Cmd+K dari halaman mana pun.
 * Mencari halaman menu dan isu (fulltext di backend).
 */
export function GlobalSearch({
  open,
  onClose,
  pages,
}: {
  open: boolean;
  onClose: () => void;
  pages: { label: string; href: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<IssueSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setHits([]);
    setError(null);
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const id = window.setTimeout(() => {
      searchIssuesFulltext(term)
        .then((r) => {
          if (cancelled) return;
          setHits(r);
          setError(null);
        })
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Pencarian gagal"))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [q]);

  const term = q.trim().toLowerCase();
  const pageResults: Result[] = pages
    .filter((p) => !term || p.label.toLowerCase().includes(term))
    .map((p) => ({ kind: "page", label: p.label, href: p.href }));
  const issueResults: Result[] = hits.map((h) => ({ kind: "issue", hit: h, href: `/isu/${h.id}` }));
  const results = [...issueResults, ...pageResults];

  useEffect(() => {
    setActive(0);
  }, [q, hits.length]);

  const go = (r: Result) => {
    onClose();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cari isu, wilayah, kategori, atau halaman..."
            aria-label="Kata kunci pencarian"
            className="h-12 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100"
          />
          <kbd className="hidden rounded border border-zinc-300 px-1.5 text-3xs text-zinc-500 sm:inline dark:border-zinc-700">Esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {error && <p className="px-4 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          {searching && issueResults.length === 0 && <p className="px-4 py-2 text-xs text-zinc-500">Mencari isu...</p>}
          {!searching && term.length >= 2 && issueResults.length === 0 && !error && (
            <p className="px-4 py-2 text-xs text-zinc-500">Tidak ada isu yang cocok dengan &ldquo;{q.trim()}&rdquo;.</p>
          )}

          {results.length > 0 && (
            <ul role="listbox" aria-label="Hasil pencarian">
              {results.map((r, i) => {
                const isActive = i === active;
                const showHeader =
                  i === 0 || results[i - 1].kind !== r.kind;
                return (
                  <li key={r.href} role="option" aria-selected={isActive}>
                    {showHeader && (
                      <div className="px-4 pb-1 pt-2 text-3xs font-bold uppercase tracking-wider text-zinc-400">
                        {r.kind === "issue" ? "Isu" : "Halaman"}
                      </div>
                    )}
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left ${
                        isActive ? "bg-zinc-100 dark:bg-zinc-900" : ""
                      }`}
                    >
                      {r.kind === "issue" ? (
                        <>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {r.hit.judul}
                            </span>
                            <span className="block text-2xs text-zinc-500 dark:text-zinc-400">
                              {r.hit.kode_referensi} &bull; {r.hit.wilayah} &bull; {r.hit.kategori}
                            </span>
                          </span>
                          <ThreatLevelPill level={r.hit.level} score={r.hit.skor} />
                        </>
                      ) : (
                        <span className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                          <FileText className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                          {r.label}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden border-t border-zinc-200 px-4 py-2 text-3xs text-zinc-500 sm:block dark:border-zinc-800">
          &uarr; &darr; pilih &bull; Enter buka &bull; Esc tutup
        </div>
      </div>
    </div>
  );
}
