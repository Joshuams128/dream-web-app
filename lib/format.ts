// Formatting + numeric helpers shared across the UI.

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as CAD currency, e.g. 2586 -> "$2,586.00". */
export function money(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return CAD.format(n);
}

/** Format a square-foot value with up to 2 decimals and thousands separators. */
export function sqft(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-CA", { maximumFractionDigits: 2 });
}

/** Format a per-sq-ft rate, trimming needless trailing zeros. */
export function rate(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return CAD.format(n);
}

/** Parse a user-entered numeric string; returns 0 for blank/invalid input. */
export function toNumber(s: string): number {
  const n = parseFloat(String(s).trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
