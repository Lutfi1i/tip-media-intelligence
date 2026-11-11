"use client";

import { useEffect, useRef, ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw, X } from "lucide-react";

export type Level = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const LEVEL_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-900 border-red-300",
  HIGH: "bg-orange-100 text-orange-900 border-orange-300",
  MEDIUM: "bg-blue-100 text-blue-900 border-blue-300",
  LOW: "bg-slate-100 text-slate-700 border-slate-300",
};

export function LevelBadge({
  level,
  score,
}: {
  level: string;
  score?: number | null;
}) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded border tracking-wide ${
        LEVEL_STYLE[level] || LEVEL_STYLE.LOW
      }`}
    >
      {level || "—"}
      {score !== null && score !== undefined && (
        <span className="ml-1 font-mono font-semibold opacity-80">{score.toFixed(0)}</span>
      )}
    </span>
  );
}

const ISSUE_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  kandidat: { label: "Kandidat", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  terverifikasi: { label: "Terverifikasi", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  dikoreksi: { label: "Dikoreksi", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  ditolak: { label: "Ditolak", cls: "bg-red-100 text-red-800 border-red-300" },
  selesai: { label: "Selesai", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
};

export function IssueStatusBadge({ status }: { status: string }) {
  const s = ISSUE_STATUS_STYLE[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-300" };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}

const CASE_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  menunggu: { label: "Menunggu", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  ditangani: { label: "Ditangani", cls: "bg-blue-100 text-blue-900 border-blue-300" },
  selesai: { label: "Selesai", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
};

export function CaseStatusBadge({ status }: { status: string }) {
  const s = CASE_STATUS_STYLE[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-300" };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function Spinner({ label = "Memuat data..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
      <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" aria-hidden="true" />
      <p className="text-sm text-slate-500 font-medium">{label}</p>
    </div>
  );
}

export function ErrorPanel({
  message,
  onRetry,
  hint,
  title = "Data gagal dimuat",
  backHref,
  backLabel = "Kembali",
}: {
  message: string;
  onRetry?: () => void;
  hint?: string;
  title?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-lg mx-auto my-12">
      <AlertCircle className="w-9 h-9 text-red-600 mx-auto mb-3" aria-hidden="true" />
      <h2 className="text-base font-bold text-red-900 mb-1">{title}</h2>
      <p className="text-sm text-red-700">{message}</p>
      {hint && <p className="text-xs text-red-600 mt-2">{hint}</p>}
      <div className="mt-4 flex items-center justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Coba lagi
          </button>
        )}
        {backHref && (
          <a
            href={backHref}
            className="inline-flex items-center px-4 py-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 text-sm font-semibold rounded-md transition-colors"
          >
            {backLabel}
          </a>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <Inbox className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Notifikasi ringkas di dalam halaman — pengganti window.alert(). */
export function Notice({
  tone,
  message,
  children,
  onClose,
  onDismiss,
  onRetry,
}: {
  tone: "success" | "error" | "info";
  message?: string;
  children?: ReactNode;
  onClose?: () => void;
  onDismiss?: () => void;
  onRetry?: () => void;
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : tone === "error"
        ? "bg-red-50 border-red-200 text-red-900"
        : "bg-blue-50 border-blue-200 text-blue-900";
  const close = onClose || onDismiss;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start justify-between gap-3 border rounded-md px-3 py-2 text-xs font-medium ${cls}`}
    >
      <span className="flex-1">{children ?? message}</span>
      <span className="flex shrink-0 items-center gap-2">
        {onRetry && (
          <button onClick={onRetry} className="underline underline-offset-2 hover:opacity-80">
            Muat ulang
          </button>
        )}
        {close && (
          <button onClick={close} aria-label="Tutup notifikasi" className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  );
}

/** Modal aksesibel: Escape menutup, fokus pindah ke panel, klik backdrop menutup. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-200 outline-none max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">{footer}</div>}
      </div>
    </div>
  );
}
