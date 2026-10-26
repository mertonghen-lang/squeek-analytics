export function formatUint(value: bigint | null | undefined): string {
  if (value == null) return "—";
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `−${grouped}` : grouped;
}

export function formatSeconds(value: bigint | null | undefined): string {
  if (value == null) return "—";
  const negative = value < 0n;
  let rest = negative ? -value : value;
  const sign = negative ? "−" : "";
  if (rest < 60n) return `${sign}${rest}s`;
  const seconds = rest % 60n;
  rest /= 60n;
  if (rest < 60n) return `${sign}${rest}m ${seconds}s`;
  const minutes = rest % 60n;
  const hours = rest / 60n;
  return `${sign}${hours}h ${minutes}m`;
}

export function formatWhen(value: string | bigint | number | null | undefined): string {
  if (value == null || value === "") return "—";
  let ms: number;
  if (typeof value === "string") {
    ms = Date.parse(value);
  } else {
    const numeric = Number(value);
    ms = Math.abs(numeric) < 1e12 ? numeric * 1000 : numeric;
  }
  if (!Number.isFinite(ms)) return String(value);
  return new Date(ms).toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC");
}

export function formatMilli(value: number, scaleDigits = 3): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const scale = 10 ** scaleDigits;
  const abs = Math.abs(Math.trunc(value));
  const whole = Math.trunc(abs / scale);
  const fraction = String(abs % scale).padStart(scaleDigits, "0");
  return `${sign}${whole}.${fraction}`;
}

export function formatHundredths(value: bigint | null | undefined): string {
  if (value == null) return "—";
  const sign = value < 0n ? "−" : "";
  const abs = value < 0n ? -value : value;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function formatBps(bps: number | null | undefined): string {
  if (bps == null || !Number.isFinite(bps)) return "—";
  const sign = bps < 0 ? "−" : "";
  const abs = Math.abs(Math.trunc(bps));
  const whole = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}%`;
}

export function shortAddress(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function chartNumber(value: bigint): number | null {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max || value < -max) return null;
  return Number(value);
}

export function ageLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export const DOCS_SNAPSHOT = {
  core: "0x74665dAecA35A2303e767E76a2FF1FB6F93e119f",
  mining: "0x3beE588fC20dE788Bac17d33b41Da7346cb27EC4",
  token: "0x6872bfa5ccc3e9e440c6c16e5ffdabb8dba4cc76",
  nft: "0x0eAF3E0d40A0a8E5a6Ac030b2459E9FB0B7905c6",
  deploymentBlock: "11902282",
} as const;
