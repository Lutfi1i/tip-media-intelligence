const TZ = "Asia/Jakarta";

/** Angka dengan pemisah ribuan lokal (id-ID). Null/undefined -> "-". */
export function fmtNum(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Persentase tanpa tanda: 72.4 -> "72,4%". */
export function fmtPct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${fmtNum(value, digits)}%`;
}

/** Persentase bertanda: 32 -> "+32%", -4.2 -> "-4,2%". */
export function fmtSignedPct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${fmtNum(Math.abs(value), digits)}%`;
}

function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  // Backend mengirim naive UTC (tanpa sufiks zona). Tempelkan "Z" agar tidak
  // digeser dua kali oleh Date parser di browser WIB.
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "-";
  return `${d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  })}, ${d.toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  })} WIB`;
}

export function fmtDate(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

export function fmtTime(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "-";
  return `${d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  })} WIB`;
}

/** "baru saja", "12 menit lalu", "3 jam lalu", "2 hari lalu". */
export function fmtRelative(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "-";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return fmtTime(d.toISOString());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return fmtDate(d.toISOString());
}

export function isOverdue(iso?: string | null): boolean {
  const d = parse(iso);
  return !!d && d.getTime() < Date.now();
}

export function nowStamp(): string {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  });
}

/** Rentang tanggal ISO untuk 7 hari terakhir (Senin..Minggu pekan berjalan). */
export function currentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Senin = 0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    end: end.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
  };
}
