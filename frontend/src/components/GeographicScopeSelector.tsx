"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  fetchGeoHierarchy,
  searchGeoLocations,
  GeoHierarchyResponse,
  GeoSearchResult,
} from "@/lib/api";

interface GeographicScopeSelectorProps {
  currentScopeKode: string;
  currentScopeName: string;
  currentScopeMode: "context" | "strict" | "regional";
  multiCodes: string[];
  isMultiSelect: boolean;
  onApplyScope: (scopeKode: string, scopeName: string, scopeMode: "context" | "strict" | "regional", multiCodesList?: string[]) => void;
  onToggleMultiSelect: (enabled: boolean) => void;
  dataCoverage?: {
    total_collected: number;
    relevant_to_scope: number;
    uncertain_count: number;
    direct_count: number;
  };
}

const QUICK_FOCUS_CITIES: { kode: string; nama: string; label: string }[] = [
  { kode: "ID", nama: "Seluruh Indonesia", label: "Nasional" },
  { kode: "32.01", nama: "Kabupaten Bogor (Jawa Barat)", label: "Kab. Bogor" },
  { kode: "32.71", nama: "Kota Bogor (Jawa Barat)", label: "Kota Bogor" },
  { kode: "32.76", nama: "Kota Depok (Jawa Barat)", label: "Kota Depok" },
  { kode: "32.75", nama: "Kota Bekasi (Jawa Barat)", label: "Kota Bekasi" },
  { kode: "32.73", nama: "Kota Bandung (Jawa Barat)", label: "Kota Bandung" },
  { kode: "31.74", nama: "Jakarta Selatan (DKI Jakarta)", label: "Jaksel" },
  { kode: "33.74", nama: "Kota Semarang (Jawa Tengah)", label: "Semarang" },
  { kode: "35.78", nama: "Kota Surabaya (Jawa Timur)", label: "Surabaya" },
  { kode: "12.71", nama: "Kota Medan (Sumatera Utara)", label: "Medan" },
];

