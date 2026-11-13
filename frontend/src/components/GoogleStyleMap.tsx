"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { fmtDateTime, IndoZone } from "@/lib/format";
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
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Newspaper,
  Compass,
  AlertTriangle,
  Filter,
  X,
  ShieldAlert,
} from "lucide-react";
import { SentimentBadge } from "./RadarUi";
import { SourceLogoBadge } from "./SourceLogos";
import indonesiaProvincesGeoJson from "@/data/indonesia_provinces.json";

// Camera Presets for Navigation (Fit-to-bounds & viewports)
const CAMERA_PRESETS = [
  { id: "jawa", label: "Pulau Jawa", bounds: [[-8.8, 105.0], [-5.8, 114.6]], lat: -7.45, lng: 110.15, zoom: 7 },
  { id: "jabodetabek", label: "Jabodetabek", bounds: null, lat: -6.22, lng: 106.85, zoom: 10 },
  { id: "bandung", label: "Bandung Raya", bounds: null, lat: -6.92, lng: 107.62, zoom: 11 },
  { id: "semarang", label: "Semarang & Jateng", bounds: null, lat: -7.02, lng: 110.42, zoom: 10 },
  { id: "surabaya", label: "Surabaya & Jatim", bounds: null, lat: -7.28, lng: 112.75, zoom: 10 },
  { id: "nasional", label: "Nusantara (Nasional)", bounds: [[-11.0, 95.0], [6.0, 141.0]], lat: -2.5, lng: 118.0, zoom: 5 },
];

// Focus Jawa Provinces for styling
const JAWA_PROVINCE_NAMES = new Set([
  "Jakarta Raya",
  "Jawa Barat",
  "Banten",
  "Jawa Tengah",
  "Yogyakarta",
  "Jawa Timur",
]);

// Filter Kategori Masalah (Selaras dengan backend geo_service.py)
const CATEGORY_PILLS = [
  "Semua Masalah",
  "Banjir & Cuaca",
  "Lalu Lintas & Macet",
  "Infrastruktur & Jalan",
  "Pelayanan Publik",
  "Keamanan & Kriminalitas",
  "Kesehatan & Lingkungan",
  "Sosial & Warga",
];

interface RegionData {
  kode: string;
  nama: string;
  jenis: string;
  provinsi: string;
  lat: number;
  lng: number;
  mention_count: number;
  negative_count: number;
  sosmed_count: number;
  berita_count: number;
  threat_level: "kritis" | "tinggi" | "waspada" | "rendah" | "kondusif";
  heat_intensity: number;
  top_issue_title: string | null;
  topics?: Record<string, number>;
  categories?: Record<string, number>;
}

