"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  fetchIndonesiaGeo,
  fetchRegionalDetail,
  IndonesiaGeoOverview,
  JabodetabekRegionGeo,
  ProvinceGeo,
} from "@/lib/api";
import {
  MapPin,
  Search,
  ExternalLink,
  Flame,
  Radio,
  Zap,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { ThreatLevelPill, SentimentBadge } from "./RadarUi";

// Pixel dot matrix representation of the Indonesian Archipelago
// Calibrated from the uploaded Indonesia silhouette (Sumatera, Jawa, Kalimantan, Sulawesi, Bali-Nusa, Maluku, Papua)
interface PixelDot {
  id: string;
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  regionCode: string;
  regionName: string;
  island: string;
  isFocus: boolean;
}

const INDONESIA_PIXEL_GRID: PixelDot[] = [
  // --- SUMATERA (Top Left to South East) ---
  { id: "sm-1", x: 7, y: 15, regionCode: "11", regionName: "Aceh", island: "Sumatera", isFocus: false },
  { id: "sm-2", x: 9, y: 20, regionCode: "11", regionName: "Aceh", island: "Sumatera", isFocus: false },
  { id: "sm-3", x: 12, y: 24, regionCode: "12", regionName: "Sumatera Utara", island: "Sumatera", isFocus: false },
  { id: "sm-4", x: 14, y: 29, regionCode: "12", regionName: "Sumatera Utara", island: "Sumatera", isFocus: false },
  { id: "sm-5", x: 15, y: 36, regionCode: "13", regionName: "Sumatera Barat", island: "Sumatera", isFocus: false },
  { id: "sm-6", x: 18, y: 34, regionCode: "14", regionName: "Riau", island: "Sumatera", isFocus: false },
  { id: "sm-7", x: 21, y: 38, regionCode: "14", regionName: "Riau", island: "Sumatera", isFocus: false },
  { id: "sm-8", x: 24, y: 32, regionCode: "21", regionName: "Kepulauan Riau", island: "Sumatera", isFocus: false },
  { id: "sm-9", x: 20, y: 44, regionCode: "15", regionName: "Jambi", island: "Sumatera", isFocus: false },
  { id: "sm-10", x: 23, y: 48, regionCode: "16", regionName: "Sumatera Selatan", island: "Sumatera", isFocus: false },
  { id: "sm-11", x: 19, y: 52, regionCode: "17", regionName: "Bengkulu", island: "Sumatera", isFocus: false },
  { id: "sm-12", x: 27, y: 45, regionCode: "19", regionName: "Bangka Belitung", island: "Sumatera", isFocus: false },
  { id: "sm-13", x: 24, y: 56, regionCode: "18", regionName: "Lampung", island: "Sumatera", isFocus: false },

  // --- JAWA & JABODETABEK (The Core Pilot Focus) ---
  { id: "jw-1", x: 27, y: 64, regionCode: "36.03", regionName: "Kabupaten Tangerang", island: "Jawa", isFocus: true },
  { id: "jw-2", x: 28.5, y: 63, regionCode: "36.71", regionName: "Kota Tangerang", island: "Jawa", isFocus: true },
  { id: "jw-3", x: 29.5, y: 65, regionCode: "36.74", regionName: "Tangerang Selatan", island: "Jawa", isFocus: true },
  { id: "jw-4", x: 30, y: 62.5, regionCode: "31.71", regionName: "Jakarta Pusat", island: "Jawa", isFocus: true },
  { id: "jw-5", x: 30.5, y: 61.5, regionCode: "31.72", regionName: "Jakarta Utara", island: "Jawa", isFocus: true },
  { id: "jw-6", x: 29.5, y: 63.2, regionCode: "31.73", regionName: "Jakarta Barat", island: "Jawa", isFocus: true },
  { id: "jw-7", x: 30.2, y: 64.5, regionCode: "31.74", regionName: "Jakarta Selatan", island: "Jawa", isFocus: true },
  { id: "jw-8", x: 31.2, y: 63.8, regionCode: "31.75", regionName: "Jakarta Timur", island: "Jawa", isFocus: true },
  { id: "jw-9", x: 30.5, y: 67, regionCode: "32.76", regionName: "Kota Depok", island: "Jawa", isFocus: true },
  { id: "jw-10", x: 31, y: 69, regionCode: "32.71", regionName: "Kota Bogor", island: "Jawa", isFocus: true },
  { id: "jw-11", x: 32, y: 69.5, regionCode: "32.01", regionName: "Kabupaten Bogor", island: "Jawa", isFocus: true },
  { id: "jw-12", x: 32.5, y: 64, regionCode: "32.75", regionName: "Kota Bekasi", island: "Jawa", isFocus: true },
  { id: "jw-13", x: 34, y: 64.5, regionCode: "32.16", regionName: "Kabupaten Bekasi", island: "Jawa", isFocus: true },
  { id: "jw-14", x: 37, y: 66, regionCode: "32", regionName: "Jawa Barat (Priangan)", island: "Jawa", isFocus: false },
  { id: "jw-15", x: 41, y: 67, regionCode: "33", regionName: "Jawa Tengah", island: "Jawa", isFocus: false },
  { id: "jw-16", x: 42, y: 70, regionCode: "34", regionName: "DI Yogyakarta", island: "Jawa", isFocus: false },
  { id: "jw-17", x: 45, y: 67, regionCode: "35", regionName: "Jawa Timur", island: "Jawa", isFocus: false },
  { id: "jw-18", x: 48, y: 66, regionCode: "35", regionName: "Surabaya & Sekitarnya", island: "Jawa", isFocus: false },

  // --- BALI & NUSA TENGGARA ---
  { id: "bl-1", x: 52, y: 69, regionCode: "51", regionName: "Bali", island: "Nusa Tenggara", isFocus: false },
  { id: "bl-2", x: 55, y: 70, regionCode: "52", regionName: "Nusa Tenggara Barat", island: "Nusa Tenggara", isFocus: false },
  { id: "bl-3", x: 58, y: 71, regionCode: "53", regionName: "Nusa Tenggara Timur", island: "Nusa Tenggara", isFocus: false },
  { id: "bl-4", x: 62, y: 72, regionCode: "53", regionName: "Kupang / Timor", island: "Nusa Tenggara", isFocus: false },

  // --- KALIMANTAN (Center Top) ---
  { id: "kl-1", x: 35, y: 40, regionCode: "61", regionName: "Kalimantan Barat", island: "Kalimantan", isFocus: false },
  { id: "kl-2", x: 37, y: 45, regionCode: "61", regionName: "Pontianak", island: "Kalimantan", isFocus: false },
  { id: "kl-3", x: 41, y: 46, regionCode: "62", regionName: "Kalimantan Tengah", island: "Kalimantan", isFocus: false },
  { id: "kl-4", x: 44, y: 51, regionCode: "63", regionName: "Kalimantan Selatan", island: "Kalimantan", isFocus: false },
  { id: "kl-5", x: 46, y: 41, regionCode: "64", regionName: "Kalimantan Timur", island: "Kalimantan", isFocus: false },
  { id: "kl-6", x: 47, y: 32, regionCode: "65", regionName: "Kalimantan Utara", island: "Kalimantan", isFocus: false },

  // --- SULAWESI (Center East K-shape) ---
  { id: "sl-1", x: 53, y: 56, regionCode: "73", regionName: "Sulawesi Selatan", island: "Sulawesi", isFocus: false },
  { id: "sl-2", x: 52, y: 48, regionCode: "76", regionName: "Sulawesi Barat", island: "Sulawesi", isFocus: false },
  { id: "sl-3", x: 55, y: 44, regionCode: "72", regionName: "Sulawesi Tengah", island: "Sulawesi", isFocus: false },
  { id: "sl-4", x: 58, y: 54, regionCode: "74", regionName: "Sulawesi Tenggara", island: "Sulawesi", isFocus: false },
  { id: "sl-5", x: 58, y: 38, regionCode: "75", regionName: "Gorontalo", island: "Sulawesi", isFocus: false },
  { id: "sl-6", x: 62, y: 34, regionCode: "71", regionName: "Sulawesi Utara", island: "Sulawesi", isFocus: false },

  // --- MALUKU ---
  { id: "ml-1", x: 67, y: 41, regionCode: "82", regionName: "Maluku Utara", island: "Maluku", isFocus: false },
  { id: "ml-2", x: 68, y: 53, regionCode: "81", regionName: "Maluku (Ambon)", island: "Maluku", isFocus: false },
  { id: "ml-3", x: 74, y: 58, regionCode: "81", regionName: "Kepulauan Aru", island: "Maluku", isFocus: false },

  // --- PAPUA (Far East) ---
  { id: "pp-1", x: 76, y: 46, regionCode: "96", regionName: "Papua Barat Daya", island: "Papua", isFocus: false },
  { id: "pp-2", x: 79, y: 48, regionCode: "91", regionName: "Papua Barat", island: "Papua", isFocus: false },
  { id: "pp-3", x: 84, y: 48, regionCode: "92", regionName: "Papua (Jayapura)", island: "Papua", isFocus: false },
  { id: "pp-4", x: 83, y: 54, regionCode: "94", regionName: "Papua Tengah", island: "Papua", isFocus: false },
  { id: "pp-5", x: 87, y: 55, regionCode: "95", regionName: "Papua Pegunungan", island: "Papua", isFocus: false },
  { id: "pp-6", x: 91, y: 62, regionCode: "93", regionName: "Papua Selatan (Merauke)", island: "Papua", isFocus: false },
];

export function IndonesiaMap() {
  const [geoData, setGeoData] = useState<IndonesiaGeoOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("31.74"); // Jakarta Selatan
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIsland, setFilterIsland] = useState<string>("ALL");

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchIndonesiaGeo();
        setGeoData(data);
      } catch (err) {
        console.error("Gagal memuat peta:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function loadDetail() {
      if (!selectedRegionCode) return;
      setLoadingDetail(true);
      try {
        const detail = await fetchRegionalDetail(selectedRegionCode);
        setSelectedDetail(detail);
      } catch (err) {
        console.error("Gagal memuat detail wilayah:", err);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [selectedRegionCode]);

  // Map region codes to their threat level and heatmap intensity from backend
  const regionHeatMap = useMemo(() => {
    const map = new Map<string, { heat: number; threat: string; mentions: number }>();
    if (!geoData) return map;

    geoData.jabodetabek_regions.forEach((r) => {
      map.set(r.kode, {
        heat: r.heat_intensity,
        threat: r.threat_level,
        mentions: r.mention_count,
      });
    });

    return map;
  }, [geoData]);

  // Filtered Jabodetabek cards
  const filteredJabodetabek = (geoData?.jabodetabek_regions || []).filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.nama.toLowerCase().includes(q) ||
      r.provinsi.toLowerCase().includes(q) ||
      r.kode.includes(q)
    );
  });

  const activeRegion = geoData?.jabodetabek_regions.find(
    (r) => r.kode === selectedRegionCode
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Heat Indicator Legend */}
      <div className="panel p-4 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-500">
            <Flame className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-900 dark:text-white">
              PIXEL RADAR NUSANTARA &amp; HEATMAP KABUPATEN
            </h2>
            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              Piksel merah membara = konsentrasi isu &amp; anomali tertinggi
            </p>
          </div>
        </div>

        {/* Heat Intensity Scale Legend */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-red-500 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/80 animate-ping" />
            Kritis / Isu Kuat
          </span>
          <span className="flex items-center gap-1.5 text-amber-500 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Waspada
          </span>
          <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Kondusif
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-800" />
            Fase 2
          </span>
        </div>
      </div>

      {/* Main Pixel Canvas Section (12 cols) */}
      <div className="panel p-6 bg-white dark:bg-[#06080F] border border-zinc-200 dark:border-zinc-800/80 relative overflow-hidden">
        {/* Radar Scanning Line Effect Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-200 dark:border-zinc-800/80 relative z-10">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-500 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              PETA PIXEL KEPULAUAN INDONESIA (KLIK PIXEL UNTUK MEMBUKA ISU WILAYAH)
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-zinc-400 text-[11px]">Filter Pulau:</span>
            {["ALL", "Jawa", "Sumatera", "Kalimantan", "Sulawesi", "Papua"].map((isl) => (
              <button
                key={isl}
                type="button"
                onClick={() => setFilterIsland(isl)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  filterIsland === isl
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-xs"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                {isl}
              </button>
            ))}
          </div>
        </div>

        {/* Pixel Dot Matrix Interactive Canvas */}
        <div className="relative w-full aspect-[21/9] min-h-[320px] max-h-[480px] bg-zinc-50/50 dark:bg-[#03050A] rounded-xl border border-zinc-200/80 dark:border-zinc-800/60 p-4 select-none flex items-center justify-center">
          {/* Subtle Silhouette Background Reference */}
          <div className="absolute inset-x-8 inset-y-6 opacity-10 dark:opacity-20 pointer-events-none flex items-center justify-center">
            <svg viewBox="0 0 1000 420" className="w-full h-full stroke-zinc-400 dark:stroke-zinc-600 fill-none" strokeWidth="1.5">
              {/* Outer archipelago boundary guideline */}
              <path d="M 60 120 Q 250 250 300 300 L 480 320 L 620 330 M 340 180 L 480 180 L 480 250 M 520 200 L 620 180 L 600 280 M 740 220 L 920 240 L 930 320" />
            </svg>
          </div>

          {/* Render Interactive Pixels */}
          {INDONESIA_PIXEL_GRID.filter((p) => filterIsland === "ALL" || p.island === filterIsland).map((dot) => {
            const isSelected = selectedRegionCode === dot.regionCode;
            const heatInfo = regionHeatMap.get(dot.regionCode);
            const threat = heatInfo?.threat || (dot.isFocus ? "waspada" : "none");
            const mentions = heatInfo?.mentions || 0;

            // Pixel Heat Styles
            let pixelBg = "bg-zinc-300 dark:bg-zinc-800 hover:bg-zinc-400";
            let pixelRing = "ring-0";
            let pixelGlow = "";

            if (dot.isFocus) {
              if (threat === "kritis" || mentions >= 10) {
                // Yang paling merah isu-isunya memang paling kuat!
                pixelBg = "bg-red-500 shadow-md shadow-red-500/80";
                pixelRing = "ring-4 ring-red-500/30 animate-pulse";
                pixelGlow = "hover:scale-150 transition-transform";
              } else if (threat === "tinggi" || mentions >= 5) {
                pixelBg = "bg-orange-500 shadow-md shadow-orange-500/60";
                pixelRing = "ring-2 ring-orange-500/30";
                pixelGlow = "hover:scale-150 transition-transform";
              } else if (threat === "waspada" || mentions >= 1) {
                pixelBg = "bg-amber-400 shadow-sm shadow-amber-400/50";
                pixelGlow = "hover:scale-150 transition-transform";
              } else {
                pixelBg = "bg-emerald-500 shadow-sm shadow-emerald-500/40";
                pixelGlow = "hover:scale-150 transition-transform";
              }
            }

            return (
              <div
                key={dot.id}
                style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                onClick={() => setSelectedRegionCode(dot.regionCode)}
              >
                {/* Pixel Dot */}
                <div
                  className={`w-3.5 h-3.5 rounded-sm transition-all duration-200 ${pixelBg} ${pixelRing} ${pixelGlow} ${
                    isSelected ? "ring-4 ring-white dark:ring-sky-400 scale-125 z-30" : "z-10"
                  }`}
                />

                {/* Tactical Pixel Tooltip on Hover */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded-md bg-zinc-900/95 dark:bg-black/95 text-white border border-zinc-700 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-40 text-center font-mono">
                  <div className="text-[11px] font-bold text-white truncate">
                    {dot.regionName}
                  </div>
                  <div className="text-[9px] text-zinc-400">
                    {dot.island} · Kode {dot.regionCode}
                  </div>
                  {dot.isFocus && (
                    <div className="mt-1 pt-1 border-t border-zinc-800 text-[10px] flex items-center justify-between text-zinc-300">
                      <span>Laporan: {mentions}</span>
                      <span className={`font-bold ${threat === "kritis" ? "text-red-400" : "text-amber-400"}`}>
                        {threat.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Grid: Kabupaten Heatmap List + Active Region Drill-Down */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Full Kabupaten & Kota Selector (7 cols) */}
        <div className="lg:col-span-7 panel p-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-800 dark:text-zinc-200">
                PILIH WILAYAH KABUPATEN / KOTA (HEATMAP LIVE)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              {filteredJabodetabek.length} WILAYAH
            </span>
          </div>

          <div className="space-y-4">
            {/* Search Input for fast filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari Kabupaten / Kota (contoh: Jakarta Selatan, Depok, Bogor, Tangerang, Bekasi)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-mono rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Kabupaten Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredJabodetabek.map((reg) => {
                const isSelected = selectedRegionCode === reg.kode;
                const isCritical = reg.threat_level === "kritis";
                const isHigh = reg.threat_level === "tinggi";

                return (
                  <button
                    key={reg.kode}
                    type="button"
                    onClick={() => setSelectedRegionCode(reg.kode)}
                    className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-900 shadow-md ring-2 ring-zinc-900 dark:ring-white"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {reg.kode} · {reg.jenis}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                          {reg.nama}
                        </h4>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {reg.provinsi}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isCritical
                            ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 animate-pulse"
                            : isHigh
                            ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                            : reg.threat_level === "waspada"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {reg.threat_level.toUpperCase()}
                      </span>
                    </div>

                    {/* Glowing Heat Bar */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="text-zinc-600 dark:text-zinc-400 font-bold">
                          {reg.mention_count} Laporan
                        </span>
                        <span className="text-zinc-500">
                          {reg.dominant_topic}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCritical
                              ? "bg-red-500 shadow-sm shadow-red-500/80"
                              : isHigh
                              ? "bg-orange-500"
                              : "bg-amber-400"
                          }`}
                          style={{
                            width: `${Math.max(15, reg.heat_intensity * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Deep Regional Drill-Down Inspector (5 cols) */}
        <div className="lg:col-span-5 panel p-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                DETAIL LAPORAN WILAYAH
              </h3>
            </div>
            {activeRegion && (
              <span className="text-xs font-mono font-black text-zinc-900 dark:text-white">
                {activeRegion.nama}
              </span>
            )}
          </div>

          {loadingDetail ? (
            <div className="py-12 text-center text-xs font-mono text-zinc-400 animate-pulse">
              Mengambil data intelijen wilayah...
            </div>
          ) : selectedDetail ? (
            <div className="space-y-4">
              {/* Regional KPI Summary Bar */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-400 block text-[10px]">TOTAL ARTIKEL</span>
                  <span className="text-lg font-black text-zinc-900 dark:text-white">
                    {selectedDetail.total_articles}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-400 block text-[10px]">ISU AKTIF</span>
                  <span className="text-lg font-black text-zinc-900 dark:text-white">
                    {selectedDetail.total_issues}
                  </span>
                </div>
              </div>

              {/* Matched Priority Issues for that region */}
              <div>
                <h4 className="text-[11px] font-mono font-bold uppercase text-zinc-500 mb-2">
                  Isu Terkait di Wilayah Ini:
                </h4>
                {selectedDetail.issues.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDetail.issues.map((iss: any) => (
                      <div
                        key={iss.id}
                        className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {iss.judul}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 uppercase">
                            {iss.tingkat_bahaya}
                          </span>
                        </div>
                        <p className="text-zinc-500 text-[11px] line-clamp-2">
                          {iss.ringkasan || "Laporan terverifikasi dalam pengawasan pimpinan."}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-mono text-zinc-400 italic">
                    Belum ada eskalasi isu prioritas di wilayah ini saat ini.
                  </p>
                )}
              </div>

              {/* Recent Real News in Region */}
              <div className="pt-2">
                <h4 className="text-[11px] font-mono font-bold uppercase text-zinc-500 mb-2">
                  Laporan Berita Nyata Terkini:
                </h4>
                {selectedDetail.recent_articles.length > 0 ? (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {selectedDetail.recent_articles.map((art: any) => (
                      <div
                        key={art.id}
                        className="p-2.5 rounded border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                          <span>{art.penerbit}</span>
                          <SentimentBadge sentiment={art.sentimen} />
                        </div>
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-baseline gap-1"
                        >
                          <span className="line-clamp-2">{art.judul}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-mono text-zinc-400 italic">
                    Belum ada artikel berita spesifik untuk wilayah ini dalam 24 jam terakhir.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs font-mono text-zinc-400">
              Pilih salah satu Kota atau Kabupaten di peta sebelah kiri.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
