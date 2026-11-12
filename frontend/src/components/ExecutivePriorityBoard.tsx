"use client";

import React from "react";
import Link from "next/link";
import { IssueItem } from "@/lib/api";
import { ThreatLevelPill } from "./RadarUi";
import { MediaAvatarStack } from "./SourceLogos";
import {
  AlertTriangle,
  Building2,
  Clock,
  ArrowUpRight,
  MapPin,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

interface ExecutivePriorityBoardProps {
  issues: IssueItem[];
}

export function ExecutivePriorityBoard({ issues }: ExecutivePriorityBoardProps) {
  const priorityList = (issues || []).slice(0, 6);

  const getInstansi = (kategori?: string) => {
    const k = (kategori || "").toLowerCase();
    if (k.includes("bencana") || k.includes("cuaca")) return "BPBD / Dinas SDA";
    if (k.includes("lalu lintas") || k.includes("transportasi")) return "Dishub DKI / Ditlantas";
    if (k.includes("ekonomi") || k.includes("harga")) return "Dinas Perdagangan & Pasar";
    if (k.includes("keamanan") || k.includes("kriminalitas")) return "Satpol PP & Kepolisian";
    if (k.includes("kesehatan") || k.includes("lingkungan")) return "Dinas Lingkungan Hidup";
    return "OPD Terkait";
  };

  const getSlaHours = (level: string) => {
    if (level === "CRITICAL") return "2 Jam (Darurat)";
    if (level === "HIGH") return "4 Jam (Segera)";
    if (level === "MEDIUM") return "12 Jam";
    return "24 Jam";
  };

  return (
    <div className="panel p-6 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-4">
      {/* Header Board */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-900">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold font-mono text-zinc-900 dark:text-white uppercase tracking-wider">
              PAPAN PRIORITAS EKSEKUTIF (EXECUTIVE PRIORITY BOARD)
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Daftar isu prioritas terkluster berorientasi tindakan &amp; penetapan batas respon (SLA)
          </p>
        </div>

        <Link
          href="/isu"
          className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:underline self-start sm:self-auto"
        >
          Buka Antrean Lengkap ({issues.length} Isu) &rarr;
        </Link>
      </div>

      {/* Table / Card List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800/80 text-[11px] font-mono font-bold text-zinc-400 uppercase">
              <th className="py-2.5 px-3">Isu &amp; Wilayah</th>
              <th className="py-2.5 px-3">Tingkat Risiko</th>
              <th className="py-2.5 px-3">Penanggung Jawab (PIC)</th>
              <th className="py-2.5 px-3">Batas Waktu (SLA)</th>
              <th className="py-2.5 px-3">Status Verifikasi</th>
              <th className="py-2.5 px-3 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {priorityList.map((item) => {
              const instansi = getInstansi(item.kategori);
              const sla = getSlaHours(item.level);

              return (
                <tr
                  key={item.id}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors group"
                >
                  {/* Isu & Wilayah */}
                  <td className="py-3 px-3 max-w-[320px]">
                    <Link
                      href={`/isu/${item.id}`}
                      className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 line-clamp-2 leading-snug"
                    >
                      {item.judul}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      <span className="flex items-center gap-0.5 text-zinc-700 dark:text-zinc-300">
                        <MapPin className="w-3 h-3 text-rose-500" />
                        {item.wilayah}
                      </span>
                      <span>&bull;</span>
                      <span>{item.kategori}</span>
                    </div>
                  </td>

                  {/* Tingkat Risiko */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <ThreatLevelPill level={item.level} score={item.skor} />
                  </td>

                  {/* PIC Instansi */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                      <Building2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      {instansi}
                    </span>
                  </td>

                  {/* SLA */}
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                    <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                      <Clock className="w-3 h-3 text-amber-500" />
                      {sla}
                    </span>
                  </td>

                  {/* Status Verifikasi */}
                  <td className="py-3 px-3 whitespace-nowrap font-mono">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        item.status === "terverifikasi"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                          : item.status === "dikoreksi"
                          ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {item.status === "otomatis" ? "Otomatis" : item.status}
                    </span>
                  </td>

                  {/* Tindakan */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <Link
                      href={`/isu/${item.id}`}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-mono font-bold inline-flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <span>Buka Isu</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
