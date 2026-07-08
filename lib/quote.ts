import type { MeasurementRow, Section } from "./types";
import { money, sqft, rate as fmtRate, toNumber } from "./format";

/** Square footage of a single row (length x width), 0 if either is blank. */
export function rowSqft(row: MeasurementRow): number {
  return toNumber(row.length) * toNumber(row.width);
}

/** Total square footage across all rows. */
export function totalSqft(rows: MeasurementRow[]): number {
  return rows.reduce((sum, r) => sum + rowSqft(r), 0);
}

/** A section priced on its own: area x rate, before job-wide contingency/HST. */
export interface SectionLine {
  id: string;
  /** Display name, falling back to "Section N" when the user left it blank. */
  name: string;
  materialName: string;
  area: number;
  rateLow: number;
  rateHigh: number;
  subtotalLow: number;
  subtotalHigh: number;
  isRange: boolean;
}

/** Resolve a material's display name from a section + the price list. */
export function sectionMaterialName(
  section: Section,
  materialName: (id: string) => string | undefined,
): string {
  if (section.materialId) return materialName(section.materialId) ?? section.customMaterialName;
  return section.customMaterialName;
}

/** Turn each section into a priced line item. */
export function sectionLines(
  sections: Section[],
  materialName: (id: string) => string | undefined,
): SectionLine[] {
  return sections.map((s, i) => {
    const area = totalSqft(s.rows);
    const subtotalLow = area * s.rateLow;
    const subtotalHigh = area * s.rateHigh;
    return {
      id: s.id,
      name: s.name.trim() || `Section ${i + 1}`,
      materialName: sectionMaterialName(s, materialName),
      area,
      rateLow: s.rateLow,
      rateHigh: s.rateHigh,
      subtotalLow,
      subtotalHigh,
      isRange: Math.abs(subtotalHigh - subtotalLow) > 1e-9,
    };
  });
}

export interface QuoteTotals {
  totalSqft: number;
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

/** Sum the section lines and apply job-wide contingency + HST once. */
export function computeQuote(
  lines: SectionLine[],
  contingencyPct: number,
  hstPct: number,
): QuoteTotals {
  const totalSqftValue = lines.reduce((sum, l) => sum + l.area, 0);
  const subtotalLow = lines.reduce((sum, l) => sum + l.subtotalLow, 0);
  const subtotalHigh = lines.reduce((sum, l) => sum + l.subtotalHigh, 0);

  const contingencyLow = subtotalLow * (contingencyPct / 100);
  const contingencyHigh = subtotalHigh * (contingencyPct / 100);

  const baseLow = subtotalLow + contingencyLow;
  const baseHigh = subtotalHigh + contingencyHigh;

  const hstLow = baseLow * (hstPct / 100);
  const hstHigh = baseHigh * (hstPct / 100);

  return {
    totalSqft: totalSqftValue,
    subtotalLow,
    subtotalHigh,
    contingencyLow,
    contingencyHigh,
    hstLow,
    hstHigh,
    grandLow: baseLow + hstLow,
    grandHigh: baseHigh + hstHigh,
    isRange: Math.abs(subtotalHigh - subtotalLow) > 1e-9,
  };
}

/** A low–high pair, collapsed to a single value when the range is zero-width. */
function span(low: number, high: number, isRange: boolean): string {
  return isRange ? `${money(low)} – ${money(high)}` : money(low);
}

/** Per-section rate, collapsed when low === high. */
function rateStr(low: number, high: number): string {
  return Math.abs(high - low) > 1e-9 ? `${fmtRate(low)}–${fmtRate(high)}` : fmtRate(low);
}

/** Build a clean plain-text quote (with a section breakdown) for the clipboard. */
export function quoteText(
  lines: SectionLine[],
  q: QuoteTotals,
  contingencyPct: number,
  hstPct: number,
): string {
  const out: string[] = [];
  out.push("DREAM BUILD GROUP — MATERIAL QUOTE");
  out.push("");

  for (const l of lines) {
    out.push(`${l.name}${l.materialName ? ` — ${l.materialName}` : ""}`);
    out.push(
      `  ${sqft(l.area)} sq ft × ${rateStr(l.rateLow, l.rateHigh)} = ${span(l.subtotalLow, l.subtotalHigh, l.isRange)}`,
    );
  }
  out.push("");

  out.push(`Total area: ${sqft(q.totalSqft)} sq ft`);
  out.push(`Subtotal: ${span(q.subtotalLow, q.subtotalHigh, q.isRange)}`);
  if (contingencyPct > 0) {
    out.push(
      `Contingency (${contingencyPct}%): ${span(q.contingencyLow, q.contingencyHigh, q.isRange)}`,
    );
  }
  out.push(`HST (${hstPct}%): ${span(q.hstLow, q.hstHigh, q.isRange)}`);
  out.push("");
  out.push(`GRAND TOTAL: ${span(q.grandLow, q.grandHigh, q.isRange)}`);
  out.push("");
  out.push("Prices are estimates and subject to site conditions.");
  return out.join("\n");
}
