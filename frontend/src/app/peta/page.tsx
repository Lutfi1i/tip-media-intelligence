"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchDashboardSummary, RegionSummary } from "@/lib/api";

export default function PetaWilayahPage() {
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardSummary();
      setRegions(data.regions);
      const sorted = [...data.regions].sort(
        (a: RegionSummary, b: RegionSummary) => b.mention_count - a.mention_count
      );
      setSelectedRegion(sorted[0] || null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data sebaran wilayah");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTierStyle = (tier: string, isSelected: boolean) => {
    if (isSelected) {
      return "bg-sky-500/20 border-sky-400 text-white ring-2 ring-sky-400/80 shadow-md shadow-sky-500/10";
    }
    switch (tier) {
      case ">=60":
        return "bg-sky-950/70 text-sky-200 border-sky-600/70 hover:border-sky-400";
      case "30-59":
        return "bg-blue-950/60 text-blue-200 border-blue-700/60 hover:border-blue-500";
      case "15-29":
        return "bg-[#16203C] text-slate-200 border-[#1E2A4A] hover:border-slate-500";
      default:
        return "bg-[#10172E] text-slate-300 border-[#1E2A4A] hover:border-slate-600";
    }
  };

  if (loading) {
    return (
      <div className="panel p-12 text-center">
        <div className="inline-block w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-200">
          Memindai Sebaran Wilayah Kemendagri...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel border-red-500/40 p-8 max-w-lg mx-auto my-8 bg-red-950/20">
        <h2 className="text-base font-bold text-red-400">Gagal Memuat Peta Wilayah</h2>
        <p className="text-xs text-slate-300 mt-1 mb-4">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="min-h-[40px] px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-[#1E2A4A]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono font-bold tracking-widest uppercase text-sky-400">
            GEOGRAPHIC RADAR &bull; SEBARAN INSIDEN
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
            Sebaran Wilayah &amp; Deteksi Titik Panas
          </h1>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Agregasi Data: 24 Jam Terakhir
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: Schematic Tactical Radar Grid */}
        <section className="lg:col-span-7 panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#1E2A4A]">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Matriks Skematis DKI Jakarta &amp; Bodetabek
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik petak wilayah untuk melihat detail metrik dan isu aktif
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                11 WILAYAH
              </span>
            </div>

            {/* Tactical Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto my-3">
              {/* Row 1 */}
              <div className="hidden sm:block" />
              <div>{renderRegionTile("Jakarta Utara", "Jakut")}</div>
              <div className="hidden sm:block" />
              <div className="hidden sm:block" />

              {/* Row 2 */}
              <div>{renderRegionTile("Jakarta Barat", "Jakbar")}</div>
              <div>{renderRegionTile("Jakarta Pusat", "Jakpus")}</div>
              <div>{renderRegionTile("Jakarta Timur", "Jaktim")}</div>
              <div>{renderRegionTile("Bekasi", "Bekasi")}</div>

              {/* Row 3 */}
              <div className="hidden sm:block" />
              <div>{renderRegionTile("Jakarta Selatan", "Jaksel")}</div>
              <div>{renderRegionTile("Tangerang", "Tangerang")}</div>
              <div className="hidden sm:block" />

              {/* Row 4 */}
              <div className="hidden sm:block" />
              <div>{renderRegionTile("Depok", "Depok")}</div>
              <div>{renderRegionTile("Bogor", "Bogor")}</div>
              <div>{renderRegionTile("Tangerang Selatan", "Tangsel")}</div>
            </div>
          </div>

          {/* Tactical Legend */}
          <div className="mt-8 pt-4 border-t border-[#1E2A4A] flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-mono text-[11px]">Kepadatan Sebaran:</span>
            <div className="flex items-center space-x-3 text-[11px] font-mono">
              <span className="inline-flex items-center text-slate-300">
                <span className="w-3 h-3 rounded bg-[#10172E] border border-[#1E2A4A] mr-1.5" />
                &lt;15
              </span>
              <span className="inline-flex items-center text-slate-300">
                <span className="w-3 h-3 rounded bg-[#16203C] border border-[#1E2A4A] mr-1.5" />
                15-29
              </span>
              <span className="inline-flex items-center text-blue-300">
                <span className="w-3 h-3 rounded bg-blue-900 border border-blue-600 mr-1.5" />
                30-59
              </span>
              <span className="inline-flex items-center text-sky-300 font-bold">
                <span className="w-3 h-3 rounded bg-sky-800 border border-sky-400 mr-1.5" />
                &ge;60
              </span>
            </div>
          </div>
        </section>

        {/* Right 5 Cols: Tactical Region Intel Panel */}
        <section className="lg:col-span-5 panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2A4A]">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-sky-400">
                  DETAIL SINYAL WILAYAH
                </span>
                <h2 className="text-base font-black text-white mt-0.5">
                  {selectedRegion ? selectedRegion.nama : "Pilih Wilayah"}
                </h2>
              </div>
              {selectedRegion && (
                <span className="font-mono text-xs px-2 py-0.5 bg-[#16203C] text-slate-300 rounded border border-[#1E2A4A]">
                  Kode {selectedRegion.kode_wilayah}
                </span>
              )}
            </div>

            {selectedRegion ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#16203C] p-3.5 rounded-lg border border-[#1E2A4A]">
                    <div className="text-[11px] font-mono text-slate-400 uppercase">
                      Total Berita Terkait
                    </div>
                    <div className="text-2xl font-black font-mono text-sky-400 mt-1">
                      {selectedRegion.mention_count}
                    </div>
                  </div>

                  <div className="bg-[#16203C] p-3.5 rounded-lg border border-[#1E2A4A]">
                    <div className="text-[11px] font-mono text-slate-400 uppercase">
                      Sentimen Negatif
                    </div>
                    <div
                      className={`text-2xl font-black font-mono mt-1 ${
                        selectedRegion.sentiment_negative_pct > 50
                          ? "text-red-400"
                          : "text-slate-200"
                      }`}
                    >
                      {selectedRegion.sentiment_negative_pct}%
                    </div>
                  </div>
                </div>

                <div className="bg-[#16203C] p-4 rounded-lg border border-[#1E2A4A] space-y-3">
                  <div>
                    <div className="text-[11px] font-mono text-slate-400 uppercase">
                      Isu Dominan / Terkini
                    </div>
                    <div className="text-sm font-bold text-slate-200 mt-1">
                      {selectedRegion.top_issue || "Situasi aman dan kondusif"}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1E2A4A] flex items-center justify-between text-xs">
                    <span className="text-slate-400">Keyakinan Lokasi Gazetir:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {Math.round(selectedRegion.confidence * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Koordinat Pusat:</span>
                    <span className="font-mono text-slate-300">
                      {selectedRegion.lat.toFixed(4)}, {selectedRegion.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-10 text-center">
                Pilih salah satu kotak wilayah pada radar untuk melihat telemetri.
              </p>
            )}
          </div>

          {selectedRegion && (
            <div className="mt-6 pt-4 border-t border-[#1E2A4A]">
              <Link
                href={`/isu?wilayah=${encodeURIComponent(selectedRegion.nama)}`}
                className="w-full min-h-[42px] inline-flex items-center justify-center py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Telusuri Isu di {selectedRegion.nama} &rarr;
              </Link>
            </div>
          )}
        </section>
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
        type="button"
        onClick={() => reg && setSelectedRegion(reg)}
        className={`w-full min-h-[76px] p-3 rounded-xl border text-left transition-all cursor-pointer relative ${getTierStyle(
          tier,
          isSelected
        )}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold">{shortLabel}</span>
          {count > 0 && (
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          )}
        </div>
        <div className="text-xl font-black font-mono mt-1 leading-tight">
          {count}
        </div>
      </button>
    );
  }
}
