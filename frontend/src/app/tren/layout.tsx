"use client";

import { ReactNode } from "react";
import { TrendFiltersProvider } from "@/components/trend/TrendFiltersContext";

export default function TrenLayout({ children }: { children: ReactNode }) {
  return <TrendFiltersProvider>{children}</TrendFiltersProvider>;
}
