"use client";

import type { Material, RateBasis } from "@/lib/types";

interface Props {
  material: Material | null;
  rateBasis: RateBasis;
  rateLow: number;
  rateHigh: number;
  onBasis: (b: RateBasis) => void;
  onRate: (low: number, high: number) => void;
}

function clean(value: string): number {
  const v = value.replace(/[^0-9.]/g, "");
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function RateControls({
  material,
  rateBasis,
  rateLow,
  rateHigh,
  onBasis,
  onRate,
}: Props) {
  const hasMaterialCost =
    !!material && (material.materialLow > 0 || material.materialHigh > 0);

  return (
    <section className="rounded-2xl bg-stone-900 p-4 shadow-sm ring-1 ring-stone-800 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-100">Rate (per sq ft)</h2>
        {material && hasMaterialCost && (
          <div className="inline-flex rounded-lg bg-stone-800 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onBasis("installed")}
              className={`rounded-md px-3 py-1.5 ${
                rateBasis === "installed" ? "bg-amber-500 text-stone-950 shadow-sm" : "text-stone-400"
              }`}
            >
              Installed
            </button>
            <button
              type="button"
              onClick={() => onBasis("material")}
              className={`rounded-md px-3 py-1.5 ${
                rateBasis === "material" ? "bg-amber-500 text-stone-950 shadow-sm" : "text-stone-400"
              }`}
            >
              Material only
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
            Low $
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-500">$</span>
            <input
              inputMode="decimal"
              value={rateLow || ""}
              placeholder="0.00"
              onChange={(e) => onRate(clean(e.target.value), rateHigh)}
              className="h-14 w-full rounded-xl border border-stone-700 bg-stone-900 pr-3 pl-7 text-lg tabular-nums text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">
            High $
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-500">$</span>
            <input
              inputMode="decimal"
              value={rateHigh || ""}
              placeholder="0.00"
              onChange={(e) => onRate(rateLow, clean(e.target.value))}
              className="h-14 w-full rounded-xl border border-stone-700 bg-stone-900 pr-3 pl-7 text-lg tabular-nums text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </div>
        </label>
      </div>

      <p className="mt-2 text-xs text-stone-500">
        {material
          ? "Prefilled from your price list — edit either box to override for this quote."
          : "Enter a rate, or pick a material above to prefill it. Set Low = High for a flat rate."}
      </p>
    </section>
  );
}
