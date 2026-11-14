"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { fetchGeoHierarchy, GeoHierarchyResponse, GeoSearchResult, searchGeoLocations } from "@/lib/api";

const selectCls =
  "w-full min-h-[38px] rounded-md border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

/** Pemilih lokasi ringkas: Indonesia, provinsi, atau kota/kabupaten. Kecamatan sengaja tidak ditawarkan. */
export function TrendLocationPicker({
  kode,
  nama,
  onChange,
}: {
  kode: string;
  nama: string;
  onChange: (kode: string, nama: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hierarchy, setHierarchy] = useState<GeoHierarchyResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prov, setProv] = useState("");
  const [kab, setKab] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoSearchResult[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || hierarchy) return;
    fetchGeoHierarchy()
      .then(setHierarchy)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Daftar wilayah gagal dimuat"));
  }, [open, hierarchy]);

  // Saat dibuka, posisikan dropdown sesuai lokasi aktif.
  useEffect(() => {
    if (!open) return;
    setProv(kode === "ID" ? "" : kode.slice(0, 2));
    setKab(kode.length > 2 ? kode : "");
    setQ("");
    setResults([]);
  }, [open, kode]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      searchGeoLocations(term).then((r) => {
        if (!cancelled) setResults(r.filter((x) => x.tingkat === "provinsi" || x.tingkat === "kabupaten").slice(0, 8));
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [q]);

  const kabList = useMemo(
    () =>
      (hierarchy?.kabupaten || [])
        .filter((k) => k.provinsi_kode === prov)
        .sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    [hierarchy, prov]
  );

  const choose = (k: string, n: string) => {
    onChange(k, n);
    setOpen(false);
  };

  const apply = () => {
    if (kab) {
      const k = hierarchy?.kabupaten.find((x) => x.kode === kab);
      if (k) return choose(k.kode, k.nama);
    }
    if (prov) {
      const p = hierarchy?.provinces.find((x) => x.kode === prov);
      if (p) return choose(p.kode, p.nama);
    }
    choose("ID", "Indonesia");
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex min-h-[38px] max-w-[16rem] items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
        <span className="truncate">{nama}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pilih lokasi"
          className="absolute left-0 top-11 z-40 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari provinsi atau kota..."
              aria-label="Cari lokasi"
              className={`${selectCls} pl-8`}
            />
          </div>

          {results.length > 0 ? (
            <ul className="max-h-60 overflow-y-auto">
              {results.map((r) => (
                <li key={r.kode}>
                  <button
                    type="button"
                    onClick={() => choose(r.kode, r.nama)}
                    className="w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    <span className="block text-sm text-zinc-900 dark:text-zinc-100">{r.nama}</span>
                    <span className="block text-2xs text-zinc-500">{r.konteks}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              {loadError && <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>}
              <div>
                <label htmlFor="trend-prov" className="mb-1 block text-2xs font-semibold text-zinc-600 dark:text-zinc-400">
                  Provinsi
                </label>
                <select
                  id="trend-prov"
                  value={prov}
                  onChange={(e) => {
                    setProv(e.target.value);
                    setKab("");
                  }}
                  disabled={!hierarchy}
                  className={selectCls}
                >
                  <option value="">Seluruh Indonesia</option>
                  {(hierarchy?.provinces || []).map((p) => (
                    <option key={p.kode} value={p.kode}>
                      {p.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="trend-kab" className="mb-1 block text-2xs font-semibold text-zinc-600 dark:text-zinc-400">
                  Kota / kabupaten
                </label>
                <select
                  id="trend-kab"
                  value={kab}
                  onChange={(e) => setKab(e.target.value)}
                  disabled={!prov || kabList.length === 0}
                  className={selectCls}
                >
                  <option value="">{prov ? "Seluruh provinsi" : "Pilih provinsi dulu"}</option>
                  {kabList.map((k) => (
                    <option key={k.kode} value={k.kode}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => choose("ID", "Indonesia")}
                  className="min-h-[36px] rounded-md px-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="min-h-[36px] rounded-md bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Terapkan
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
