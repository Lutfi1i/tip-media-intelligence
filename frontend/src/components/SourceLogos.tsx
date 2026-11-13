"use client";

import React from "react";

export interface BrandInfo {
  name: string;
  logo: string;
  fallbackText: string;
}

/**
 * Mendapatkan metadata logo asli resmi dari folder /logos
 */
export function getBrandInfo(platform?: string, penerbit?: string): BrandInfo {
  const norm = `${platform || ""} ${penerbit || ""}`.toLowerCase();

  // 1. X (Twitter)
  if (norm.includes("x (twitter)") || norm.includes("twitter") || norm.includes("x.com")) {
    return {
      name: "X (Twitter)",
      logo: "/logos/x.png",
      fallbackText: "X",
    };
  }

  if (norm.includes("instagram")) {
    return { name: "Instagram", logo: "/logos/instagram.svg", fallbackText: "IG" };
  }
  if (norm.includes("facebook")) {
    return { name: "Facebook", logo: "/logos/facebook.svg", fallbackText: "FB" };
  }
  if (norm.includes("reddit")) {
    return { name: "Reddit", logo: "/logos/reddit.svg", fallbackText: "RD" };
  }
  if (norm.includes("telegram") || norm.includes("t.me")) {
    return { name: "Telegram", logo: "/logos/telegram.svg", fallbackText: "TG" };
  }

  // 2. TikTok
  if (norm.includes("tiktok")) {
    return {
      name: "TikTok",
      logo: "/logos/tiktok.png",
      fallbackText: "TikTok",
    };
  }

  // 3. Threads
  if (norm.includes("threads")) {
    return {
      name: "Threads",
      logo: "/logos/threads.png",
      fallbackText: "Threads",
    };
  }

  // 4. YouTube
  if (norm.includes("youtube") || norm.includes("yt") || norm.includes("youtu.be")) {
    return {
      name: "YouTube",
      logo: "/logos/youtube.png",
      fallbackText: "YouTube",
    };
  }

  // 5. Detikcom
  if (norm.includes("detik")) {
    return {
      name: "Detikcom",
      logo: "/logos/detikcom.png",
      fallbackText: "detik",
    };
  }

  // 6. CNN Indonesia
  if (norm.includes("cnn")) {
    return {
      name: "CNN Indonesia",
      logo: "/logos/cnn.png",
      fallbackText: "CNN",
    };
  }

  // 7. ANTARA News
  if (norm.includes("antara")) {
    return {
      name: "ANTARA News",
      logo: "/logos/antara.png",
      fallbackText: "ANTARA",
    };
  }

  // 8. BMKG
  if (norm.includes("bmkg") || norm.includes("gempa")) {
    return {
      name: "BMKG",
      logo: "/logos/bmkg.png",
      fallbackText: "BMKG",
    };
  }

  // 9. Dishub DKI Jakarta
  if (norm.includes("dishub") || norm.includes("perhubungan") || norm.includes("pusdatinhub")) {
    return {
      name: "Dishub DKI Jakarta",
      logo: "/logos/dishub.png",
      fallbackText: "DISHUB",
    };
  }

  // 9. Bluesky
  if (norm.includes("bluesky") || norm.includes("bsky")) {
    return {
      name: "Bluesky",
      logo: "/logos/bluesky.svg",
      fallbackText: "BSKY",
    };
  }

  // Fallback: inisial nama, jangan meminjam logo media lain.
  const label = platform || penerbit || "Media Berita";
  return {
    name: label,
    logo: "",
    fallbackText: label.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?",
  };
}

function BrandInitials({ text }: { text: string }) {
  return (
    <span className="flex h-full w-full items-center justify-center bg-zinc-200 text-[8px] font-bold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
      {text.slice(0, 2)}
    </span>
  );
}

/**
 * Komponen Logo Asli Resmi: Seluruh icon 100% seragam bentuk rounded-full (lingkaran bulat rapi),
 * ukuran terkontrol pasti (tidak ada yang membesar), dan gambar resmi asli.
 */
