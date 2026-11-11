"use client";

import React, { useState, useEffect } from "react";
import {
  fetchIndonesiaGeo,
  fetchRegionalDetail,
  IndonesiaGeoOverview,
  JabodetabekRegionGeo,
  ProvinceGeo,
} from "@/lib/api";
import {
  MapPin,
  Layers,
  Search,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Flame,
  Radio,
} from "lucide-react";
import { ThreatLevelPill, SentimentBadge } from "./RadarUi";

export function IndonesiaMap() {
  const [geoData, setGeoData] = useState<IndonesiaGeoOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>("31.74"); // Default to Jakarta Selatan
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"jabodetabek" | "indonesia">("jabodetabek");

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

  // Filter Jabodetabek regions
  const filteredJabodetabek = (geoData?.jabodetabek_regions || []).filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.nama.toLowerCase().includes(q) ||
      r.provinsi.toLowerCase().includes(q) ||
      r.kode.includes(q)
    );
  });

  // Selected region object
  const activeRegion = geoData?.jabodetabek_regions.find(
    (r) => r.kode === selectedRegionCode
  );

  return (
    <div className="space-y-6">
      {/* Top Map Mode Switcher & Tactical Info */}
      <div className="panel p-4 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("jabodetabek")}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
              activeTab === "jabodetabek"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            FOKUS JABODETABEK (HEATMAP LIVE)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("indonesia")}
            className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
              activeTab === "indonesia"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            PETA NUSANTARA (38 PROVINSI)
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-zinc-900 dark:bg-white" />
            Area Pilot Aktif
          </span>
          <span className="flex items-center gap-1.5 ml-3">
            <span className="w-2.5 h-2.5 rounded bg-zinc-300 dark:bg-zinc-800" />
            Fase 2 (Abu-abu / Belum Fokus)
          </span>
        </div>
      </div>

      {/* Main Grid: Interactive Map Visualizer + Regional Drill-down Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tactical Map Canvas (7 cols) */}
        <div className="lg:col-span-7 panel p-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                {activeTab === "jabodetabek"
                  ? "HEATMAP INTENSITAS INSIDEN JABODETABEK"
                  : "SEBARAN WILAYAH NUSANTARA (INDONESIA ARCHIPELAGO)"}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              STANDAR KEMENDAGRI
            </span>
          </div>

          {activeTab === "jabodetabek" ? (
            /* Jabodetabek Heatmap Interactive Grid */
            <div className="space-y-4">
              {/* Search filter input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Cari Kota / Kabupaten di Jabodetabek (contoh: Jakarta Selatan, Depok, Bekasi)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs font-mono rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Tactical Cards of Jabodetabek Regions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
                {filteredJabodetabek.map((reg) => {
                  const isSelected = selectedRegionCode === reg.kode;
                  const isCritical = reg.threat_level === "kritis";

                  return (
                    <button
                      key={reg.kode}
                      type="button"
                      onClick={() => setSelectedRegionCode(reg.kode)}
                      className={`text-left p-3.5 rounded-lg border transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-900 shadow-md ring-1 ring-zinc-900 dark:ring-white"
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
                            reg.threat_level === "kritis"
                              ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                              : reg.threat_level === "tinggi"
                              ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                              : reg.threat_level === "waspada"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {reg.threat_level.toUpperCase()}
                        </span>
                      </div>

                      {/* Heat intensity bar */}
                      <div className="mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800/80">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                          <span className="text-zinc-500">
                            {reg.mention_count} Laporan
                          </span>
                          <span className="text-zinc-500">
                            Topik: {reg.dominant_topic}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isCritical
                                ? "bg-red-500"
                                : "bg-zinc-900 dark:bg-white"
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
          ) : (
            /* Indonesia 38 Provinces Full Archipelago Grid (Non-pilot grayed out) */
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                Dokumentasi PRD: Wilayah nusantara selain Jabodetabek tampil berwarna abu-abu (Fase 2) karena fokus pengawasan saat ini adalah DKI Jakarta, Bodetabek, dan Tangerang Raya.
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {(geoData?.provinces || []).map((prov) => {
                  const isFocus = prov.is_focus;
                  return (
                    <div
                      key={prov.kode}
                      className={`p-2.5 rounded-md border text-xs font-mono transition-colors ${
                        isFocus
                          ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-bold cursor-pointer"
                          : "bg-zinc-100/60 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-900 text-zinc-400 dark:text-zinc-600 opacity-75"
                      }`}
                      title={prov.keterangan}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span>{prov.kode}</span>
                        <span>{prov.pulau}</span>
                      </div>
                      <div className="font-semibold text-xs mt-1 truncate">
                        {prov.nama}
                      </div>
                      <div className="mt-1 text-[10px]">
                        {isFocus ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            ● Pilot Operasional
                          </span>
                        ) : (
                          <span className="text-zinc-400">
                            ○ Fase 2 (Belum Fokus)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Deep Regional Drill-Down & Verified Issues (5 cols) */}
        <div className="lg:col-span-5 panel p-5 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                DETAIL WILAYAH &amp; ANTREAN ISU
              </h3>
            </div>
            {activeRegion && (
              <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
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
                  <span className="text-lg font-bold text-zinc-900 dark:text-white">
                    {selectedDetail.total_articles}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-400 block text-[10px]">ISU AKTIF</span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-white">
                    {selectedDetail.total_issues}
                  </span>
                </div>
              </div>

              {/* Matched Priority Issues */}
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
