"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, AlertCircle, ArrowUpRight, ShieldCheck, RefreshCw, Layers } from "lucide-react";
import { fetchDashboardSummary, RegionSummary } from "@/lib/api";

export default function PetaWilayahPage() {
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardSummary();
      setRegions(data.regions);
      // Select Jakarta Selatan by default as per mockup
      const jaksel = data.regions.find((r: RegionSummary) => r.nama === "Jakarta Selatan");
      setSelectedRegion(jaksel || data.regions[0] || null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data sebaran wilayah");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTierColorClass = (tier: string) => {
    switch (tier) {
      case ">=60":
        return "bg-blue-800 text-white border-blue-900";
      case "30-59":
        return "bg-blue-600 text-white border-blue-700";
      case "15-29":
        return "bg-blue-300 text-blue-950 border-blue-400";
      default:
        return "bg-blue-100 text-blue-900 border-blue-200";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Memuat peta sebaran...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Di Mana Isu Paling Ramai Dibicarakan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            app.tipmedia.id/peta &bull; Visualisasi intensitas sebaran isu per wilayah (24 jam)
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded font-semibold border border-slate-200">
            Data Simulasi
          </span>
        </div>
      </div>

      {/* Main Grid: Schematic Map + Detail Sidebar (Slide 9 Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schematic Choropleth Map */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Sebaran mention per wilayah &bull; 24 jam (peta skematis)
              </h2>
              <div className="text-xs text-slate-500 flex items-center">
                <Layers className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Klik wilayah untuk detail
              </div>
            </div>

            {/* Schematic Grid Map representation of DKI Jakarta & Bodetabek */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 my-4">
              <div className="grid grid-cols-5 gap-3 max-w-xl mx-auto py-4">
                {/* Row 1: Jakut */}
                <div className="col-start-2 col-span-2">
                  {renderRegionTile("Jakarta Utara", "Jakut")}
                </div>

                {/* Row 2: Jakbar, Jakpus, Jaktim, Bekasi */}
                <div className="col-span-1">
                  {renderRegionTile("Jakarta Barat", "Jakbar")}
                </div>
                <div className="col-span-1">
                  {renderRegionTile("Jakarta Pusat", "Jakpus")}
                </div>
                <div className="col-span-1">
                  {renderRegionTile("Jakarta Timur", "Jaktim")}
                </div>
                <div className="col-span-2">
                  {renderRegionTile("Bekasi", "Bekasi")}
                </div>

                {/* Row 3: Jaksel */}
                <div className="col-start-2 col-span-2">
                  {renderRegionTile("Jakarta Selatan", "Jaksel")}
                </div>

                {/* Row 4: Depok, Bogor */}
                <div className="col-start-2 col-span-1">
                  {renderRegionTile("Depok", "Depok")}
                </div>
                <div className="col-start-3 col-span-1">
                  {renderRegionTile("Bogor", "Bogor")}
                </div>
              </div>
            </div>

            {/* Legend Tiers: <15, 15-29, 30-59, >=60 */}
            <div className="flex items-center justify-center space-x-6 pt-3 text-xs font-semibold text-slate-700">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-1.5" />
                <span>&lt; 15</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 bg-blue-300 border border-blue-400 rounded mr-1.5" />
                <span>15&ndash;29</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 bg-blue-600 border border-blue-700 rounded mr-1.5" />
                <span>30&ndash;59</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 bg-blue-800 border border-blue-900 rounded mr-1.5" />
                <span>&ge; 60</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Sumber agregasi: Pengaduan warga, laporan radio lalu lintas, dan portal berita megapolitan.
          </div>
        </div>

        {/* Right Col: Detail Drawer (Slide 9 Mockup) */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Detail: {selectedRegion ? selectedRegion.nama : "Pilih Wilayah"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kode Wilayah Kemendagri: {selectedRegion?.kode_wilayah}
              </p>
            </div>

            {selectedRegion ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                  <span className="text-slate-500 font-medium">Mention</span>
                  <span className="font-extrabold text-slate-900 text-base">
                    {selectedRegion.mention_count}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                  <span className="text-slate-500 font-medium">Konten Unik</span>
                  <span className="font-bold text-slate-900">
                    {selectedRegion.unique_content_count}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                  <span className="text-slate-500 font-medium">Sentimen Negatif</span>
                  <span className="font-bold text-red-600">
                    {selectedRegion.sentiment_negative_pct}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                  <span className="text-slate-500 font-medium">Isu Utama</span>
                  <span className="font-bold text-slate-900 text-right">
                    {selectedRegion.top_issue || "Kondusif"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50 text-sm">
                  <span className="text-slate-500 font-medium">Keyakinan Lokasi</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {selectedRegion.confidence.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-8 text-center">Silakan pilih wilayah pada peta.</p>
            )}
          </div>

          <div className="mt-8">
            {selectedRegion && (
              <Link
                href={`/isu?wilayah=${encodeURIComponent(selectedRegion.nama)}`}
                className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-sm transition-colors"
              >
                Buka Isu Terkait <ArrowUpRight className="w-4 h-4 ml-1.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  function renderRegionTile(fullName: string, shortLabel: string) {
    const reg = regions.find((r) => r.nama === fullName);
    const isSelected = selectedRegion?.nama === fullName;
    const tier = reg?.tier || "<15";
    const count = reg?.mention_count || 0;

    return (
      <button
        onClick={() => reg && setSelectedRegion(reg)}
        className={`w-full py-4 px-2 rounded-lg border text-center transition-all cursor-pointer ${getTierColorClass(
          tier
        )} ${
          isSelected
            ? "ring-4 ring-blue-400 ring-offset-2 scale-105 shadow-md z-20"
            : "hover:scale-102 hover:shadow-sm"
        }`}
      >
        <div className="text-xs font-semibold tracking-wide uppercase">{shortLabel}</div>
        <div className="text-2xl font-extrabold mt-0.5">{count}</div>
      </button>
    );
  }
}
