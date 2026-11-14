"use client";

import { useEffect, useRef, ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw, X } from "lucide-react";

export type Level = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const LEVEL_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-900 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40",
  HIGH: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40",
  MEDIUM: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40",
  LOW: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40",
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
      {level || "-"}
      {score !== null && score !== undefined && (
        <span className="ml-1 font-mono font-semibold opacity-80">{score.toFixed(0)}</span>
      )}
    </span>
  );
}

const ISSUE_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  otomatis: { label: "Belum ditinjau", cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40" },
  kandidat: { label: "Kandidat", cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40" },
  terverifikasi: { label: "Terverifikasi", cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40" },
  dikoreksi: { label: "Dikoreksi", cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40" },
  ditolak: { label: "Ditolak", cls: "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40" },
  selesai: { label: "Selesai", cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40" },
};

export function IssueStatusBadge({ status }: { status: string }) {
  const s = ISSUE_STATUS_STYLE[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40" };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}

const CASE_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  menunggu: { label: "Menunggu", cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40" },
  ditangani: { label: "Ditangani", cls: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40" },
  selesai: { label: "Selesai", cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40" },
};

export function CaseStatusBadge({ status }: { status: string }) {
  const s = CASE_STATUS_STYLE[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/40" };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function Spinner({ label = "Memuat data..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
      <RefreshCw className="w-7 h-7 text-sky-600 dark:text-sky-400 animate-spin" aria-hidden="true" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{label}</p>
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
    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-6 text-center max-w-lg mx-auto my-12">
      <AlertCircle className="w-9 h-9 text-red-600 dark:text-red-400 mx-auto mb-3" aria-hidden="true" />
      <h2 className="text-base font-bold text-red-900 dark:text-red-200 mb-1">{title}</h2>
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
      {hint && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{hint}</p>}
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
            className="inline-flex items-center px-4 py-2 bg-white dark:bg-transparent border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-semibold rounded-md transition-colors"
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
      <Inbox className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-2" aria-hidden="true" />
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</p>
      {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Notifikasi ringkas di dalam halaman: pengganti window.alert(). */
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
      ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200"
      : tone === "error"
        ? "bg-red-50 border-red-200 text-red-900 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
        : "bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-200";
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
  // onClose biasanya fungsi inline yang berganti tiap render; simpan di ref
  // agar efek di bawah hanya jalan saat modal dibuka, bukan setiap ketikan.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-zinc-950 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 outline-none max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
            {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 rounded-b-lg">{footer}</div>}
      </div>
    </div>
  );
}

/** Dialog konfirmasi pengganti window.confirm(). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={children ? description : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[36px] px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[36px] px-4 py-2 rounded-md text-xs font-bold text-white disabled:opacity-50 ${
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            }`}
          >
            {busy ? "Memproses..." : confirmLabel}
          </button>
        </div>
      }
    >
      {children ?? <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
    </Modal>
  );
}
