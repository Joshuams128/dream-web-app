import type { MeasurementRow } from "./types";
import { money, sqft, rate as fmtRate, toNumber } from "./format";

/** Square footage of a single row (length x width), 0 if either is blank. */
export function rowSqft(row: MeasurementRow): number {
  return toNumber(row.length) * toNumber(row.width);
}

/** Total square footage across all rows. */
export function totalSqft(rows: MeasurementRow[]): number {
  return rows.reduce((sum, r) => sum + rowSqft(r), 0);
}

export interface QuoteTotals {
  totalSqft: number;
  rateLow: number;
  rateHigh: number;
  subtotalLow: number;
  subtotalHigh: number;
  contingencyLow: number;
  contingencyHigh: number;
  hstLow: number;
  hstHigh: number;
  grandLow: number;
  grandHigh: number;
  isRange: boolean;
}

export function computeQuote(
  rows: MeasurementRow[],
  rateLow: number,
  rateHigh: number,
  contingencyPct: number,
  hstPct: number,
): QuoteTotals {
  const area = totalSqft(rows);
  const subtotalLow = area * rateLow;
  const subtotalHigh = area * rateHigh;

  const contingencyLow = subtotalLow * (contingencyPct / 100);
  const contingencyHigh = subtotalHigh * (contingencyPct / 100);

  const baseLow = subtotalLow + contingencyLow;
  const baseHigh = subtotalHigh + contingencyHigh;

  const hstLow = baseLow * (hstPct / 100);
  const hstHigh = baseHigh * (hstPct / 100);

  return {
    totalSqft: area,
    rateLow,
    rateHigh,
    subtotalLow,
    subtotalHigh,
    contingencyLow,
    contingencyHigh,
    hstLow,
    hstHigh,
    grandLow: baseLow + hstLow,
    grandHigh: baseHigh + hstHigh,
    isRange: Math.abs(rateHigh - rateLow) > 1e-9,
  };
}

/** A low–high pair, collapsed to a single value when the range is zero-width. */
function span(low: number, high: number, isRange: boolean): string {
  return isRange ? `${money(low)} – ${money(high)}` : money(low);
}

/** Build a clean plain-text quote suitable for the clipboard. */
export function quoteText(
  materialName: string,
  q: QuoteTotals,
  contingencyPct: number,
  hstPct: number,
): string {
  const lines: string[] = [];
  lines.push("DREAM BUILD GROUP — MATERIAL QUOTE");
  lines.push("");
  lines.push(`Work / material: ${materialName || "(not specified)"}`);
  lines.push(`Total area: ${sqft(q.totalSqft)} sq ft`);
  lines.push(
    `Rate: ${q.isRange ? `${fmtRate(q.rateLow)} – ${fmtRate(q.rateHigh)}` : fmtRate(q.rateLow)} / sq ft`,
  );
  lines.push(
    `Subtotal: ${sqft(q.totalSqft)} sq ft × ${q.isRange ? `${fmtRate(q.rateLow)}–${fmtRate(q.rateHigh)}` : fmtRate(q.rateLow)} = ${span(q.subtotalLow, q.subtotalHigh, q.isRange)}`,
  );
  if (contingencyPct > 0) {
    lines.push(
      `Contingency (${contingencyPct}%): ${span(q.contingencyLow, q.contingencyHigh, q.isRange)}`,
    );
  }
  lines.push(`HST (${hstPct}%): ${span(q.hstLow, q.hstHigh, q.isRange)}`);
  lines.push("");
  lines.push(`GRAND TOTAL: ${span(q.grandLow, q.grandHigh, q.isRange)}`);
  lines.push("");
  lines.push("Prices are estimates and subject to site conditions.");
  return lines.join("\n");
}
