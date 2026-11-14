"use client";

import { ReactNode } from "react";
import { TrendFilterBar } from "./TrendFilterBar";

/** Judul halaman + filter global, dipakai semua menu Tren Sosial. */
export function TrendPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        {actions}
      </div>
      <TrendFilterBar />
    </div>
  );
}
