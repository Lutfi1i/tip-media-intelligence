import React from "react";
import Link from "next/link";

/**
 * Radar Brand Mark: concentric scanning rings with vector beam and target blip.
 */
export function BrandMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} shrink-0`}
      fill="none"
      aria-hidden="true"
    >
      {/* Concentric rings */}
      <path
        d="M37.61 5.59 A27 27 0 1 0 57.03 21.89"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M38.64 11.55 A21.5 21.5 0 1 0 50.98 21.91"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M34.78 16.24 A16 16 0 1 0 47.04 26.53"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M34.72 21.86 A10.5 10.5 0 1 0 41.52 27.56"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.35"
      />

      {/* Vector beam and target point */}
      <path
        d="M32 32 L52.1 11.9"
        className="stroke-zinc-900 dark:stroke-zinc-100"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="52.1" cy="11.9" r="3.4" className="fill-zinc-900 dark:fill-zinc-100" />

      {/* Center blip */}
      <circle cx="32" cy="32" r="3.6" fill="currentColor" />
    </svg>
  );
}

/**
 * Brand Header Logo with Wordmark & System Status
 */
export function RadarBrand({ status = "LIVE RADAR" }: { status?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs">
        <BrandMark className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-radarblip" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white uppercase font-mono">
            TIP Media Intelligence
          </span>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700">
            {status}
          </span>
        </div>
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
          Sistem Deteksi Dini &amp; Respon Krisis Terpadu
        </p>
      </div>
    </div>
  );
}

/**
 * Verified Source Signal Badge
 */
export function SourceBadge({ source }: { source: string }) {
  const norm = (source || "").toLowerCase();
  let label = source || "Portal Berita";

  if (norm.includes("antara")) {
    label = norm.includes("metro") ? "Antara Metro" : "Antara News";
  } else if (norm.includes("detik")) {
    label = "detikcom";
  } else if (norm.includes("cnn")) {
    label = "CNN Indonesia";
  } else if (norm.includes("bmkg") || norm.includes("gempa")) {
    label = "BMKG Resmi";
  } else if (norm.includes("dishub") || norm.includes("perhubungan")) {
    label = "Dishub DKI";
  } else if (norm.includes("crm") || norm.includes("pengaduan")) {
    label = "Pengaduan Resmi";
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-semibold border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
      {label}
    </span>
  );
}

/**
 * Sentiment Tag (Positive / Neutral / Negative)
 */
export function SentimentBadge({
  sentiment,
}: {
  sentiment: string | null | undefined;
}) {
  const s = (sentiment || "netral").toLowerCase();
  if (s === "negatif" || s === "negative") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
        Negatif
      </span>
    );
  }
  if (s === "positif" || s === "positive") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
        Positif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
      Netral
    </span>
  );
}

/**
 * Threat & Risk Level Pill (CRITICAL / HIGH / MEDIUM / LOW)
 */
export function ThreatLevelPill({
  level,
  score,
}: {
  level: string;
  score?: number;
}) {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    CRITICAL: {
      bg: "bg-red-500/15",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-500/40",
    },
    HIGH: {
      bg: "bg-orange-500/15",
      text: "text-orange-600 dark:text-orange-400",
      border: "border-orange-500/40",
    },
    MEDIUM: {
      bg: "bg-amber-500/15",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/40",
    },
    LOW: {
      bg: "bg-zinc-200 dark:bg-zinc-800",
      text: "text-zinc-700 dark:text-zinc-300",
      border: "border-zinc-300 dark:border-zinc-700",
    },
  };

  const style = styles[level] || styles.LOW;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold font-mono border ${style.bg} ${style.text} ${style.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {level}
      {score !== undefined && (
        <span className="font-mono opacity-80">({score.toFixed(1)})</span>
      )}
    </span>
  );
}

/**
 * InfoTip hover helper
 */
export function InfoTip({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="group relative inline-flex align-middle cursor-help">
      <span className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs font-mono font-bold">
        [?]
      </span>
      <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-left text-xs leading-snug text-zinc-700 dark:text-zinc-300 opacity-0 shadow-2xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
        {title && (
          <span className="mb-1 block font-bold text-zinc-900 dark:text-zinc-100">{title}</span>
        )}
        {children}
      </span>
    </span>
  );
}

/**
 * Command Center KPI Card
 */
export function RadarKpiCard({
  label,
  value,
  hint,
  trend,
  trendPositive,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
  trendPositive?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="panel p-5 relative overflow-hidden group hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono">
          {label}
        </p>
        {icon && (
          <div className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white font-mono">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-bold font-mono ${
              trendPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}