export function GeographicScopeSelector({
  currentScopeKode,
  currentScopeName,
  currentScopeMode,
  multiCodes,
  isMultiSelect,
  onApplyScope,
  onToggleMultiSelect,
  dataCoverage,
}: GeographicScopeSelectorProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<GeoSearchResult[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [hierarchy, setHierarchy] = useState<GeoHierarchyResponse | null>(null);

  // Cascading selections
  const [selectedProvinsi, setSelectedProvinsi] = useState<string>("32"); // Default Jawa Barat
  const [selectedKabupaten, setSelectedKabupaten] = useState<string>("32.01"); // Default Kab Bogor
  const [selectedKecamatan, setSelectedKecamatan] = useState<string>("32.01.01"); // Default Cibinong
  const [selectedKelurahan, setSelectedKelurahan] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<"context" | "strict" | "regional">(currentScopeMode);

  // Multi-region selection list
  const [selectedMulti, setSelectedMulti] = useState<string[]>(multiCodes.length > 0 ? multiCodes : ["32.01.01", "32.01.02", "32.01.03"]);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load master hierarchy
  useEffect(() => {
    fetchGeoHierarchy()
      .then((data) => setHierarchy(data))
      .catch((err) => console.error("Gagal memuat master hierarki wilayah:", err));
  }, []);

  const runGeoSearch = async (q: string) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await searchGeoLocations(q);
      setSearchResults(res);
      setHighlightedIndex(0);
      setIsDropdownOpen(true);
      return res;
    } catch {
      setSearchError("Gagal mencari wilayah. Periksa koneksi backend.");
      setSearchResults([]);
      setIsDropdownOpen(true);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  // Search autocomplete handler
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSearchError(null);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      void runGeoSearch(val.trim());
    }, 180);
  };

  const handleSelectSearchResult = (item: GeoSearchResult) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearchQuery("");
    setSearchResults([]);
    setIsDropdownOpen(false);
    setSearchError(null);
    const cleanKonteks = item.konteks.replace(/&bull;/g, "•");
    const displayName = item.kode === "ID" ? item.nama : `${item.nama} (${cleanKonteks})`;
    onApplyScope(item.kode, displayName, selectedMode);
    setIsExpanded(false);
  };

  const handleFocusSubmit = async () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchResults.length > 0 && isDropdownOpen) {
      const target = searchResults[highlightedIndex] || searchResults[0];
      handleSelectSearchResult(target);
      return;
    }
    const res = await runGeoSearch(searchQuery.trim());
    if (res.length > 0) {
      handleSelectSearchResult(res[0]);
    }
  };

  const handleApplyCascading = () => {
    let finalCode = "ID";
    let finalName = "Seluruh Indonesia";

    if (selectedKelurahan) {
      finalCode = selectedKelurahan;
      const kel = hierarchy?.kelurahan.find((k) => k.kode === selectedKelurahan);
      finalName = kel ? `Kelurahan ${kel.nama}, Kec. ${kel.kecamatan_nama}` : `Kelurahan (${selectedKelurahan})`;
    } else if (selectedKecamatan) {
      finalCode = selectedKecamatan;
      const kec = hierarchy?.kecamatan.find((k) => k.kode === selectedKecamatan);
      finalName = kec ? `Kecamatan ${kec.nama}, ${kec.kabupaten_nama}` : `Kecamatan (${selectedKecamatan})`;
    } else if (selectedKabupaten) {
      finalCode = selectedKabupaten;
      const kab = hierarchy?.kabupaten.find((k) => k.kode === selectedKabupaten);
      finalName = kab ? `${kab.nama}, ${kab.provinsi_nama}` : `Kabupaten (${selectedKabupaten})`;
    } else if (selectedProvinsi) {
      finalCode = selectedProvinsi;
      const prov = hierarchy?.provinces.find((p) => p.kode === selectedProvinsi);
      finalName = prov ? `Provinsi ${prov.nama}` : `Provinsi (${selectedProvinsi})`;
    }

    if (isMultiSelect) {
      onApplyScope("MULTI", `Multi-Wilayah (${selectedMulti.length} Terpilih)`, selectedMode, selectedMulti);
    } else {
      onApplyScope(finalCode, finalName, selectedMode);
    }
    setIsExpanded(false);
  };

  const handleResetNational = () => {
    setSelectedProvinsi("");
    setSelectedKabupaten("");
    setSelectedKecamatan("");
    setSelectedKelurahan("");
    onApplyScope("ID", "Seluruh Indonesia", "context");
    setIsExpanded(false);
  };

  // Filter options for cascading dropdowns
  const kabupatenOptions = hierarchy?.kabupaten.filter((k) => !selectedProvinsi || k.provinsi_kode === selectedProvinsi) || [];
  const kecamatanOptions = hierarchy?.kecamatan.filter((k) => !selectedKabupaten || k.kabupaten_kode === selectedKabupaten) || [];
  const kelurahanOptions = hierarchy?.kelurahan.filter((k) => !selectedKecamatan || k.kecamatan_kode === selectedKecamatan) || [];

  return (
    <div className="relative rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-all">
      {/* ACTIVE GEOGRAPHIC SCOPE BAR */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white shadow-md shadow-fuchsia-500/20">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Cakupan Geografis Aktif
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-3xs font-bold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {currentScopeKode === "ID" ? "NASIONAL" : currentScopeKode.length > 5 ? "KECAMATAN / LOKAL" : "REGIONAL"}
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <span>{currentScopeName}</span>
              {currentScopeKode !== "ID" && (
                <span className="font-mono text-xs font-normal text-zinc-400">({currentScopeKode})</span>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-2xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              <span>
                Mode: <strong className="text-zinc-700 dark:text-zinc-200 uppercase">{currentScopeMode === "context" ? "Wilayah + Konteks" : currentScopeMode === "strict" ? "Lokasi Ketat" : "Konteks Regional"}</strong>
              </span>
              {dataCoverage && (
                <>
                  <span>&bull;</span>
                  <span>{dataCoverage.relevant_to_scope} konten terverifikasi wilayah ({dataCoverage.direct_count} bukti langsung)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Toggle Button */}
        <div className="flex items-center gap-2.5 self-start lg:self-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-2xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-zinc-200 dark:border-zinc-700"
          >
            <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>{isExpanded ? "Tutup Hierarki" : "Hierarki Kemendagri"}</span>
          </button>
          {currentScopeKode !== "ID" && (
            <button
              onClick={handleResetNational}
              className="rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40 transition-colors"
              title="Reset ke Seluruh Indonesia"
            >
              Reset Nasional
            </button>
          )}
        </div>
      </div>

      {/* PENCARIAN & FOKUS KABUPATEN / KOTA */}
      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-fuchsia-600 text-white shadow-2xs">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <label htmlFor="kabkota-search-input" className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Pencarian Fokus Kabupaten / Kota
            </label>
            <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 font-mono text-3xs font-bold text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/20">
              KAB/KOTA INDONESIA
            </span>
          </div>
          <span className="text-2xs text-zinc-500 dark:text-zinc-400">
            Ketik atau pilih kota/kabupaten untuk menyaring isu &amp; tren medsos
          </span>
        </div>

        {/* Quick-focus chips untuk kota/kabupaten utama */}
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Fokus cepat kota dan kabupaten">
          {QUICK_FOCUS_CITIES.map((city) => {
            const active = currentScopeKode === city.kode;
            return (
              <button
                key={city.kode}
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onApplyScope(city.kode, city.nama, selectedMode);
                }}
                className={`rounded-lg px-2.5 py-1 text-2xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 ${
                  active
                    ? "bg-fuchsia-600 text-white shadow-xs"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:border-fuchsia-700 dark:hover:bg-fuchsia-950/40"
                }`}
              >
                {city.label}
              </button>
            );
          })}
        </div>

        {/* Search Input Bar with Instant Autocomplete */}
        <div className="relative" ref={searchContainerRef}>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 flex items-center text-zinc-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="kabkota-search-input"
              type="text"
              role="combobox"
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
              value={searchQuery}
              onFocus={() => {
                void runGeoSearch(searchQuery.trim());
              }}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && searchResults.length > 0) {
                  e.preventDefault();
                  setIsDropdownOpen(true);
                  setHighlightedIndex((prev) => (prev + 1) % searchResults.length);
                } else if (e.key === "ArrowUp" && searchResults.length > 0) {
                  e.preventDefault();
                  setIsDropdownOpen(true);
                  setHighlightedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  void handleFocusSubmit();
                } else if (e.key === "Escape") {
                  setIsDropdownOpen(false);
                }
              }}
              placeholder="Ketik nama kabupaten atau kota (contoh: Kabupaten Bogor, Kota Depok, Bandung, Surabaya, Medan, Makassar)..."
              className="w-full rounded-xl border border-zinc-300/90 bg-zinc-50/80 pl-10 pr-28 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 shadow-inner focus:border-fuchsia-500 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/40 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-white dark:focus:bg-zinc-900 transition-all font-medium"
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchError(null);
                    setIsDropdownOpen(false);
                  }}
                  className="rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
                  title="Bersihkan"
                  aria-label="Bersihkan pencarian"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleFocusSubmit()}
                disabled={isSearching}
                className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-fuchsia-500 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
              >
                {isSearching ? (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                <span>Fokuskan</span>
              </button>
            </div>
          </div>

          {/* Autocomplete Dropdown List */}
          {isDropdownOpen && (
            <div className="absolute z-40 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 ring-1 ring-black/5">
              {searchError ? (
                <div className="px-3 py-3 text-xs text-rose-600 dark:text-rose-400">
                  {searchError}
                </div>
              ) : isSearching && searchResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Mencari kabupaten / kota...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Wilayah &quot;{searchQuery}&quot; tidak ditemukan. Coba kata kunci lain seperti Bandung, Surabaya, Semarang, atau Depok.
                </div>
              ) : (
                <>
                  <div className="px-2.5 py-1 text-3xs font-mono font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 mb-1 flex items-center justify-between">
                    <span>{searchQuery.trim() ? "Hasil Kabupaten / Kota Ditemukan" : "Rekomendasi Fokus Wilayah"}</span>
                    <span>Klik atau Tekan Enter</span>
                  </div>
                  {searchResults.map((item, idx) => {
                    const isKab = item.nama.toLowerCase().includes("kabupaten");
                    const isKota = item.nama.toLowerCase().includes("kota");
                    const isNasional = item.kode === "ID";
                    const isHighlighted = idx === highlightedIndex;

                    return (
                      <button
                        key={item.kode}
                        type="button"
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleSelectSearchResult(item)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors group ${
                          isHighlighted
                            ? "bg-fuchsia-50 dark:bg-fuchsia-950/50"
                            : "hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${isKota ? "bg-indigo-500" : isKab ? "bg-sky-500" : isNasional ? "bg-emerald-500" : "bg-zinc-400"}`} />
                          <div>
                            <span className="font-bold text-zinc-900 group-hover:text-fuchsia-700 dark:text-zinc-100 dark:group-hover:text-fuchsia-300">
                              {item.nama}
                            </span>
                            <p className="text-2xs text-zinc-500 dark:text-zinc-400">
                              {item.konteks.replace(/&bull;/g, "•")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 font-mono text-3xs font-bold ${
                            isKota
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                              : isKab
                              ? "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                              : isNasional
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}>
                            {item.tingkat.toUpperCase()} &bull; {item.kode}
                          </span>
                          <svg className="w-3.5 h-3.5 text-zinc-300 group-hover:text-fuchsia-600 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EXPANDABLE SCOPE CONFIGURATION PANEL */}
      {isExpanded && (
        <div className="mt-5 space-y-5 rounded-xl border border-zinc-200 bg-zinc-50/75 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          {/* CASCADING ADMINISTRATIVE HIERARCHY SELECTOR */}
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              1. Hierarki Administrasi Resmi Kemendagri
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Provinsi */}
              <div>
                <span className="text-2xs font-semibold text-zinc-500">Provinsi:</span>
                <select
                  value={selectedProvinsi}
                  onChange={(e) => {
                    setSelectedProvinsi(e.target.value);
                    setSelectedKabupaten("");
                    setSelectedKecamatan("");
                    setSelectedKelurahan("");
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">-- Semua Provinsi --</option>
                  {hierarchy?.provinces.map((p) => (
                    <option key={p.kode} value={p.kode}>
                      {p.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kabupaten / Kota */}
              <div>
                <span className="text-2xs font-semibold text-zinc-500">Kabupaten / Kota:</span>
                <select
                  value={selectedKabupaten}
                  onChange={(e) => {
                    setSelectedKabupaten(e.target.value);
                    setSelectedKecamatan("");
                    setSelectedKelurahan("");
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">-- Semua Kabupaten/Kota --</option>
                  {kabupatenOptions.map((k) => (
                    <option key={k.kode} value={k.kode}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kecamatan */}
              <div>
                <span className="text-2xs font-semibold text-zinc-500">Kecamatan:</span>
                <select
                  value={selectedKecamatan}
                  onChange={(e) => {
                    setSelectedKecamatan(e.target.value);
                    setSelectedKelurahan("");
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">-- Semua Kecamatan --</option>
                  {kecamatanOptions.map((kc) => (
                    <option key={kc.kode} value={kc.kode}>
                      {kc.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Kelurahan / Desa */}
              <div>
                <span className="text-2xs font-semibold text-zinc-500">Kelurahan / Desa:</span>
                <select
                  value={selectedKelurahan}
                  onChange={(e) => setSelectedKelurahan(e.target.value)}
                  disabled={kelurahanOptions.length === 0}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 shadow-2xs disabled:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">-- Semua Kelurahan/Desa --</option>
                  {kelurahanOptions.map((kl) => (
                    <option key={kl.kode} value={kl.kode}>
                      {kl.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* FILTER MODES & MULTI-REGION TOGGLES */}
          <div className="flex flex-col gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <span className="text-2xs font-bold uppercase tracking-wider text-zinc-500">
                3. Mode Penapisan Geografis (FR-GEO-03)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "context", label: "Wilayah + Konteks", desc: "Sebut nama, jalan, kelurahan, atau landmark lokal (Default)" },
                  { id: "strict", label: "Lokasi Ketat", desc: "Hanya konten ber-geotag / bukti langsung tak terbantahkan" },
                  { id: "regional", label: "Konteks Regional", desc: "Memperluas ke isu kabupaten sekitar yang berdampak" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMode(m.id as any)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      selectedMode === m.id
                        ? "bg-fuchsia-600 text-white shadow-2xs"
                        : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 ring-1 ring-zinc-200 dark:ring-zinc-700"
                    }`}
                    title={m.desc}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply & Cancel Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleApplyCascading}
                className="rounded-xl bg-fuchsia-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-fuchsia-500 transition-all"
              >
                Terapkan Wilayah
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="rounded-xl bg-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
