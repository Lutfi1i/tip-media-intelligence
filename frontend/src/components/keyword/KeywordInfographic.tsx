"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { fmtDateTime, fmtNum, fmtSignedPct } from "@/lib/format";
import { platformLabel } from "@/lib/trendFilters";
import { KeywordDashboard, Sentiment, SENTIMENTS } from "@/lib/keywordApi";
import { pctOf, SENT_LABEL, sumSent } from "./KeywordCharts";

// Infografis selalu bertema terang dengan warna tetap, supaya PNG yang dibagikan sama di semua perangkat.
const C = {
  bg: "#ffffff",
  ink: "#18181b",
  ink2: "#52525b",
  muted: "#71717a",
  line: "#e4e4e7",
  panel: "#f4f4f5",
  head: "#18181b",
  sent: { positif: "#16a34a", netral: "#85858e", negatif: "#dc2626" } as Record<Sentiment, string>,
};
const W = 1080;
const H = 1350;
const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const PERIOD_TEXT: Record<string, string> = { today: "Hari ini", "7d": "7 hari terakhir", "30d": "30 hari terakhir" };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}...` : s);

function Donut({ cx, cy, r, counts }: { cx: number; cy: number; r: number; counts: Record<Sentiment, number> }) {
  const total = sumSent(counts);
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.line} strokeWidth={34} />
      {total > 0 &&
        SENTIMENTS.map((s) => {
          const frac = counts[s] / total;
          if (!frac) return null;
          const gap = frac >= 1 ? 0 : 6;
          const len = Math.max(0, frac * circ - gap);
          const el = (
            <circle
              key={s}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={C.sent[s]}
              strokeWidth={34}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-acc + circ / 4}
            />
          );
          acc += frac * circ;
          return el;
        })}
    </g>
  );
}

export function KeywordInfographic({ data }: { data: KeywordDashboard }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const r = data.ringkasan;
  const total = r.sebutan;
  const net = total ? Math.round(((r.sentimen.positif - r.sentimen.negatif) / total) * 100) : null;
  const tl = data.timeline;
  const tlMax = Math.max(1, ...tl.map((p) => p.total));
  const words = data.kata_konteks.slice(0, 12);
  const sources = data.sumber_teratas.slice(0, 5);
  const platforms = data.platform.slice(0, 5);
  const platTotal = platforms.reduce((a, p) => a + p.sebutan, 0);

  const download = async () => {
    if (!svgRef.current) return;
    setBusy(true);
    setErr(null);
    try {
      const xml = new XMLSerializer().serializeToString(svgRef.current);
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Gambar gagal dibuat"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Browser tidak mendukung kanvas");
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("PNG gagal dibuat");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `infografis-${data.proyek.nama.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${data.periode.key}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unduhan gagal");
    } finally {
      setBusy(false);
    }
  };

  const statCards: { label: string; value: string; sub: string; color?: string }[] = [
    {
      label: "Sebutan",
      value: fmtNum(total),
      sub: !r.pembanding_lengkap ? "baru mulai dipantau" : r.perubahan_pct === null ? "tanpa pembanding" : `${fmtSignedPct(r.perubahan_pct)} vs periode lalu`,
    },
    ...SENTIMENTS.map((s) => ({
      label: SENT_LABEL[s],
      value: fmtNum(r.sentimen[s]),
      sub: `${fmtNum(pctOf(r.sentimen[s], total))}% sebutan`,
      color: C.sent[s],
    })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-zinc-500 dark:text-zinc-400">
          Ringkasan satu halaman untuk dibagikan ke pimpinan atau grup. Ukuran 1080 x 1350 piksel, cocok untuk WhatsApp dan
          Instagram.
        </p>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {busy ? "Menyiapkan..." : "Unduh PNG"}
        </button>
      </div>
      {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
      <div className="mx-auto w-full max-w-[540px] overflow-hidden rounded-lg border border-zinc-200 shadow-sm dark:border-zinc-800">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`Infografis keyword ${data.proyek.nama}: ${total} sebutan, ${r.sentimen.positif} positif, ${r.sentimen.netral} netral, ${r.sentimen.negatif} negatif`}
          fontFamily={FONT}
        >
          <rect width={W} height={H} fill={C.bg} />

          {/* Kepala */}
          <rect width={W} height={190} fill={C.head} />
          <text x={64} y={78} fill="#a1a1aa" fontSize={26} fontWeight={700} letterSpacing={3}>
            PANTAU KEYWORD
          </text>
          <text x={64} y={146} fill="#ffffff" fontSize={60} fontWeight={800}>
            {clip(data.proyek.nama, 22)}
          </text>
          <text x={W - 64} y={78} fill="#ffffff" fontSize={28} fontWeight={700} textAnchor="end">
            {PERIOD_TEXT[data.periode.key] || data.periode.key}
          </text>
          <text x={W - 64} y={146} fill="#a1a1aa" fontSize={24} textAnchor="end">
            {data.proyek.kata_kunci.join(", ").toLowerCase() === data.proyek.nama.toLowerCase() ? "" : clip(data.proyek.kata_kunci.join(", "), 34)}
          </text>

          {/* Kartu angka */}
          {statCards.map((s, i) => {
            const x = 64 + i * 244;
            return (
              <g key={s.label}>
                <rect x={x} y={232} width={220} height={176} rx={14} fill={C.panel} />
                {s.color && <rect x={x} y={232} width={8} height={176} rx={4} fill={s.color} />}
                <text x={x + 28} y={280} fill={C.ink2} fontSize={24} fontWeight={700}>
                  {s.label}
                </text>
                <text x={x + 28} y={348} fill={C.ink} fontSize={56} fontWeight={800}>
                  {s.value}
                </text>
                <text x={x + 28} y={386} fill={C.muted} fontSize={18}>
                  {clip(s.sub, 21)}
                </text>
              </g>
            );
          })}

          {/* Donat sentimen */}
          <text x={64} y={482} fill={C.ink} fontSize={30} fontWeight={800}>
            Porsi sentimen
          </text>
          <Donut cx={224} cy={652} r={120} counts={r.sentimen} />
          <text x={224} y={660} fill={C.ink} fontSize={58} fontWeight={800} textAnchor="middle">
            {net === null ? "-" : `${net > 0 ? "+" : ""}${net}`}
          </text>
          <text x={224} y={698} fill={C.muted} fontSize={20} textAnchor="middle">
            skor sentimen
          </text>

          {/* Grafik harian */}
          <text x={440} y={482} fill={C.ink} fontSize={30} fontWeight={800}>
            Sebutan {data.periode.key === "today" ? "per jam" : "per hari"}
          </text>
          {(() => {
            const x0 = 440;
            const y0 = 790;
            const w = W - 64 - x0;
            const h = 260;
            const bw = w / Math.max(1, tl.length);
            return (
              <g>
                <line x1={x0} x2={x0 + w} y1={y0} y2={y0} stroke={C.line} strokeWidth={2} />
                {tl.map((p, i) => {
                  let y = y0;
                  return (
                    <g key={p.t}>
                      {(["negatif", "netral", "positif"] as Sentiment[]).map((s) => {
                        const segH = (p[s] / tlMax) * h;
                        if (!segH) return null;
                        y -= segH;
                        return <rect key={s} x={x0 + i * bw + 2} y={y + 1} width={Math.max(2, bw - 4)} height={Math.max(1, segH - 2)} fill={C.sent[s]} />;
                      })}
                    </g>
                  );
                })}
                <text x={x0} y={y0 + 34} fill={C.muted} fontSize={18}>
                  {tl.length ? (data.periode.key === "today" ? tl[0].t.slice(11, 16).replace(":", ".") : fmtDayShort(tl[0].t)) : ""}
                </text>
                <text x={x0 + w} y={y0 + 34} fill={C.muted} fontSize={18} textAnchor="end">
                  {tl.length ? (data.periode.key === "today" ? tl[tl.length - 1].t.slice(11, 16).replace(":", ".") : fmtDayShort(tl[tl.length - 1].t)) : ""}
                </text>
                <text x={x0 + w} y={y0 - h - 8} fill={C.muted} fontSize={18} textAnchor="end">
                  puncak {fmtNum(tlMax)} sebutan
                </text>
              </g>
            );
          })()}

          {/* Sumber teratas */}
          <line x1={64} x2={W - 64} y1={870} y2={870} stroke={C.line} strokeWidth={2} />
          <text x={64} y={928} fill={C.ink} fontSize={30} fontWeight={800}>
            Sumber teratas
          </text>
          {sources.length === 0 && (
            <text x={64} y={980} fill={C.muted} fontSize={22}>
              Belum ada data
            </text>
          )}
          {sources.map((s, i) => (
            <g key={s.nama}>
              <text x={64} y={972 + i * 42} fill={C.ink} fontSize={23} fontWeight={600}>
                {clip(s.nama, 26)}
              </text>
              <text x={500} y={972 + i * 42} fill={C.ink2} fontSize={23} fontWeight={700} textAnchor="end">
                {fmtNum(s.sebutan)}
              </text>
            </g>
          ))}

          {/* Kata konteks */}
          <text x={580} y={928} fill={C.ink} fontSize={30} fontWeight={800}>
            Kata yang sering muncul
          </text>
          {words.length === 0 && (
            <text x={580} y={980} fill={C.muted} fontSize={22}>
              Belum cukup data
            </text>
          )}
          {(() => {
            // Susun kata sebagai chip, pindah baris bila melewati batas kanan.
            let x = 580;
            let y = 960;
            return words.map((w) => {
              const label = clip(w.kata, 16);
              const cw = label.length * 13 + 32;
              if (x + cw > W - 64) {
                x = 580;
                y += 56;
              }
              // Batas bawah: jangan menabrak garis pemisah bagian "Asal sebutan".
              if (y + 42 > 1150) return null;
              const el = (
                <g key={w.kata}>
                  <rect x={x} y={y} width={cw} height={42} rx={21} fill={w.sentimen === "netral" ? C.panel : C.sent[w.sentimen]} fillOpacity={w.sentimen === "netral" ? 1 : 0.14} />
                  <text x={x + cw / 2} y={y + 28} fill={w.sentimen === "netral" ? C.ink2 : C.sent[w.sentimen]} fontSize={21} fontWeight={700} textAnchor="middle">
                    {label}
                  </text>
                </g>
              );
              x += cw + 10;
              return el;
            });
          })()}

          {/* Platform */}
          <line x1={64} x2={W - 64} y1={1240 - 70} y2={1240 - 70} stroke={C.line} strokeWidth={2} />
          <text x={64} y={1210} fill={C.ink2} fontSize={22} fontWeight={700}>
            Asal sebutan
          </text>
          {(() => {
            let x = 260;
            let lx = 260;
            const w = W - 64 - 260;
            return platforms.map((p, i) => {
              const pw = platTotal ? (p.sebutan / platTotal) * w : 0;
              const name = `${clip(platformName(p.nama), 12)} ${fmtNum(p.sebutan)}`;
              const el = (
                <g key={p.nama}>
                  <rect x={x} y={1186} width={Math.max(2, pw - 4)} height={30} rx={4} fill={PLATFORM_COLORS[i]} />
                  <rect x={lx} y={1240} width={16} height={16} rx={3} fill={PLATFORM_COLORS[i]} />
                  <text x={lx + 24} y={1254} fill={C.ink2} fontSize={18} fontWeight={600}>
                    {name}
                  </text>
                </g>
              );
              x += pw;
              lx += name.length * 10 + 52;
              return el;
            });
          })()}

          {/* Kaki */}
          <text x={64} y={H - 48} fill={C.muted} fontSize={19}>
            TIP Media Intelligence. Data sampai {fmtDateTime(data.periode.akhir)}.
          </text>
          <text x={W - 64} y={H - 48} fill={C.muted} fontSize={19} textAnchor="end">
            {r.dinilai_ai > 0 ? `Sentimen dinilai AI, ${fmtNum(r.dikoreksi_manual)} dikoreksi analis` : "Sentimen dari kamus kata"}
          </text>
        </svg>
      </div>
    </div>
  );
}

// Palet kategori tervalidasi yang sama dengan --series-1..5 (tema terang), urutan tetap.
const PLATFORM_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

export function platformName(p: string) {
  return p === "berita" ? "Berita" : platformLabel(p);
}

function fmtDayShort(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("id-ID", { timeZone: "UTC", day: "numeric", month: "short" });
}
