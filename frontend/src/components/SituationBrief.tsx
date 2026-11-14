"use client";

import React from "react";
import Link from "next/link";
import { IssueItem } from "@/lib/api";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowRight,
  TrendingUp,
  FileText,
  Building2,
  HelpCircle,
} from "lucide-react";
import { MediaAvatarStack } from "./SourceLogos";

interface SituationBriefProps {
  statusLevel: "NORMAL" | "WASPADA" | "SIAGA" | "KRITIS";
  issues: IssueItem[];
  criticalCount: number;
  highCount: number;
  wilayahCount: number;
  lastUpdated?: Date;
}

export function SituationBrief({
  statusLevel,
  issues,
  criticalCount,
  highCount,
  wilayahCount,
  lastUpdated = new Date(),
}: SituationBriefProps) {
  const top3 = (issues || []).slice(0, 3);

  // Status Badge Palette
  const statusConfig = {
    KRITIS: {
      bg: "bg-rose-500/10 dark:bg-rose-950/40",
      border: "border-rose-500/30",
      text: "text-rose-600 dark:text-rose-400",
      badge: "bg-rose-600 text-white",
      pulse: "bg-rose-500",
      label: "SIAGA KRITIS",
      description: "Terdeteksi anomali darurat keselamatan warga dan gangguan fasilitas umum skala besar.",
    },
    SIAGA: {
      bg: "bg-orange-500/10 dark:bg-orange-950/40",
      border: "border-orange-500/30",
      text: "text-orange-600 dark:text-orange-400",
      badge: "bg-orange-600 text-white",
      pulse: "bg-orange-500",
      label: "STATUS SIAGA",
      description: "Peningkatan volume isu publik berpotensi eskalasi tinggi dalam 24 jam ke depan.",
    },
    WASPADA: {
      bg: "bg-amber-500/10 dark:bg-amber-950/40",
      border: "border-amber-500/30",
      text: "text-amber-600 dark:text-amber-400",
      badge: "bg-amber-600 text-white",
      pulse: "bg-amber-500",
      label: "STATUS WASPADA",
      description: "Terdapat dinamika keluhan publik dan tren bencana lokal yang memerlukan respon taktis.",
    },
    NORMAL: {
      bg: "bg-emerald-500/10 dark:bg-emerald-950/40",
      border: "border-emerald-500/30",
      text: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-600 text-white",
      pulse: "bg-emerald-500",
      label: "STATUS KONDUSIF",
      description: "Seluruh wilayah terpantau aman terkendali. Tidak ada anomali atau ancaman mendesak.",
    },
  };

  const currentStatus = statusConfig[statusLevel] || statusConfig.WASPADA;

  // Map instansi penanggung jawab berdasarkan topik isu
  const getInstansiTerkait = (kategori?: string, wilayah?: string) => {
    const k = (kategori || "").toLowerCase();
    if (k.includes("bencana") || k.includes("cuaca")) return "BPBD & Dinas SDA";
    if (k.includes("lalu lintas") || k.includes("transportasi")) return "Dishub & Ditlantas";
    if (k.includes("ekonomi") || k.includes("harga")) return "Dinas Perdagangan & Ketahanan Pangan";
    if (k.includes("keamanan") || k.includes("kriminalitas")) return "Satpol PP & Kepolisian Wilayah";
    if (k.includes("kesehatan") || k.includes("lingkungan")) return "Dinas Lingkungan Hidup & Dinkes";
    if (k.includes("infrastruktur")) return "Dinas Bina Marga & Cipta Karya";
    return "Pemerintah Daerah";
  };

  // Rekomendasi tindakan taktis pimpinan
  const getRekomendasiTindakan = (issue: IssueItem, idx: number) => {
    const k = (issue.kategori || "").toLowerCase();
    if (k.includes("bencana") || k.includes("cuaca")) {
      return "Aktifkan posko siaga darurat, kerahkan armada pompa stasioner tambahan, dan terbitkan imbauan evakuasi mandiri bagi warga pesisir.";
    }
    if (k.includes("lalu lintas") || k.includes("transportasi")) {
      return "Tegakkan operasi penertiban portal pembatas terpadu dan koordinasikan pengalihan arus bersama petugas Ditlantas.";
    }
    if (k.includes("ekonomi") || k.includes("harga")) {
      return "Gelar operasi pasar murah subsidi di pasar tradisional utama dan inspeksi jalur distribusi bahan pokok.";
    }
    return "Lakukan verifikasi lapangan bersama tim dinas terkait dan publikasikan klarifikasi resmi kepada media dalam 4 jam.";
  };

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm space-y-6">
      {/* 1. Header Ringkasan Situasi & Waktu Pembaruan */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
                Ringkasan situasi
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                Pimpinan
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight mt-0.5">
              Ringkasan Kondisi &amp; Arahan Keputusan
            </h2>
          </div>
        </div>

        {/* Waktu Pembaruan & Status Badge */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-mono text-zinc-400 block">Pembaruan Sistem:</span>
            <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
              {lastUpdated.toLocaleTimeString("id-ID")} WIB
            </span>
          </div>

          <div
            className={`px-3.5 py-1.5 rounded-xl border flex items-center gap-2 ${currentStatus.bg} ${currentStatus.border}`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${currentStatus.pulse}`} />
            <span className={`text-xs font-black font-mono tracking-wider ${currentStatus.text}`}>
              {currentStatus.label}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Kondisi Umum Wilayah (Narasi Singkat Bahasa Indonesia Jelas) */}
      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 text-sm leading-relaxed">
        <p className="text-zinc-800 dark:text-zinc-200 font-medium">
          <strong>Laporan Ringkas:</strong> Sistem memantau dinamika informasi di{" "}
          <strong className="text-zinc-900 dark:text-white">{wilayahCount} Wilayah Administrasi</strong>. Saat ini terdapat{" "}
          <strong className="text-rose-600 dark:text-rose-400">{criticalCount} Isu Kritis</strong> dan{" "}
          <strong className="text-orange-600 dark:text-orange-400">{highCount} Isu Prioritas Tinggi</strong> yang memerlukan perhatian pimpinan. {currentStatus.description}
        </p>
      </div>

      {/* 3. Tiga Isu Paling Mendesak + Rekomendasi Tindak Lanjut */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>3 ISU PRIORITAS &amp; REKOMENDASI TINDAKAN CEPAT</span>
          </h3>
          <span className="text-[11px] font-mono text-zinc-400">Batas Waktu Respon: &le; 4 Jam</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((issue, idx) => {
            const instansi = getInstansiTerkait(issue.kategori, issue.wilayah);
            const rekomendasi = getRekomendasiTindakan(issue, idx);

            return (
              <div
                key={issue.id}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 flex flex-col justify-between hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors"
              >
                <div>
                  {/* Top Metatags: Wilayah & Level */}
                  <div className="flex items-center justify-between text-xs mb-2 gap-2">
                    <span className="flex items-center gap-1 font-mono font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px]">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      <span>{issue.wilayah}</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        issue.level === "CRITICAL"
                          ? "bg-rose-500 text-white"
                          : issue.level === "HIGH"
                          ? "bg-orange-500 text-white"
                          : "bg-amber-500 text-zinc-900"
                      }`}
                    >
                      {issue.level} (Skor: {issue.skor})
                    </span>
                  </div>

                  {/* Judul Isu */}
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug mb-2">
                    {issue.judul}
                  </h4>

                  {/* Instansi Penanggung Jawab */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-3 font-mono">
                    <Building2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      PIC: {instansi}
                    </span>
                  </div>

                  {/* Rekomendasi Tindak Lanjut Pimpinan */}
                  <div className="p-3 rounded-lg bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block">
                      Rekomendasi Tindakan:
                    </span>
                    <p className="leading-relaxed line-clamp-3">{rekomendasi}</p>
                  </div>
                </div>

                {/* Footer Card: Kanal & Tombol Tindak Lanjut */}
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MediaAvatarStack
                      sources={["youtube", "threads", "detik", "cnn"]}
                      max={2}
                      size="sm"
                    />
                    <span className="text-[10px] font-mono text-zinc-400">
                      {issue.current_volume} Laporan
                    </span>
                  </div>

                  <Link
                    href={`/isu/${issue.id}`}
                    className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 group"
                  >
                    <span>Instruksikan</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Catatan Disclaimer Transparansi Sistem */}
      <div className="pt-2 text-[11px] text-zinc-400 dark:text-zinc-500 font-mono flex items-center justify-between flex-wrap gap-2">
        <span>
          &bull; Rekomendasi di atas dihasilkan secara analitis dari klaster data riil portal berita &amp; media sosial (YouTube, Threads, X).
        </span>
        <span className="text-zinc-500">PT Technosoft Indo Prima &bull; Standar Integritas PRD v1.0</span>
      </div>
    </section>
  );
}
