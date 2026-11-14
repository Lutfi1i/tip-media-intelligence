"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { acknowledgeAlert, AlertItem, fetchAlerts, onDataSynced } from "@/lib/api";
import { fmtRelative } from "@/lib/format";

/** Lonceng alert eksekutif: alert terkirim yang belum diakui, cek tiap 60 detik. */
export function NotificationBell({ userNama }: { userNama: string }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setAlerts(await fetchAlerts());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notifikasi gagal dimuat");
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    const off = onDataSynced(load);
    return () => {
      window.clearInterval(id);
      off();
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = alerts.filter((a) => a.status !== "diakui");

  const ack = async (a: AlertItem) => {
    setBusyId(a.id);
    try {
      const updated = await acknowledgeAlert(a.id, userNama);
      setAlerts((list) => list.map((x) => (x.id === a.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menandai notifikasi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread.length ? `Notifikasi, ${unread.length} belum diakui` : "Notifikasi"}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-3xs font-bold leading-[18px] text-white">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Alert eksekutif</span>
            <span className="text-2xs text-zinc-500">{unread.length} belum diakui</span>
          </div>
          {error && <p className="px-4 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          {alerts.length === 0 && !error ? (
            <p className="px-4 py-8 text-center text-xs text-zinc-500">
              Belum ada alert. Alert dikirim saat isu HIGH atau CRITICAL diverifikasi.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
              {alerts.slice(0, 20).map((a) => {
                const isUnread = a.status !== "diakui";
                return (
                  <li key={a.id} className={`px-4 py-3 ${isUnread ? "" : "opacity-60"}`}>
                    <div className="flex items-center justify-between gap-2 text-2xs">
                      <span
                        className={`font-bold ${
                          a.level === "CRITICAL" ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
                        }`}
                      >
                        {a.level}
                      </span>
                      <span className="text-zinc-500">{fmtRelative(a.terkirim_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs text-zinc-800 dark:text-zinc-200">{a.konten_pesan}</p>
                    <div className="mt-2 flex items-center gap-3 text-2xs font-bold">
                      <Link
                        href={`/isu/${a.issue_id}`}
                        onClick={() => setOpen(false)}
                        className="text-sky-600 hover:underline dark:text-sky-400"
                      >
                        Buka isu
                      </Link>
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={() => ack(a)}
                          disabled={busyId === a.id}
                          className="text-zinc-600 hover:underline disabled:opacity-50 dark:text-zinc-300"
                        >
                          {busyId === a.id ? "Menyimpan..." : "Tandai sudah diakui"}
                        </button>
                      ) : (
                        <span className="font-normal text-zinc-500">Sudah diakui</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
