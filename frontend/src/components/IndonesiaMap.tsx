"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  fetchIndonesiaGeo,
  fetchRegionalDetail,
  IndonesiaGeoOverview,
  RegionalDetailResponse,
  MediaItem,
  RegionMatchedIssue,
} from "@/lib/api";
import {
  MapPin,
  Search,
  ExternalLink,
  Flame,
  Radio,
  Crosshair,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Share2,
  Newspaper,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { SentimentBadge } from "./RadarUi";
import { SourceLogoBadge, RealBrandIcon } from "./SourceLogos";
import {
  INDONESIA_PROVINCES,
  INDONESIA_HEAT_NODES,
  ISLAND_LABELS,
  HeatNode,
} from "@/data/indonesiaGeoData";

// Presets for Regional Navigation Focus (Jawa is default focus)
const REGION_PRESETS: Record<string, { x: number; y: number; zoom: number; label: string }> = {
  Jawa: { x: 260, y: -160, zoom: 2.2, label: "Pulau Jawa (Fokus Utama)" },
  Jabodetabek: { x: 580, y: -240, zoom: 3.4, label: "Jabodetabek" },
  Bandung: { x: 510, y: -280, zoom: 3.2, label: "Bandung & Jabar" },
  Semarang: { x: 280, y: -290, zoom: 3.0, label: "Jateng & Solo" },
  Surabaya: { x: 80, y: -300, zoom: 3.0, label: "Jatim & Surabaya" },
  Nusantara: { x: 0, y: 0, zoom: 1.0, label: "Seluruh Nusantara" },
};

// Master Category Pills for problem filtration
const PROBLEM_CATEGORY_PILLS = [
  "Semua Masalah",
  "Lalu Lintas & Macet",
  "Banjir & Cuaca",
  "Keamanan & Kriminalitas",
  "Pelayanan Publik",
  "Infrastruktur & Jalan",
  "Kesehatan & Lingkungan",
  "Sosial & Warga",
];

export function IndonesiaMap() {
  const [geoData, setGeoData] = useState<IndonesiaGeoOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("31.74"); // Default: Jakarta Selatan
  const [selectedDetail, setSelectedDetail] = useState<RegionalDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProvinsi, setFilterProvinsi] = useState<string>("ALL");
  const [activeCategoryPill, setActiveCategoryPill] = useState<string>("Semua Masalah");
  const [channelFilter, setChannelFilter] = useState<"ALL" | "berita" | "sosmed">("ALL");
  const [hoveredNode, setHoveredNode] = useState<HeatNode | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  // Pan & Zoom State (Default camera centered on Pulau Jawa)
  const [zoom, setZoom] = useState<number>(2.2);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 260, y: -160 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({
    x: 0,
    y: 0,
    startPanX: 260,
    startPanY: -160,
  });
  const hasMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchDistanceRef = useRef<number | null>(null);

  // Adaptive scale factor: keeps circles and text proportionate at any zoom level
  const invScale = useMemo(() => {
    return Number((1 / Math.pow(zoom, 0.72)).toFixed(3));
  }, [zoom]);

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

  // Heatmap intensity lookup for all Java & Indonesian regions
  const regionHeatMap = useMemo(() => {
    const map = new Map<string, { heat: number; threat: string; mentions: number }>();
    if (!geoData) return map;

    (geoData.jabodetabek_regions || []).forEach((r) => {
      map.set(r.kode, {
        heat: r.heat_intensity,
        threat: r.threat_level,
        mentions: r.mention_count,
      });
    });

    return map;
  }, [geoData]);

  // Apply preset jump
  const applyPreset = useCallback((key: string) => {
    const preset = REGION_PRESETS[key] || REGION_PRESETS.Jawa;
    setZoom(preset.zoom);
    setPan({ x: preset.x, y: preset.y });
  }, []);

  // Zoom helpers
  const handleZoomIn = () => {
    setZoom((z) => Math.min(8.0, Number((z * 1.3).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.6, Number((z / 1.3).toFixed(2))));
  };

  const handleResetJawa = () => {
    applyPreset("Jawa");
  };

  // NATIVE NON-PASSIVE WHEEL LISTENER (Stops page from scrolling completely)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;

      setZoom((currZoom) => {
        const newZoom = Math.min(8.0, Math.max(0.6, Number((currZoom * factor).toFixed(2))));
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        const scaleRatio = newZoom / currZoom;

        setPan((currPan) => ({
          x: Math.round(currPan.x - (mouseX - currPan.x) * (scaleRatio - 1)),
          y: Math.round(currPan.y - (mouseY - currPan.y) * (scaleRatio - 1)),
        }));

        return newZoom;
      });
    };

    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheelNative);
    };
  }, []);

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedRef.current = true;
    }
    setPan({
      x: dragStartRef.current.startPanX + dx,
      y: dragStartRef.current.startPanY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile/tablet pinch & pan
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      hasMovedRef.current = false;
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      touchDistanceRef.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedRef.current = true;
      }
      setPan({
        x: dragStartRef.current.startPanX + dx,
        y: dragStartRef.current.startPanY + dy,
      });
    } else if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = newDist / touchDistanceRef.current;
      setZoom((z) => Math.min(8.0, Math.max(0.6, Number((z * factor).toFixed(2)))));
      touchDistanceRef.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchDistanceRef.current = null;
  };

  // Filtered Jawa Kabupaten/Kota cards
  const filteredRegions = (geoData?.jabodetabek_regions || []).filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      r.nama.toLowerCase().includes(q) ||
      r.provinsi.toLowerCase().includes(q) ||
      r.kode.includes(q);

    const matchProv =
      filterProvinsi === "ALL" || r.provinsi.toLowerCase().includes(filterProvinsi.toLowerCase());

    return matchQuery && matchProv;
  });

  const activeRegion = geoData?.jabodetabek_regions.find(
    (r) => r.kode === selectedRegionCode
  );

  // Filtered issues and media items based on active category pill and channel filter
  const filteredIssues = useMemo(() => {
    if (!selectedDetail?.issues) return [];
    if (activeCategoryPill === "Semua Masalah") return selectedDetail.issues;
    return selectedDetail.issues.filter(
      (iss) => iss.kategori_masalah === activeCategoryPill || iss.kategori === activeCategoryPill
    );
  }, [selectedDetail, activeCategoryPill]);

  const filteredMediaItems = useMemo(() => {
    if (!selectedDetail?.media_items) return [];
    let items = selectedDetail.media_items;

    // Channel filter (Berita vs Sosmed)
    if (channelFilter !== "ALL") {
      items = items.filter((m) => m.channel_type === channelFilter);
    }

    // Problem category filter
    if (activeCategoryPill !== "Semua Masalah") {
      items = items.filter((m) => m.kategori_masalah === activeCategoryPill);
    }

    return items;
  }, [selectedDetail, channelFilter, activeCategoryPill]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Heat Indicator Legend */}
      <div className="panel p-4 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wider uppercase text-zinc-900 dark:text-white">
                RADAR INTELIJEN WILAYAH PULAU JAWA &amp; NUSANTARA
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                FOKUS UTAMA JAWA
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                MULTI-CHANNEL X &bull; TIKTOK &bull; THREADS &bull; BERITA
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Peta interaktif kepulauan Nusantara berfokus penuh ke kota/kabupaten di Pulau Jawa. Cari wilayah, filter kategori masalah, dan telusuri tren isu langsung ke tautan sumber aslinya.
            </p>
          </div>
        </div>

        {/* Heat Intensity Scale Legend */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            Kritis / Kuat
          </span>
          <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            Tinggi
          </span>
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            Waspada
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Kondusif
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            Luar Jawa
          </span>
        </div>
      </div>

      {/* Main Interactive Map Canvas Section */}
      <div className="panel p-5 bg-white dark:bg-[#06080F] border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
        {/* Header Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-3 border-b border-zinc-200 dark:border-zinc-800 relative z-10">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-sky-500 animate-spin" style={{ animationDuration: "12s" }} />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              PETA VEKTOR JAWA &amp; NUSANTARA &bull; DRAG &amp; SCROLL FOKUS BEBAS
            </span>
          </div>

          {/* Regional Preset Jump Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-zinc-400 text-[11px] mr-1">Fokus Kamera:</span>
            {Object.entries(REGION_PRESETS).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className="px-2.5 py-1 rounded text-xs font-semibold transition-all text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Free Pan & Zoom Interactive Canvas */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative w-full aspect-[21/9] min-h-[380px] max-h-[580px] bg-zinc-50 dark:bg-[#03050A] rounded-xl border border-zinc-200 dark:border-zinc-800/80 select-none overflow-hidden flex items-center justify-center transition-colors ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {/* Tactical Background Grid Lines */}
          <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

          {/* Coordinate Crosshairs & Graticules */}
          <div className="absolute top-3 left-4 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono tracking-widest pointer-events-none z-10">
            FOKUS: PULAU JAWA &bull; WGS84 &bull; KEMENDAGRI RI
          </div>
          <div className="absolute bottom-3 right-4 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono tracking-widest pointer-events-none z-10">
            ZOOM: {Math.round(zoom * 100)}% &bull; PAN: ({pan.x}, {pan.y})
          </div>

          {/* Floating Pan & Zoom HUD Control Bar */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 p-1 rounded-lg bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700 shadow-lg backdrop-blur-xs">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Perbesar Peta (Scroll Up)"
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Perkecil Peta (Scroll Down)"
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5" />
            <button
              type="button"
              onClick={handleResetJawa}
              title="Reset ke Fokus Jawa (Tampilan Utama)"
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyPreset("Jabodetabek")}
              title="Fokus ke Jabodetabek"
              className="px-2 py-1 rounded text-[11px] font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 transition-colors"
            >
              Jabodetabek
            </button>
            <span className="text-[10px] font-bold text-zinc-500 px-1.5">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* SVG Map Container with Smooth Pan & Zoom Group */}
          <svg
            viewBox="0 0 1000 420"
            className="w-full h-full drop-shadow-sm select-none"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Tactical Dot-Matrix Pattern Fill */}
              <pattern
                id="tactical-pixel-dots"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="3.5" cy="3.5" r="1.1" className="fill-zinc-400/40 dark:fill-zinc-600/50" />
              </pattern>

              {/* Glowing Filters */}
              <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-orange" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Transform Group: Handles Free Pan & Zoom Smoothly */}
            <g
              transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
              style={{
                transformOrigin: "500px 210px",
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
            >
              {/* Latitude & Equator Reference Lines */}
              <line
                x1="10"
                y1="147"
                x2="990"
                y2="147"
                stroke="currentColor"
                strokeDasharray="3 4"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
                className="text-zinc-300 dark:text-zinc-800"
              />
              <text x="20" y="142" className="text-[9px] fill-zinc-400 dark:fill-zinc-600 font-mono">
                0° KHATULISTIWA (EQUATOR)
              </text>

              {/* Indonesian Archipelago Provinces (Accurate Boundaries, Non-Scaling Stroke) */}
              <g>
                {INDONESIA_PROVINCES.map((prov) => {
                  const isHovered = hoveredProvince === prov.name;
                  const isJawa =
                    prov.name.includes("Jawa") ||
                    prov.name.includes("Jakarta") ||
                    prov.name.includes("Banten") ||
                    prov.name.includes("Yogyakarta");

                  return (
                    <g key={prov.key || prov.name}>
                      {/* Base Solid Fill & Accurate Boundary Stroke */}
                      <path
                        d={prov.d}
                        vectorEffect="non-scaling-stroke"
                        strokeWidth={isJawa ? "1.4" : "1.0"}
                        className={`transition-all duration-200 cursor-pointer ${
                          isHovered
                            ? "fill-sky-100 dark:fill-sky-950/60 stroke-sky-500"
                            : isJawa
                            ? "fill-zinc-200/90 dark:fill-zinc-900/90 stroke-zinc-600 dark:stroke-zinc-500"
                            : "fill-zinc-100/90 dark:fill-zinc-950/70 stroke-zinc-300 dark:stroke-zinc-800"
                        }`}
                        onMouseEnter={() => setHoveredProvince(prov.name)}
                        onMouseLeave={() => setHoveredProvince(null)}
                      />
                      {/* Tactical Pixel Overlay Pattern inside Landmass */}
                      <path
                        d={prov.d}
                        fill="url(#tactical-pixel-dots)"
                        className="pointer-events-none opacity-80"
                      />
                    </g>
                  );
                })}
              </g>

              {/* Island Watermark Labels (Adaptively scaled) */}
              {ISLAND_LABELS.map((isl) => (
                <text
                  key={isl.name}
                  x={isl.x}
                  y={isl.y}
                  fontSize={`${Math.max(6, Math.round(10 * invScale))}px`}
                  opacity={zoom > 2.8 ? 0.25 : 0.65}
                  className="font-black tracking-widest fill-zinc-500 dark:fill-zinc-500 pointer-events-none select-none font-sans transition-opacity"
                >
                  {isl.name}
                </text>
              ))}

              {/* Tactical Heat Blips / Nodes (Pulau Jawa Coverage & Major Hubs) */}
              {INDONESIA_HEAT_NODES.map((node) => {
                const isSelected = selectedRegionCode === node.code;
                const heatInfo = regionHeatMap.get(node.code);
                const threat = heatInfo?.threat || (node.isFocus ? "waspada" : "none");
                const mentions = heatInfo?.mentions || 0;
                const isCritical = threat === "kritis" || mentions >= 10;
                const isHigh = threat === "tinggi" || mentions >= 5;

                let nodeColor = "#10B981"; // Emerald / Kondusif
                let filter = undefined;

                if (node.isFocus) {
                  if (isCritical) {
                    nodeColor = "#EF4444"; // Red Critical
                    filter = "url(#glow-red)";
                  } else if (isHigh) {
                    nodeColor = "#F97316"; // Orange High
                    filter = "url(#glow-orange)";
                  } else if (threat === "waspada" || mentions >= 1) {
                    nodeColor = "#F59E0B"; // Amber Warning
                  }
                } else {
                  nodeColor = "#71717A"; // Neutral grey for non-pilot nodes
                }

                // Adaptive visual radii:
                const baseDotRadius = (isSelected ? 4.5 : node.isFocus ? 3.2 : 2.0) * invScale;
                const ringRadius = (isSelected ? 8.5 : node.isFocus ? 6.0 : 3.8) * invScale;
                const pulseRadius = (isCritical ? 13 : 9) * invScale;

                // Tampilkan label hanya untuk node yang dipilih atau sedang di-hover agar peta tidak berantakan
                const showBadge = isSelected || (hoveredNode?.code === node.code);

                return (
                  <g
                    key={node.code}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!hasMovedRef.current) {
                        setSelectedRegionCode(node.code);
                      }
                    }}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {/* Outer Pulsing Wave for Critical / High Nodes */}
                    {(isCritical || isHigh) && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={pulseRadius}
                        fill={nodeColor}
                        opacity="0.25"
                        className="animate-ping"
                        style={{
                          transformOrigin: `${node.x}px ${node.y}px`,
                          animationDuration: isCritical ? "1.6s" : "2.4s",
                        }}
                      />
                    )}

                    {/* Halo Ring */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={ringRadius}
                      fill="none"
                      stroke={isSelected ? "#38BDF8" : nodeColor}
                      strokeWidth={Math.max(1, (isSelected ? 2.2 : 1.3) * invScale)}
                      opacity={isSelected ? 1 : 0.8}
                    />

                    {/* Solid Center Pixel / Radar Dot */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={baseDotRadius}
                      fill={isSelected ? "#38BDF8" : nodeColor}
                      filter={filter}
                      className="transition-all duration-200 group-hover:scale-125"
                      style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                    />

                    {/* Adaptive Label Badge */}
                    {showBadge && (
                      <g
                        transform={`translate(${node.x + 5 * invScale}, ${node.y - 7 * invScale}) scale(${invScale})`}
                      >
                        <rect
                          x="0"
                          y="0"
                          width={node.name.length * 6.2 + 16}
                          height="16"
                          rx="3"
                          className="fill-zinc-900/90 dark:fill-black/95 stroke-zinc-700 dark:stroke-zinc-800"
                          strokeWidth="1"
                        />
                        <circle cx="7" cy="8" r="2.5" fill={nodeColor} />
                        <text
                          x="13"
                          y="11"
                          className="text-[9px] font-bold fill-white font-sans"
                        >
                          {node.name}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Interactive Tooltip Card Floating on Top */}
          {hoveredNode && (
            <div
              className="pointer-events-none absolute p-3 rounded-lg bg-zinc-950/95 text-white border border-zinc-700 shadow-2xl z-50 text-xs backdrop-blur-xs font-sans transition-all"
              style={{
                left: `${Math.min(80, Math.max(10, ((hoveredNode.x + pan.x) / 1000) * 100))}%`,
                top: `${Math.max(12, ((hoveredNode.y + pan.y) / 420) * 100 - 15)}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                {hoveredNode.name}
              </div>
              <div className="text-[11px] text-zinc-400">
                Gugus {hoveredNode.island} &bull; Kode Kemendagri: {hoveredNode.code}
              </div>
              {hoveredNode.isFocus && (
                <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between gap-4 text-[11px]">
                  <span className="text-zinc-300">
                    Laporan: {regionHeatMap.get(hoveredNode.code)?.mentions || 0}
                  </span>
                  <span className="font-bold text-red-400 uppercase">
                    {regionHeatMap.get(hoveredNode.code)?.threat || "WASPADA"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout: Search & Wilayah Jawa (Kiri) | Tren Isu & Media Feed (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Search Wilayah & Daftar Kabupaten/Kota Jawa (5 cols) */}
        <div className="lg:col-span-5 panel p-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-500" />
              <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-800 dark:text-zinc-200">
                PENCARIAN WILAYAH PULAU JAWA
              </h3>
            </div>
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
              {filteredRegions.length} KABUPATEN / KOTA
            </span>
          </div>

          <div className="space-y-4">
            {/* Search Input for fast regional search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari wilayah di Jawa (contoh: Jakarta, Bandung, Surabaya, Semarang, Depok, Bekasi, Solo, Malang)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 shadow-xs"
              />
            </div>

            {/* Provinsi Filter Chips */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {[
                { label: "SEMUA JAWA", val: "ALL" },
                { label: "DKI Jakarta", val: "Jakarta" },
                { label: "Jawa Barat", val: "Jawa Barat" },
                { label: "Banten", val: "Banten" },
                { label: "Jawa Tengah", val: "Jawa Tengah" },
                { label: "DI Yogyakarta", val: "Yogyakarta" },
                { label: "Jawa Timur", val: "Jawa Timur" },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setFilterProvinsi(p.val)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    filterProvinsi === p.val
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Kabupaten Cards Grid */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {filteredRegions.map((reg) => {
                const isSelected = selectedRegionCode === reg.kode;
                const isCritical = reg.threat_level === "kritis";
                const isHigh = reg.threat_level === "tinggi";

                return (
                  <button
                    key={reg.kode}
                    type="button"
                    onClick={() => {
                      setSelectedRegionCode(reg.kode);
                    }}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-md ring-2 ring-sky-500/40"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-zinc-400">
                            {reg.kode}
                          </span>
                          <span className="text-[10px] text-zinc-400">&bull; {reg.jenis}</span>
                        </div>
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                          {reg.nama}
                        </h4>
                        <span className="text-xs text-zinc-500">
                          {reg.provinsi}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
                    <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-600 dark:text-zinc-400 font-bold">
                          {reg.mention_count} Laporan
                        </span>
                        <span className="text-zinc-500 text-[11px] truncate max-w-[200px]">
                          {reg.top_issue_title || reg.dominant_topic || "Kondusif"}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCritical
                              ? "bg-red-500"
                              : isHigh
                              ? "bg-orange-500"
                              : "bg-amber-400"
                          }`}
                          style={{
                            width: `${Math.max(12, reg.heat_intensity * 100)}%`,
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

        {/* Kolom Kanan: Detail Tren Isu, Pill Kategori Masalah & Link Berita/Sosmed (7 cols) */}
        <div className="lg:col-span-7 panel p-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4 gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-500" />
              <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                INTELIJEN TREN ISU &amp; SUMBER LAPORAN
              </h3>
            </div>
            {activeRegion && (
              <span className="text-xs font-black px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800">
                {activeRegion.nama} ({activeRegion.provinsi})
              </span>
            )}
          </div>

          {loadingDetail ? (
            <div className="py-16 text-center text-xs text-zinc-400 animate-pulse">
              Mengambil tren isu &amp; laporan multi-channel wilayah...
            </div>
          ) : selectedDetail ? (
            <div className="space-y-5">
              {/* Regional Trend Overview Card */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {selectedDetail.trend?.direction === "naik" ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Tren Eskalasi Naik
                      </span>
                    ) : selectedDetail.trend?.direction === "stabil" ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                        <Activity className="w-3.5 h-3.5" />
                        Tren Terkendali
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Situasi Kondusif
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">
                      Rasio Negatif: <strong className="text-zinc-800 dark:text-zinc-200">{selectedDetail.trend?.negatif_pct}%</strong>
                    </span>
                  </div>

                  {/* Channel Summary Badges */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                      <Newspaper className="w-3 h-3 text-sky-500" />
                      {selectedDetail.total_berita} Berita
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                      <Share2 className="w-3 h-3 text-rose-500" />
                      {selectedDetail.total_sosmed} Sosmed
                    </span>
                  </div>
                </div>

                {/* Sentiment Ratio Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-red-500 h-full"
                      style={{
                        width: `${(selectedDetail.trend?.sentimen?.negatif / Math.max(1, selectedDetail.total_articles)) * 100}%`,
                      }}
                      title="Sentimen Negatif"
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: `${(selectedDetail.trend?.sentimen?.netral / Math.max(1, selectedDetail.total_articles)) * 100}%`,
                      }}
                      title="Sentimen Netral"
                    />
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${(selectedDetail.trend?.sentimen?.positif / Math.max(1, selectedDetail.total_articles)) * 100}%`,
                      }}
                      title="Sentimen Positif"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Negatif: {selectedDetail.trend?.sentimen?.negatif || 0}</span>
                    <span>Netral: {selectedDetail.trend?.sentimen?.netral || 0}</span>
                    <span>Positif: {selectedDetail.trend?.sentimen?.positif || 0}</span>
                  </div>
                </div>
              </div>

              {/* BUTTON-BUTTON PIL KATEGORI MASALAH (Interactive Filter Pills) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" />
                    Pilih Kategori Masalah:
                  </h4>
                  <span className="text-[11px] text-zinc-400">
                    Klik pil untuk menyaring isu &amp; feed
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PROBLEM_CATEGORY_PILLS.map((cat) => {
                    const count = selectedDetail.category_counts?.[cat] || 0;
                    const isActive = activeCategoryPill === cat;

                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategoryPill(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          isActive
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm ring-2 ring-zinc-900/20 dark:ring-white/20"
                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800"
                        }`}
                      >
                        <span>{cat}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive
                              ? "bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Matched Priority Issues for Region */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
                  Daftar Isu Prioritas ({filteredIssues.length}):
                </h4>
                {filteredIssues.length > 0 ? (
                  <div className="space-y-2.5">
                    {filteredIssues.map((iss) => (
                      <div
                        key={iss.id}
                        className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h5 className="font-bold text-zinc-900 dark:text-white leading-snug">
                            {iss.judul}
                          </h5>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase ${
                              iss.tingkat_bahaya === "critical" || iss.tingkat_bahaya === "kritis"
                                ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                                : iss.tingkat_bahaya === "high" || iss.tingkat_bahaya === "tinggi"
                                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {iss.tingkat_bahaya}
                          </span>
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400 text-[11px] line-clamp-2 leading-relaxed mb-2">
                          {iss.ringkasan || "Laporan terverifikasi dalam pengawasan pimpinan."}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                          <span>Kategori: <strong>{iss.kategori_masalah || iss.kategori}</strong></span>
                          <span>Volume 24 Jam: <strong>{iss.volume_24jam}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-2">
                    Tidak ada isu tereskalasi dalam kategori &ldquo;{activeCategoryPill}&rdquo; di wilayah ini.
                  </p>
                )}
              </div>

              {/* Feed Berita & Media Sosial dengan Link Langsung */}
              <div className="pt-2 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
                    Feed Berita &amp; Sosmed dengan Link Langsung ({filteredMediaItems.length}):
                  </h4>

                  {/* Tipe Saluran Toggle Pills */}
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setChannelFilter("ALL")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        channelFilter === "ALL"
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannelFilter("berita")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                        channelFilter === "berita"
                          ? "bg-sky-600 text-white shadow-xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <RealBrandIcon name="detik" className="w-3.5 h-3.5" />
                        <RealBrandIcon name="cnn" className="w-3.5 h-3.5" />
                        <RealBrandIcon name="antara" className="w-3.5 h-3.5" />
                      </span>
                      <span>Berita Resmi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannelFilter("sosmed")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                        channelFilter === "sosmed"
                          ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <RealBrandIcon name="x" className="w-3.5 h-3.5" />
                        <RealBrandIcon name="tiktok" className="w-3.5 h-3.5" />
                        <RealBrandIcon name="threads" className="w-3.5 h-3.5" />
                      </span>
                      <span>Sosmed (X / TikTok / Threads)</span>
                    </button>
                  </div>
                </div>

                {filteredMediaItems.length > 0 ? (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {filteredMediaItems.map((item) => {
                      // Cek apakah ada penulis khusus (misal akun @user atau instansi seperti Pusdatinhub)
                      const normPenulis = (item.penulis || "").toLowerCase().trim();
                      const normPlatform = (item.platform || "").toLowerCase().trim();
                      const hasDistinctAuthor =
                        normPenulis &&
                        normPenulis !== normPlatform &&
                        !normPenulis.includes("threads") &&
                        !normPenulis.includes("tiktok") &&
                        !normPenulis.includes("twitter") &&
                        !normPenulis.includes("google") &&
                        !normPenulis.includes("site:");

                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 text-xs transition-colors hover:border-zinc-400 dark:hover:border-zinc-700"
                        >
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 gap-2">
                            <div className="flex items-center gap-2 truncate">
                              {/* Logo Resmi Asli Platform / Media Langsung dari Asset Asli */}
                              <SourceLogoBadge
                                platform={item.platform}
                                penerbit={item.penerbit}
                                channelType={item.channel_type}
                                size="md"
                              />

                              {hasDistinctAuthor && (
                                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                                  · {item.penulis}
                                </span>
                              )}
                            </div>

                            <SentimentBadge sentiment={item.sentimen} />
                          </div>

                          {/* Judul & Tautan URL Asli Langsung */}
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-sky-600 dark:hover:text-sky-400 hover:underline flex items-baseline gap-1.5 leading-snug group"
                          >
                            <span className="line-clamp-2">{item.judul}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60 group-hover:opacity-100 text-sky-500 transition-opacity" />
                          </a>

                          {/* Ringkasan & Kategori */}
                          <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-[10px] text-zinc-400">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
                              {item.kategori_masalah}
                            </span>
                            <span className="truncate max-w-[200px]">
                              {item.published_at ? new Date(item.published_at).toLocaleString("id-ID") : "Baru saja"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic py-2">
                    Belum ada konten berita atau sosmed yang sesuai dengan kategori &ldquo;{activeCategoryPill}&rdquo;.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-zinc-400">
              Pilih salah satu Kota atau Kabupaten di peta sebelah kiri.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
