import type { Material } from "./types";

/**
 * ~15 common flooring / renovation line items seeded with rough Toronto/GTA
 * 2026 pricing (CAD, per sq ft). These are starting-point averages — the
 * business owner is expected to edit them in Settings to match their real
 * quote prices, which always take precedence over internet averages.
 */
const RAW: Omit<Material, "id" | "updatedAt" | "source">[] = [
  { name: "Red oak hardwood", category: "Flooring", materialLow: 5, materialHigh: 8, installedLow: 9, installedHigh: 14, unit: "sq ft", notes: "3/4\" solid, site-finished not included" },
  { name: "Maple hardwood", category: "Flooring", materialLow: 6, materialHigh: 9, installedLow: 10, installedHigh: 15, unit: "sq ft" },
  { name: "Engineered hardwood", category: "Flooring", materialLow: 4, materialHigh: 7, installedLow: 8, installedHigh: 12, unit: "sq ft" },
  { name: "Laminate flooring", category: "Flooring", materialLow: 1.5, materialHigh: 3.5, installedLow: 4, installedHigh: 7, unit: "sq ft" },
  { name: "Vinyl plank (LVP)", category: "Flooring", materialLow: 2, materialHigh: 4.5, installedLow: 5, installedHigh: 9, unit: "sq ft" },
  { name: "Carpet", category: "Flooring", materialLow: 2, materialHigh: 5, installedLow: 4, installedHigh: 8, unit: "sq ft", notes: "Includes underpad" },
  { name: "Porcelain tile 12x24", category: "Tile", materialLow: 3, materialHigh: 8, installedLow: 12, installedHigh: 20, unit: "sq ft" },
  { name: "Ceramic tile", category: "Tile", materialLow: 2, materialHigh: 5, installedLow: 9, installedHigh: 16, unit: "sq ft" },
  { name: "Tile installation labour", category: "Labour", materialLow: 0, materialHigh: 0, installedLow: 8, installedHigh: 14, unit: "sq ft", notes: "Labour only, tile supplied separately" },
  { name: "Hardwood install labour", category: "Labour", materialLow: 0, materialHigh: 0, installedLow: 3, installedHigh: 6, unit: "sq ft", notes: "Labour only" },
  { name: "Sanding & staining", category: "Refinish", materialLow: 0, materialHigh: 0, installedLow: 3, installedHigh: 5, unit: "sq ft", notes: "Refinish existing hardwood" },
  { name: "Flooring removal", category: "Demo", materialLow: 0, materialHigh: 0, installedLow: 1, installedHigh: 3, unit: "sq ft" },
  { name: "Carpet removal", category: "Demo", materialLow: 0, materialHigh: 0, installedLow: 0.5, installedHigh: 2, unit: "sq ft", notes: "Includes haul-away" },
  { name: "Drywall (supply & install)", category: "Walls", materialLow: 1.5, materialHigh: 2.5, installedLow: 2.5, installedHigh: 4.5, unit: "sq ft" },
  { name: "Interior paint", category: "Walls", materialLow: 0.5, materialHigh: 1, installedLow: 2, installedHigh: 4, unit: "sq ft", notes: "Two coats, walls only" },
];

/**
 * Build the default material list. A fixed timestamp/id-free base is turned
 * into full Material records at seed time.
 */
export function seedMaterials(): Material[] {
  const now = new Date().toISOString();
  return RAW.map((m, i) => ({
    ...m,
    id: `seed-${i + 1}`,
    updatedAt: now,
    source: "seed" as const,
  }));
}
