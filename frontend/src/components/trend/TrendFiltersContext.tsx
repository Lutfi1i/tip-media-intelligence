"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_TREND_FILTERS,
  parseTrendFilters,
  TrendFilters,
  trendFiltersToSearch,
} from "@/lib/trendFilters";

interface Ctx {
  filters: TrendFilters;
  ready: boolean;
  setFilters: (patch: Partial<TrendFilters>) => void;
}

const TrendFiltersCtx = createContext<Ctx | null>(null);

/**
 * Dipasang di layout /tren sehingga filter bertahan saat pindah antarmenu tren.
 * URL ikut diperbarui agar refresh dan tautan yang dibagikan membawa filter yang sama.
 */
export function TrendFiltersProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [filters, setState] = useState<TrendFilters>(DEFAULT_TREND_FILTERS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(parseTrendFilters(window.location.search));
    setReady(true);
  }, []);

  // Tautan menu tidak membawa query string, jadi tulis ulang setiap kali filter atau halaman berubah.
  useEffect(() => {
    if (!ready) return;
    const search = trendFiltersToSearch(filters);
    if (window.location.search !== search) {
      window.history.replaceState(null, "", `${window.location.pathname}${search}`);
    }
  }, [filters, pathname, ready]);

  const setFilters = useCallback((patch: Partial<TrendFilters>) => {
    setState((f) => ({ ...f, ...patch }));
  }, []);

  return <TrendFiltersCtx.Provider value={{ filters, ready, setFilters }}>{children}</TrendFiltersCtx.Provider>;
}

export function useTrendFilters(): Ctx {
  const ctx = useContext(TrendFiltersCtx);
  if (!ctx) throw new Error("useTrendFilters harus dipakai di dalam TrendFiltersProvider (layout /tren)");
  return ctx;
}
