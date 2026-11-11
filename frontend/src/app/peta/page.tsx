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

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case ">=60":
        return "bg-[#1E3A8A] text-white border-[#1E3A8A]";
      case "30-59":
        return "bg-[#2563EB] text-white border-[#2563EB]";
      case "15-29":
        return "bg-[#BFDBFE] text-slate-900 border-[#93C5FD]";
      default:
        return "bg-[#EFF6FF] text-slate-900 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Memuat peta skematis sebaran mention DKI Jakarta &amp; Bodetabek...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-8 max-w-lg mx-auto my-8">
        <h2 className="text-base font-bold text-red-900">
          Gagal Memuat Peta Wilayah
        </h2>
        <p className="text-sm text-slate-600 mt-1 mb-4">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-wider uppercase text-blue-700">
          Peta Wilayah
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
          Di mana isu paling ramai dibicarakan
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Schematic Choropleth Map matching Slide 9 */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-slate-900">
                Sebaran mention per wilayah &middot; 24 jam (peta skematis)
              </h2>
              <span className="text-xs text-slate-500">
                Klik wilayah untuk detail
              </span>
            </div>

            {/* 4-Column Schematic Layout matching Slide 9 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto my-2">
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
              <div className="hidden sm:block" />
              <div className="hidden sm:block" />

              {/* Row 4 */}
              <div className="hidden sm:block" />
              <div>{renderRegionTile("Depok", "Depok")}</div>
              <div>{renderRegionTile("Bogor", "Bogor")}</div>
              <div className="hidden sm:block" />
            </div>
          </div>

          {/* Legend matching Slide 9 */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-5 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#EFF6FF] border border-slate-300 mr-1.5" />
              &lt;15
            </span>
            <span className="inline-flex items-center">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#BFDBFE] mr-1.5" />
              15&ndash;29
            </span>
            <span className="inline-flex items-center">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#2563EB] mr-1.5" />
              30&ndash;59
            </span>
            <span className="inline-flex items-center">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#1E3A8A] mr-1.5" />
              &ge;60
            </span>
          </div>
        </section>

        {/* Right 5 Cols: Region Detail Card matching Slide 9 */}
        <section className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100">
              Detail: {selectedRegion ? selectedRegion.nama : "Pilih Wilayah"}
            </h2>

            {selectedRegion ? (
              <dl className="divide-y divide-slate-100 text-sm mt-2">
                <div className="py-3.5 flex items-center justify-between">
                  <dt className="text-slate-500">Mention</dt>
                  <dd className="font-extrabold text-slate-900 text-base">
                    {selectedRegion.mention_count}
                  </dd>
                </div>
                <div className="py-3.5 flex items-center justify-between">
                  <dt className="text-slate-500">Konten unik</dt>
                  <dd className="font-extrabold text-slate-900 text-base">
                    {selectedRegion.unique_content_count}
                  </dd>
                </div>
                <div className="py-3.5 flex items-center justify-between">
                  <dt className="text-slate-500">Sentimen negatif</dt>
                  <dd className="font-extrabold text-slate-900 text-base">
                    {selectedRegion.sentiment_negative_pct}%
                  </dd>
                </div>
                <div className="py-3.5 flex items-center justify-between">
                  <dt className="text-slate-500">Isu utama</dt>
                  <dd className="font-extrabold text-slate-900 text-right">
                    {selectedRegion.top_issue || "Kondusif"}
                  </dd>
                </div>
                <div className="py-3.5 flex items-center justify-between">
                  <dt className="text-slate-500">Keyakinan lokasi</dt>
                  <dd className="font-extrabold text-slate-900 font-mono">
                    {selectedRegion.confidence.toFixed(2).replace(".", ",")}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500 py-8">
                Pilih salah satu kotak wilayah di samping untuk melihat rincian.
              </p>
            )}
          </div>

          {selectedRegion && (
            <div className="mt-6 pt-2">
              <Link
                href={`/isu?wilayah=${encodeURIComponent(selectedRegion.nama)}`}
                className="w-full min-h-[44px] inline-flex items-center justify-center py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                Buka isu terkait
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
        className={`w-full min-h-[78px] p-3.5 rounded-xl border text-left transition-all cursor-pointer ${getTierStyle(
          tier
        )} ${
          isSelected
            ? "ring-2 ring-offset-2 ring-blue-600"
            : "hover:opacity-95"
        }`}
      >
        <div className="text-xs font-semibold opacity-90">{shortLabel}</div>
        <div className="text-2xl font-extrabold leading-tight mt-1">{count}</div>
      </button>
    );
  }
}