export function SourceLogoBadge({
  platform,
  penerbit,
  channelType,
  showLabel = true,
  size = "md",
}: {
  platform: string;
  penerbit?: string;
  channelType?: "berita" | "sosmed";
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const brand = getBrandInfo(platform, penerbit);

  const containerSizeClass =
    size === "sm"
      ? "w-4 h-4 min-w-[16px] min-h-[16px] max-w-[16px] max-h-[16px]"
      : size === "lg"
      ? "w-6 h-6 min-w-[24px] min-h-[24px] max-w-[24px] max-h-[24px]"
      : "w-5 h-5 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px]";

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      {/* Container avatar lingkaran seragam (rounded-full) */}
      <div
        className={`${containerSizeClass} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-zinc-900 ring-1 ring-zinc-300 dark:ring-zinc-700 shadow-2xs`}
      >
        {brand.logo ? (
          <img
            src={brand.logo}
            alt={brand.name}
            className="w-full h-full object-cover rounded-full"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <BrandInitials text={brand.fallbackText} />
        )}
      </div>

      {showLabel && (
        <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs tracking-tight">
          {brand.name}
        </span>
      )}
    </div>
  );
}

/**
 * Sub-komponen icon lingkaran resmi satuan untuk filter button atau navigasi
 */
function normalizeBrandKey(name: string): string {
  const n = (name || "").toLowerCase();
  if (n === "x" || n.startsWith("x (") || n.includes("twitter")) return "x";
  if (n.includes("tiktok")) return "tiktok";
  if (n.includes("threads")) return "threads";
  if (n.includes("youtube") || n === "yt") return "youtube";
  return n;
}

export function RealBrandIcon({
  name,
  className = "w-4 h-4",
}: {
  name: "x" | "tiktok" | "threads" | "youtube" | "detik" | "cnn" | "antara" | "bmkg" | "dishub" | string;
  className?: string;
}) {
  const mapping: Record<string, string> = {
    x: "/logos/x.png",
    tiktok: "/logos/tiktok.png",
    threads: "/logos/threads.png",
    youtube: "/logos/youtube.png",
    yt: "/logos/youtube.png",
    detik: "/logos/detikcom.png",
    cnn: "/logos/cnn.png",
    antara: "/logos/antara.png",
    bmkg: "/logos/bmkg.png",
    dishub: "/logos/dishub.png",
  };

  const key = normalizeBrandKey(name);
  const src = mapping[key];

  if (!src) {
    // Tanpa logo resmi di /public/logos: tampilkan inisial, jangan meminjam logo platform lain.
    return (
      <div
        className={`${className} rounded-full shrink-0 flex items-center justify-center bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100 ring-2 ring-white dark:ring-zinc-950 text-[9px] font-bold uppercase`}
        title={name}
        aria-label={name}
      >
        {name.replace(/[^A-Za-z]/g, "").slice(0, 2) || "?"}
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-zinc-900 ring-2 ring-white dark:ring-zinc-950 shadow-xs`}
    >
      <img
        src={src}
        alt={name}
        className="w-full h-full object-cover rounded-full"
        loading="lazy"
      />
    </div>
  );
}

/**
 * Avatar Stack Komponen yang menumpuk setengah (override overlapping)
 * Menampilkan ikon-ikon media bulat bertumpuk tanpa label tulisan,
 * serta skeleton "+N" jika melebihi batas maksimal.
 */
export function MediaAvatarStack({
  sources,
  max = 3,
  size = "md",
  className = "",
}: {
  sources: string[];
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const visible = sources.slice(0, max);
  const remaining = sources.length - max;

  const sizeClass =
    size === "sm"
      ? "w-4 h-4 min-w-[16px] min-h-[16px]"
      : size === "lg"
      ? "w-6 h-6 min-w-[24px] min-h-[24px]"
      : "w-5 h-5 min-w-[20px] min-h-[20px]";

  const overlapClass =
    size === "sm" ? "-space-x-1.5" : size === "lg" ? "-space-x-2.5" : "-space-x-2";

  return (
    <div className={`inline-flex items-center ${overlapClass} ${className}`}>
      {visible.map((srcKey, idx) => {
        const brand = getBrandInfo(srcKey, srcKey);
        return (
          <div
            key={idx}
            className={`relative z-[${10 - idx}] ${sizeClass} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white dark:bg-zinc-900 ring-2 ring-white dark:ring-zinc-950 shadow-xs transition-transform hover:scale-125 hover:z-30`}
            title={brand.name}
          >
            {brand.logo ? (
              <img
                src={brand.logo}
                alt={brand.name}
                className="w-full h-full object-cover rounded-full"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <BrandInitials text={brand.fallbackText} />
            )}
          </div>
        );
      })}

      {/* Skeleton Pill +N untuk sisa media */}
      {remaining > 0 && (
        <div
          className={`relative z-[5] ${sizeClass} rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 ring-2 ring-white dark:ring-zinc-950 flex items-center justify-center font-mono font-bold text-[9px] shadow-xs select-none transition-transform hover:scale-110`}
          title={`${remaining} media lainnya`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
