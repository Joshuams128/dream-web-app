import type { Material, Section, SessionState, BusinessInfo } from "./types";
import { seedMaterials } from "./seed";

/**
 * Single data-access seam for the whole app. Every read/write of the price
 * list or the saved session goes through these functions, so swapping the
 * localStorage backend for Supabase later means editing only this file.
 *
 * The interface is intentionally async even though localStorage is sync — that
 * way a Supabase implementation (which is async) is a drop-in replacement with
 * no call-site changes.
 */

const MATERIALS_KEY = "dbg.materials.v1";
const SESSION_KEY = "dbg.session.v1";
const BUSINESS_KEY = "dbg.business.v1";

const DEFAULT_BUSINESS: BusinessInfo = {
  name: "Dream Build Group",
  phone: "",
  email: "",
  address: "",
  hstNumber: "",
  invoiceCounter: 1,
};

const hasStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

/** Small collision-resistant id for new materials created at runtime. */
export function newId(prefix = "mat"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function read<T>(key: string): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-mode errors — the app still works in-memory.
  }
}

// ---- Materials -------------------------------------------------------------

export async function getMaterials(): Promise<Material[]> {
  const stored = read<Material[]>(MATERIALS_KEY);
  if (stored && Array.isArray(stored) && stored.length > 0) return stored;
  // First run (or cleared storage): seed and persist the defaults.
  const seeded = seedMaterials();
  write(MATERIALS_KEY, seeded);
  return seeded;
}

export async function saveMaterials(materials: Material[]): Promise<void> {
  write(MATERIALS_KEY, materials);
}

export async function resetMaterials(): Promise<Material[]> {
  const seeded = seedMaterials();
  write(MATERIALS_KEY, seeded);
  return seeded;
}

// ---- Session ---------------------------------------------------------------

/**
 * The shape saved before multi-section support: a single flat set of rows,
 * material, and rate. Kept only so old localStorage data can be migrated.
 */
interface LegacySession {
  rows?: Section["rows"];
  materialId?: string | null;
  customMaterialName?: string;
  rateBasis?: Section["rateBasis"];
  rateLow?: number;
  rateHigh?: number;
  contingencyPct?: number;
  hstPct?: number;
}

/** Fold a pre-sections session into a one-section SessionState. */
function migrateSession(raw: SessionState & LegacySession): SessionState {
  if (Array.isArray(raw.sections)) return raw; // already current shape
  const legacy = raw as LegacySession;
  return {
    sections: [
      {
        id: newId("sec"),
        name: "",
        rows: legacy.rows ?? [],
        materialId: legacy.materialId ?? null,
        customMaterialName: legacy.customMaterialName ?? "",
        rateBasis: legacy.rateBasis ?? "installed",
        rateLow: legacy.rateLow ?? 0,
        rateHigh: legacy.rateHigh ?? 0,
      },
    ],
    contingencyPct: legacy.contingencyPct ?? 0,
    hstPct: legacy.hstPct ?? 13,
  };
}

export async function getSession(): Promise<SessionState | null> {
  const raw = read<SessionState & LegacySession>(SESSION_KEY);
  return raw ? migrateSession(raw) : null;
}

export async function saveSession(session: SessionState): Promise<void> {
  write(SESSION_KEY, session);
}

// ---- Business info ---------------------------------------------------------

export async function getBusiness(): Promise<BusinessInfo> {
  const stored = read<BusinessInfo>(BUSINESS_KEY);
  return { ...DEFAULT_BUSINESS, ...(stored ?? {}) };
}

export async function saveBusiness(info: BusinessInfo): Promise<void> {
  write(BUSINESS_KEY, info);
}
