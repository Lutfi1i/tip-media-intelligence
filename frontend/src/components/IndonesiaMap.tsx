"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  fetchIndonesiaGeo,
  fetchRegionalDetail,
  IndonesiaGeoOverview,
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
  Move,
  Maximize2,
  Navigation,
} from "lucide-react";
import { SentimentBadge } from "./RadarUi";
import {
  INDONESIA_PROVINCES,
  INDONESIA_HEAT_NODES,
  ISLAND_LABELS,
  HeatNode,
} from "@/data/indonesiaGeoData";

// Presets for Island Focus Navigation
const ISLAND_PRESETS: Record<string, { x: number; y: number; zoom: number }> = {
  ALL: { x: 0, y: 0, zoom: 1 },
  Jawa: { x: 260, y: -160, zoom: 2.2 },
  Jabodetabek: { x: 580, y: -240, zoom: 3.4 },
  Sumatera: { x: 500, y: 40, zoom: 1.8 },
  Kalimantan: { x: 80, y: 0, zoom: 1.9 },
  Sulawesi: { x: -220, y: -40, zoom: 2.2 },
  Papua: { x: -550, y: -100, zoom: 1.8 },
  "Nusa Tenggara": { x: -140, y: -260, zoom: 2.4 },
};

export function IndonesiaMap() {
  const [geoData, setGeoData] = useState<IndonesiaGeoOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("31.74"); // Default: Jakarta Selatan
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIsland, setFilterIsland] = useState<string>("ALL");
  const [hoveredNode, setHoveredNode] = useState<HeatNode | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  // Pan & Zoom State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({
    x: 0,
    y: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const hasMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchDistanceRef = useRef<number | null>(null);

  // Adaptive scale factor: elements stay visually compact and proportionate regardless of zoom
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

  // Heatmap intensity lookup
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

  // Pan to preset island
  const applyPreset = useCallback((key: string) => {
    setFilterIsland(key);
    const preset = ISLAND_PRESETS[key] || ISLAND_PRESETS.ALL;
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

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFilterIsland("ALL");
  };

  // NATIVE NON-PASSIVE WHEEL LISTENER (Prevents page from scrolling completely)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      // Guaranteed stop of outer window / page scrolling
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
    if (e.button !== 0) return; // Only primary left-click
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
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wider uppercase text-zinc-900 dark:text-white">
                RADAR INTELIJEN GEOSPASIAL INDONESIA
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                SCROLL-LOCK &bull; ADAPTIVE SCALE
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Scroll mouse fokus pada peta tanpa menggulir halaman. Titik radar dan teks berukuran adaptif (tetap proporsional saat diperbesar).
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
            Kritis / Isu Kuat
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
            Fase 2
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
              PETA VEKTOR RESMI NUSANTARA &bull; SCROLL MOUSE TERFOKUS
            </span>
          </div>

          {/* Island Preset Jump Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-zinc-400 text-[11px] mr-1">Lompat Wilayah:</span>
            {["ALL", "Jabodetabek", "Jawa", "Sumatera", "Kalimantan", "Sulawesi", "Papua", "Nusa Tenggara"].map((isl) => (
              <button
                key={isl}
                type="button"
                onClick={() => applyPreset(isl)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  filterIsland === isl
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {isl}
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
            LAT: 06°00&apos;N - 11°00&apos;S &bull; LON: 95°00&apos;E - 141°00&apos;E
          </div>
          <div className="absolute bottom-3 right-4 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono tracking-widest pointer-events-none z-10">
            WGS84 &bull; ZOOM: {Math.round(zoom * 100)}% &bull; PAN: ({pan.x}, {pan.y})
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
              onClick={handleReset}
              title="Reset Peta (Tampilan Penuh)"
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyPreset("Jabodetabek")}
              title="Fokus ke Jabodetabek (Area Pilot)"
              className="px-2 py-1 rounded text-[11px] font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 transition-colors"
            >
              Fokus Pilot
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
                        strokeWidth="1.1"
                        className={`transition-all duration-200 cursor-pointer ${
                          isHovered
                            ? "fill-sky-100 dark:fill-sky-950/60 stroke-sky-500"
                            : isJawa
                            ? "fill-zinc-200/90 dark:fill-zinc-900/90 stroke-zinc-500 dark:stroke-zinc-600"
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
                  opacity={zoom > 2.8 ? 0.25 : 0.6}
                  className="font-black tracking-widest fill-zinc-400 dark:fill-zinc-600 pointer-events-none select-none font-sans transition-opacity"
                >
                  {isl.name}
                </text>
              ))}

              {/* Tactical Heat Blips / Nodes (Jabodetabek Pilot & Major Hubs) */}
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

                // Show badge if selected, critical, or if zoomed into region
                const showBadge = isSelected || isCritical || (zoom >= 2.4 && node.isFocus);

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

                    {/* Adaptive Label Badge: scaled with invScale so it remains crisp and neat */}
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

      {/* Bottom Grid: Kabupaten Heatmap List + Active Region Drill-Down */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Full Kabupaten & Kota Selector (7 cols) */}
        <div className="lg:col-span-7 panel p-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" />
              <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-800 dark:text-zinc-200">
                PILIH WILAYAH KABUPATEN / KOTA (HEATMAP LIVE)
              </h3>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {filteredJabodetabek.length} WILAYAH AKTIF
            </span>
          </div>

          <div className="space-y-4">
            {/* Search Input for fast filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari Kabupaten / Kota (contoh: Jakarta Selatan, Depok, Bogor, Tangerang, Bekasi)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Kabupaten Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
              {filteredJabodetabek.map((reg) => {
                const isSelected = selectedRegionCode === reg.kode;
                const isCritical = reg.threat_level === "kritis";
                const isHigh = reg.threat_level === "tinggi";

                return (
                  <button
                    key={reg.kode}
                    type="button"
                    onClick={() => {
                      setSelectedRegionCode(reg.kode);
                      // If user clicks a kabupaten card, also pan & zoom towards Jabodetabek
                      applyPreset("Jabodetabek");
                    }}
                    className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-900 shadow-md ring-2 ring-zinc-900 dark:ring-white"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-zinc-400">
                          {reg.kode} &bull; {reg.jenis}
                        </span>
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
                    <div className="mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-600 dark:text-zinc-400 font-bold">
                          {reg.mention_count} Laporan
                        </span>
                        <span className="text-zinc-500 text-[11px]">
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
              <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                DETAIL INTELIJEN WILAYAH
              </h3>
            </div>
            {activeRegion && (
              <span className="text-xs font-black text-zinc-900 dark:text-white">
                {activeRegion.nama}
              </span>
            )}
          </div>

          {loadingDetail ? (
            <div className="py-12 text-center text-xs text-zinc-400 animate-pulse">
              Mengambil data intelijen wilayah...
            </div>
          ) : selectedDetail ? (
            <div className="space-y-4">
              {/* Regional KPI Summary Bar */}
              <div className="grid grid-cols-2 gap-2 text-xs">
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
                <h4 className="text-[11px] font-bold uppercase text-zinc-500 mb-2">
                  Isu Terkait di Wilayah Ini:
                </h4>
                {selectedDetail.issues.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDetail.issues.map((iss: any) => (
                      <div
                        key={iss.id}
                        className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-xs"
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
                  <p className="text-xs text-zinc-400 italic">
                    Belum ada eskalasi isu prioritas di wilayah ini saat ini.
                  </p>
                )}
              </div>

              {/* Recent Real News in Region */}
              <div className="pt-2">
                <h4 className="text-[11px] font-bold uppercase text-zinc-500 mb-2">
                  Laporan Berita Nyata Terkini:
                </h4>
                {selectedDetail.recent_articles.length > 0 ? (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {selectedDetail.recent_articles.map((art: any) => (
                      <div
                        key={art.id}
                        className="p-2.5 rounded border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 text-xs"
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
                  <p className="text-xs text-zinc-400 italic">
                    Belum ada artikel berita spesifik untuk wilayah ini dalam 24 jam terakhir.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-zinc-400">
              Pilih salah satu Kota atau Kabupaten di peta sebelah kiri.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