export function GoogleStyleMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const geoJsonLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  // Data States
  const [geoData, setGeoData] = useState<IndonesiaGeoOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("31.71"); // Default: Jakarta Pusat
  const [selectedDetail, setSelectedDetail] = useState<RegionalDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua Masalah");
  const [channelFilter, setChannelFilter] = useState<"ALL" | "berita" | "sosmed">("ALL");
  const [tzZone, setTzZone] = useState<IndoZone>("WIB");
  const [activePreset, setActivePreset] = useState<string>("java");

  // Load Geo Overview Data
  useEffect(() => {
    let isMounted = true;
    async function loadGeo() {
      try {
        setLoading(true);
        setGeoError(null);
        const data = await fetchIndonesiaGeo();
        if (isMounted) {
          setGeoData(data);
        }
      } catch (err) {
        console.error("Gagal memuat data geo overview:", err);
        if (isMounted) {
          setGeoError("Gagal memuat data peta wilayah. Silakan coba muat ulang.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadGeo();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load Regional Detail when selectedRegionCode changes
  useEffect(() => {
    if (!selectedRegionCode) {
      setSelectedDetail(null);
      setDetailError(null);
      return;
    }
    let isMounted = true;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        setDetailError(null);
        const detail = await fetchRegionalDetail(selectedRegionCode);
        if (isMounted) {
          setSelectedDetail(detail);
        }
      } catch (err) {
        console.error("Gagal memuat detail wilayah:", err);
        if (isMounted) {
          setDetailError("Gagal memuat detail wilayah ini.");
        }
      } finally {
        if (isMounted) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedRegionCode]);

  // Active Regions (57 Kab/Kota Jawa + others)
  const allRegions: RegionData[] = useMemo(() => {
    if (!geoData) return [];
    return (geoData.jawa_regions || geoData.jabodetabek_regions || []) as unknown as RegionData[];
  }, [geoData]);

  const activeRegions = useMemo(() => {
    return allRegions
      .filter((r) => (r.mention_count || 0) > 0)
      .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0));
  }, [allRegions]);

  // Filtered Regions based on Search
  const searchFilteredRegions = useMemo(() => {
    if (!searchQuery.trim()) return allRegions;
    const q = searchQuery.toLowerCase();
    return allRegions.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        r.provinsi.toLowerCase().includes(q) ||
        r.kode.includes(q)
    );
  }, [allRegions, searchQuery]);

  // Selected Region Metadata
  const currentRegionMeta = useMemo(() => {
    return allRegions.find((r) => r.kode === selectedRegionCode) || null;
  }, [allRegions, selectedRegionCode]);

  // Initialize Leaflet Map with GeoJSON Polygons (Tanpa Tile / Tanpa API Key)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Avoid re-initializing if already exists
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [-7.45, 110.15], // Pulau Jawa center
          zoom: 7,
          minZoom: 4,
          maxZoom: 18,
          zoomControl: false,
          attributionControl: false,
        });

        // Background tactical map: Bersih, bebas tile watermark, 100% self-hosted
        // Render batas wilayah poligon Indonesia WGS84 GeoJSON
        const geoJsonLayer = L.geoJSON(indonesiaProvincesGeoJson as any, {
          style: (feature: any) => {
            const provName = feature?.properties?.state || "";
            const isJawa = JAWA_PROVINCE_NAMES.has(provName);

            return {
              fillColor: isJawa ? "#E2E8F0" : "#F1F5F9",
              weight: isJawa ? 1.4 : 0.8,
              opacity: 1,
              color: isJawa ? "#64748B" : "#CBD5E1",
              fillOpacity: isJawa ? 0.95 : 0.65,
              className: isJawa ? "jawa-polygon-feature" : "outer-polygon-feature",
            };
          },
          onEachFeature: (feature: any, layer: any) => {
            const provName = feature?.properties?.state || "";
            const isJawa = JAWA_PROVINCE_NAMES.has(provName);

            // Hover tooltip on province
            layer.bindTooltip(
              `<div style="font-weight: 700; font-size: 11px;">${provName}${isJawa ? " (Fokus Operasional)" : ""}</div>`,
              { sticky: true, opacity: 0.9, className: "leaflet-google-tooltip" }
            );

            // Hover style
            layer.on({
              mouseover: (e: any) => {
                const l = e.target;
                l.setStyle({
                  weight: 2,
                  color: "#0284C7",
                  fillOpacity: 1,
                });
              },
              mouseout: (e: any) => {
                geoJsonLayer.resetStyle(e.target);
              },
              click: (e: any) => {
                map.fitBounds(e.target.getBounds(), { padding: [30, 30], maxZoom: 10 });
              },
            });
          },
        }).addTo(map);

        geoJsonLayerRef.current = geoJsonLayer;
        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Render Data-Driven Hotspot Markers (Di atas poligon batas wilayah)
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    import("leaflet").then((L) => {
      const markersLayer = markersLayerRef.current;
      markersLayer.clearLayers();

      allRegions.forEach((region) => {
        const isSelected = region.kode === selectedRegionCode;
        const count = region.mention_count || 0;
        const threat = region.threat_level || "kondusif";

        // Color Palette based on Threat Level
        let markerBg = "#10B981"; // kondusif (emerald)
        let ringColor = "rgba(16, 185, 129, 0.4)";
        let pulseClass = "";

        if (threat === "kritis") {
          markerBg = "#EF4444"; // red
          ringColor = "rgba(239, 68, 68, 0.5)";
        } else if (threat === "tinggi") {
          markerBg = "#F97316"; // orange
          ringColor = "rgba(249, 115, 22, 0.4)";
        } else if (threat === "waspada") {
          markerBg = "#F59E0B"; // amber
          ringColor = "rgba(245, 158, 11, 0.35)";
        } else if (threat === "rendah") {
          markerBg = "#0284C7"; // sky
          ringColor = "rgba(2, 132, 199, 0.35)";
        }

        // Marker Size: Proportional to mention count (18px - 34px)
        const size = isSelected ? 36 : Math.min(32, Math.max(20, 18 + count * 1.5));
        const borderSize = isSelected ? "3px" : "2px";

        // Custom HTML Marker Element (Zero overlapping black pills!)
        const iconHtml = `
          <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${
              threat === "kritis" || threat === "tinggi"
                ? `<div class="${pulseClass}" style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background: ${ringColor};"></div>`
                : ""
            }
            <div style="
              position: relative;
              z-index: 10;
              width: ${size}px;
              height: ${size}px;
              border-radius: 9999px;
              background: ${markerBg};
              border: ${borderSize} solid ${isSelected ? "#0284C7" : "#FFFFFF"};
              box-shadow: 0 4px 12px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-family: inherit;
              font-weight: 800;
              font-size: ${size < 24 ? "10px" : "11px"};
              transition: transform 0.15s ease;
            ">
              ${count > 0 ? count : ""}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-hotspot-pin",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([region.lat, region.lng], {
          icon: customIcon,
          zIndexOffset: isSelected ? 1000 : count * 10,
        });

        // Tooltip on Hover: Clean, Compact Card (Kontras tinggi)
        const tooltipContent = `
          <div style="font-family: inherit; padding: 6px 8px; min-width: 170px;">
            <div style="font-weight: 800; font-size: 13px; color: #18181b; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span>${region.nama}</span>
              <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${markerBg}; color: white; text-transform: uppercase;">
                ${threat}
              </span>
            </div>
            <div style="font-size: 12px; color: #3f3f46; margin-top: 4px;">
              ${region.provinsi} &bull; <strong>${count} Laporan</strong>
            </div>
            ${
              region.top_issue_title
                ? `<div style="font-size: 11px; color: #0369a1; margin-top: 3px; font-weight: 600;">Topik: ${region.top_issue_title}</div>`
                : ""
            }
          </div>
        `;

        marker.bindTooltip(tooltipContent, {
          direction: "top",
          offset: [0, -size / 2],
          opacity: 0.98,
          className: "leaflet-google-tooltip",
        });

        // Click Handler: Select Region & Fly Camera
        marker.on("click", () => {
          setSelectedRegionCode(region.kode);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([region.lat, region.lng], Math.max(10, mapInstanceRef.current.getZoom()), {
              duration: 0.8,
            });
          }
        });

        markersLayer.addLayer(marker);
      });
    });
  }, [allRegions, selectedRegionCode]);

  // Handle Preset Camera Focus
  const handlePresetCamera = (preset: (typeof CAMERA_PRESETS)[0]) => {
    setActivePreset(preset.id);
    if (!mapInstanceRef.current) return;
    if (preset.bounds) {
      mapInstanceRef.current.fitBounds(preset.bounds as any, { padding: [20, 20] });
    } else {
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], preset.zoom, { duration: 1.2 });
    }
  };

  // Zoom Helpers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };
  const handleResetView = () => {
    setActivePreset("java");
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([-7.45, 110.15], 7, { duration: 1 });
    }
  };

  // Filtered Media Items in Selected Detail
  const filteredMediaItems = useMemo(() => {
    if (!selectedDetail || !selectedDetail.media_items) return [];
    let items = selectedDetail.media_items;

    // Filter Kategori Masalah
    if (activeCategory !== "Semua Masalah") {
      items = items.filter((m) => m.kategori_masalah === activeCategory);
    }

    // Filter Saluran (Berita vs Sosmed)
    if (channelFilter !== "ALL") {
      items = items.filter((m) => m.channel_type === channelFilter);
    }

    return items;
  }, [selectedDetail, activeCategory, channelFilter]);

  // Filtered Issues in Selected Detail
  const filteredIssues = useMemo(() => {
    if (!selectedDetail || !selectedDetail.issues) return [];
    return selectedDetail.issues;
  }, [selectedDetail]);

  return (
    <div className="space-y-4">
      {/* Top Filter Bar: Kategori Masalah Terpusat & Ringkasan Wilayah Aktif */}
      <div className="panel p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Kategori Masalah Pills (Scrollable) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 shrink-0 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Isu:</span>
            </span>
            {CATEGORY_PILLS.map((cat) => {
              const count = selectedDetail?.category_counts?.[cat] || 0;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs"
                      : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  <span>{cat}</span>
                  {count > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none ${
                        isActive
                          ? "bg-white/20 text-white dark:bg-black/20 dark:text-zinc-900"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Ringkasan Status Wilayah Aktif */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              {loading ? "Memuat..." : `${activeRegions.length} Wilayah Aktif`}
            </span>
          </div>
        </div>
      </div>

      {geoError && (
        <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {/* Main 2-Column Split Screen Layout (Poligon Batas Wilayah WGS84 + Hotspot Clusters) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Kolom Kiri: Preset Kamera + Peta Poligon Choropleth Leaflet (Sticky, 7/12 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 sticky top-20 space-y-2.5">
          {/* Camera Presets Bar (Di atas peta agar kanvas peta tidak tertutup) */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1 mr-1">
                <Compass className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Fokus Kamera:</span>
              </span>
              {CAMERA_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetCamera(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    activePreset === p.id
                      ? "bg-sky-600 text-white"
                      : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full h-[620px] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm bg-[#F8FAFC] dark:bg-[#09090B]">
            {/* Map Canvas */}
            <div ref={mapContainerRef} className="w-full h-full z-0 tactical-choropleth-canvas" />

            {loading && (
              <div className="absolute inset-0 z-20 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center">
                <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  Memuat peta dan titik hotspot wilayah...
                </div>
              </div>
            )}

            {/* Floating Zoom & Center Buttons (Kanan Bawah) */}
            <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 shadow-md">
              <button
                type="button"
                onClick={handleZoomIn}
                aria-label="Perbesar peta"
                className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 transition-colors"
                title="Perbesar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                aria-label="Perkecil peta"
                className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 transition-colors"
                title="Perkecil"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                aria-label="Reset posisi peta ke Pulau Jawa"
                className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 transition-colors"
                title="Reset Posisi Jawa"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Floating Legend (Kiri Bawah) */}
            <div className="absolute bottom-4 left-4 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-3 py-2.5 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 text-xs font-sans">
              <div className="font-bold text-zinc-800 dark:text-zinc-100 mb-1.5 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>Level Sinyal Wilayah</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Kritis
                </span>
                <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Tinggi
                </span>
                <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Waspada
                </span>
                <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Rendah
                </span>
                <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Kondusif
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Panel Intelijen & Feed Media Mandiri (5/12 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:max-h-[676px] overflow-y-auto pr-1">
          {/* Quick Search Wilayah (Di paling atas agar mudah dicari) */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Cari kota atau kabupaten di Pulau Jawa"
                placeholder="Cari kota / kabupaten di Pulau Jawa..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian wilayah"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Jika sedang mencari: Tampilkan hasil pencarian wilayah */}
            {searchQuery ? (
              <div className="panel p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-h-48 overflow-y-auto space-y-1">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 block mb-1">
                  Hasil Pencarian ({searchFilteredRegions.length} Wilayah)
                </span>
                {searchFilteredRegions.length > 0 ? (
                  searchFilteredRegions.map((r) => (
                    <button
                      key={r.kode}
                      type="button"
                      onClick={() => {
                        setSelectedRegionCode(r.kode);
                        setSearchQuery("");
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo([r.lat, r.lng], 11, { duration: 0.8 });
                        }
                      }}
                      className="w-full p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center justify-between text-left text-xs transition-colors"
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{r.nama}</span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-300">
                        {r.provinsi} &bull; {r.mention_count} Laporan
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 py-2">
                    Wilayah tidak ditemukan.
                  </p>
                )}
              </div>
            ) : (
              activeRegions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                    Teratas:
                  </span>
                  {activeRegions.slice(0, 5).map((r) => (
                    <button
                      key={r.kode}
                      type="button"
                      onClick={() => {
                        setSelectedRegionCode(r.kode);
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo([r.lat, r.lng], 10, { duration: 0.8 });
                        }
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                        selectedRegionCode === r.kode
                          ? "bg-sky-600 text-white border-sky-600"
                          : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      {r.nama} ({r.mention_count})
                    </button>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Header Wilayah Terpilih */}
          <div className="panel p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white leading-tight">
                    {currentRegionMeta?.nama || "Pilih Wilayah di Peta"}
                  </h3>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {currentRegionMeta?.provinsi || "Klik salah satu titik hotspot di peta"}
                  </p>
                </div>
              </div>

              {currentRegionMeta && (
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                    currentRegionMeta.threat_level === "kritis"
                      ? "bg-rose-600 text-white"
                      : currentRegionMeta.threat_level === "tinggi"
                      ? "bg-orange-600 text-white"
                      : currentRegionMeta.threat_level === "waspada"
                      ? "bg-amber-400 text-zinc-950"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {currentRegionMeta.threat_level}
                </span>
              )}
            </div>

            {detailLoading && (
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Memuat detail isu wilayah...
              </div>
            )}

            {detailError && !detailLoading && (
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900 text-xs font-medium text-rose-600 dark:text-rose-400">
                {detailError}
              </div>
            )}

            {/* Quick Metrics Cards */}
            {selectedDetail && !detailLoading && (
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900 text-center">
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300 block font-semibold">Total Isu</span>
                  <span className="text-base font-black text-zinc-900 dark:text-white">
                    {selectedDetail.total_issues || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300 block font-semibold">Berita Resmi</span>
                  <span className="text-base font-black text-sky-700 dark:text-sky-400">
                    {selectedDetail.total_berita || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-600 dark:text-zinc-300 block font-semibold">Sosmed</span>
                  <span className="text-base font-black text-purple-700 dark:text-purple-400">
                    {selectedDetail.total_sosmed || 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Klaster Isu Prioritas Wilayah */}
          {filteredIssues.length > 0 && (
            <div className="panel p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Isu Prioritas ({filteredIssues.length})</span>
                </span>
              </div>

              <div className="space-y-2">
                {filteredIssues.slice(0, 3).map((iss) => (
                  <div
                    key={iss.id}
                    className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-700 dark:text-zinc-200">{iss.kategori}</span>
                      <span className="font-bold text-amber-700 dark:text-amber-400">Skor: {iss.skor}</span>
                    </div>
                    <h5 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2">
                      {iss.judul}
                    </h5>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                      {iss.ringkasan}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feed Konten Berita & Sosmed (Langsung dengan Logo Asli Bulat) */}
          <div className="panel p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Feed Lapangan ({filteredMediaItems.length})</span>
              </span>

              {/* Saluran Filter Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setChannelFilter("ALL")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    channelFilter === "ALL"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                      : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setChannelFilter("berita")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    channelFilter === "berita"
                      ? "bg-sky-600 text-white"
                      : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  Berita
                </button>
                <button
                  type="button"
                  onClick={() => setChannelFilter("sosmed")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    channelFilter === "sosmed"
                      ? "bg-purple-600 text-white"
                      : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  Sosmed
                </button>
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-lg">
                {(["WIB", "WITA", "WIT"] as IndoZone[]).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setTzZone(z)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors ${
                      tzZone === z
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                    title={`Tampilkan waktu dalam zona ${z}`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>

            {/* List Feed Item */}
            {filteredMediaItems.length > 0 ? (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {filteredMediaItems.map((item) => {
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
                      className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 text-xs transition-colors hover:border-zinc-400 dark:hover:border-zinc-600"
                    >
                      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 mb-1.5 gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          {/* Logo Resmi Asli Bulat Seragam */}
                          <SourceLogoBadge
                            platform={item.platform}
                            penerbit={item.penerbit}
                            channelType={item.channel_type}
                            size="sm"
                          />

                          {hasDistinctAuthor && (
                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate">
                              &middot; {item.penulis}
                            </span>
                          )}
                        </div>

                        <SentimentBadge sentiment={item.sentimen} />
                      </div>

                      {/* Judul & Tautan URL Langsung */}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-sky-700 dark:hover:text-sky-400 hover:underline flex items-baseline gap-1.5 leading-snug group"
                      >
                        <span className="line-clamp-2">{item.judul}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100 text-sky-600 dark:text-sky-400 transition-opacity" />
                      </a>

                      <div className="mt-2 pt-2 border-t border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 gap-2">
                        <span className="px-2 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium">
                          {item.kategori_masalah}
                        </span>
                        <span className="shrink-0 font-mono">
                          {item.published_at ? fmtDateTime(item.published_at, tzZone) : "Baru saja"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-zinc-600 dark:text-zinc-300 text-xs font-medium">
                Tidak ada laporan yang sesuai dengan filter kategori &ldquo;{activeCategory}&rdquo;.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
