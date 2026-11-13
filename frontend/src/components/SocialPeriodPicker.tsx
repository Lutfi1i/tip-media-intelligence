"use client";

import { FormEvent, useEffect, useState } from "react";

export const PERIOD_PRESETS = [
  { label: "15 Mnt", value: "15m" },
  { label: "1 Jam", value: "1h" },
  { label: "6 Jam", value: "6h" },
  { label: "24 Jam", value: "24h" },
  { label: "7 Hari", value: "7d" },
  { label: "30 Hari", value: "30d" },
];

const MAX_DAYS = 92;

/** Tanggal hari ini dalam WIB (YYYY-MM-DD), tidak bergantung zona waktu peramban. */
export function wibDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 7 * 3600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function customKey(start: string, end: string): string {
  return `custom:${start}:${end}`;
}

export function parseCustomKey(key: string): { start: string; end: string } | null {
  const m = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(key);
  return m ? { start: m[1], end: m[2] } : null;
}

export function SocialPeriodPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const custom = parseCustomKey(value);
  const today = wibDate();
  const yesterday = wibDate(-1);
  const [open, setOpen] = useState(Boolean(custom));
  const [start, setStart] = useState(custom?.start ?? wibDate(-6));
  const [end, setEnd] = useState(custom?.end ?? today);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (custom) {
      setStart(custom.start);
      setEnd(custom.end);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (e: FormEvent) => {
    e.preventDefault();
    if (!start || !end) return setError("Isi kedua tanggal.");
    if (end < start) return setError("Tanggal akhir lebih awal dari tanggal mulai.");
    if (start > today) return setError("Tanggal mulai di masa depan.");
    const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
    if (days > MAX_DAYS) return setError(`Periode maksimal ${MAX_DAYS} hari.`);
    setError(null);
    onChange(customKey(start, end));
  };

  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${active ? "bg-fuchsia-600 text-white shadow-xs" : "text-zinc-400 hover:text-white"}`;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="inline-flex flex-wrap rounded-xl bg-zinc-800/80 p-1 ring-1 ring-white/10" role="group" aria-label="Periode">
        {PERIOD_PRESETS.map((p) => (
          <button key={p.value} onClick={() => { setOpen(false); onChange(p.value); }} aria-pressed={value === p.value} className={chip(value === p.value)}>
            {p.label}
          </button>
        ))}
        <button
          onClick={() => onChange(customKey(today, today))}
          aria-pressed={value === customKey(today, today)}
          className={chip(value === customKey(today, today))}
        >
          Hari ini
        </button>
        <button
          onClick={() => onChange(customKey(yesterday, yesterday))}
          aria-pressed={value === customKey(yesterday, yesterday)}
          className={chip(value === customKey(yesterday, yesterday))}
        >
          Kemarin
        </button>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={chip(Boolean(custom) && value !== customKey(today, today) && value !== customKey(yesterday, yesterday))}>
          Kustom
        </button>
      </div>

      {open && (
        <form onSubmit={apply} className="flex flex-wrap items-end gap-2 rounded-xl bg-zinc-800/80 p-2 ring-1 ring-white/10">
          <label className="flex flex-col text-2xs text-zinc-400">
            Dari (WIB)
            <input
              type="date"
              value={start}
              max={today}
              onChange={(e) => setStart(e.target.value)}
              className="mt-0.5 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col text-2xs text-zinc-400">
            Sampai (WIB)
            <input
              type="date"
              value={end}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-0.5 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white [color-scheme:dark]"
            />
          </label>
          <button type="submit" className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-fuchsia-500">
            Terapkan
          </button>
          {error && <span role="alert" className="w-full text-2xs text-rose-300">{error}</span>}
        </form>
      )}
    </div>
  );
}
