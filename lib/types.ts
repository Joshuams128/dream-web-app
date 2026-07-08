// Shared domain types for the Material Price Calculator.

/**
 * A material / work item in the price list.
 *
 * Prices are per square foot in CAD, stored as low/high ranges so quotes can
 * show a defensible spread. Labour-only items (e.g. "Flooring removal") keep
 * materialLow/materialHigh at 0 and put the labour rate in installedLow/High.
 */
export interface Material {
  id: string;
  name: string;
  category: string;
  /** Material-only cost per sq ft (0 for labour-only items). */
  materialLow: number;
  materialHigh: number;
  /** Installed cost per sq ft (material + labour, or labour for labour-only items). */
  installedLow: number;
  installedHigh: number;
  unit: string; // e.g. "sq ft"
  notes?: string;
  updatedAt: string; // ISO timestamp
  source: "seed" | "ai" | "custom";
}

/** A single length x width measurement row entered by the user. */
export interface MeasurementRow {
  id: string;
  length: string; // kept as strings for controlled inputs; parsed at compute time
  width: string;
}

/** Which price column drives the quote total. */
export type RateBasis = "installed" | "material";

/**
 * One area of a job — e.g. "Washroom", "Living room" — with its own
 * measurements, chosen material, and rate. A full-house quote is a list of
 * these, each priced independently and then summed.
 *
 * rateLow/rateHigh are the actual per-sq-ft rate used for this section. Picking
 * a material or switching the basis populates them; the user can then edit them
 * freely, so they double as the manual-override mechanism.
 */
export interface Section {
  id: string;
  /** User-facing label, e.g. "Living room". May be blank while editing. */
  name: string;
  rows: MeasurementRow[];
  materialId: string | null;
  /** Free-text label when the chosen work isn't in the price list. */
  customMaterialName: string;
  rateBasis: RateBasis;
  rateLow: number;
  rateHigh: number;
}

/**
 * The full calculator session, persisted so the contractor can close the tab
 * mid-job and pick up where they left off. Contingency and HST apply once to
 * the whole quote, after every section subtotal is summed.
 */
export interface SessionState {
  sections: Section[];
  contingencyPct: number;
  hstPct: number;
}

/** Result shape returned by the /api/extract-measurements route. */
export interface ExtractResult {
  rows: { length: number; width: number }[];
  message?: string;
}

/** Result shape returned by the /api/suggest-price route. */
export interface SuggestResult {
  low: number;
  high: number;
  unit: string;
  notes: string;
  sources: { title: string; url: string }[];
}

/** The contractor's own business details, shown as the invoice sender. */
export interface BusinessInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  hstNumber: string;
  /** Next invoice number, auto-incremented after each export. */
  invoiceCounter: number;
}

/** The end client's details, entered per invoice. */
export interface ClientInfo {
  name: string;
  address: string;
  email: string;
}

