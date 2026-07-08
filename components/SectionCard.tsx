"use client";

import type { Material, RateBasis, Section } from "@/lib/types";
import { totalSqft } from "@/lib/quote";
import { money, rate as fmtRate, sqft } from "@/lib/format";
import MeasurementRows from "./MeasurementRows";
import MaterialPicker from "./MaterialPicker";
import RateControls from "./RateControls";

interface Props {
  index: number;
  section: Section;
  materials: Material[];
  canRemove: boolean;
  onPatch: (p: Partial<Section>) => void;
  onRemove: () => void;
  onScanClick: () => void;
  /** Persist a newly AI-suggested material to the shared price list. */
  onAddMaterial: (m: Material) => void | Promise<void>;
}

export default function SectionCard({
  index,
  section,
  materials,
  canRemove,
  onPatch,
  onRemove,
  onScanClick,
  onAddMaterial,
}: Props) {
  const selectedMaterial = section.materialId
    ? materials.find((m) => m.id === section.materialId) ?? null
    : null;

  const pickMaterial = (m: Material) =>
    onPatch({
      materialId: m.id,
      customMaterialName: "",
      rateBasis: "installed",
      rateLow: m.installedLow,
      rateHigh: m.installedHigh,
    });

  const onBasis = (b: RateBasis) => {
    if (!selectedMaterial) return onPatch({ rateBasis: b });
    const low = b === "material" ? selectedMaterial.materialLow : selectedMaterial.installedLow;
    const high = b === "material" ? selectedMaterial.materialHigh : selectedMaterial.installedHigh;
    onPatch({ rateBasis: b, rateLow: low, rateHigh: high });
  };

  const saveSuggested = async (m: Material) => {
    await onAddMaterial(m);
    pickMaterial(m);
  };

  const area = totalSqft(section.rows);
  const subLow = area * section.rateLow;
  const subHigh = area * section.rateHigh;
  const isRange = Math.abs(subHigh - subLow) > 1e-9;
  const subtotal = isRange ? `${money(subLow)} – ${money(subHigh)}` : money(subLow);
  const rateStr = section.rateHigh !== section.rateLow
    ? `${fmtRate(section.rateLow)}–${fmtRate(section.rateHigh)}`
    : fmtRate(section.rateLow);

  return (
    <section className="rounded-3xl bg-white/[0.05] p-3 ring-1 ring-stone-800">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-stone-950">
          {index + 1}
        </span>
        <input
          value={section.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Room / area name (e.g. Living room)"
          aria-label={`Section ${index + 1} name`}
          className="h-11 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 text-base font-semibold text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove section ${index + 1}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-500 active:bg-stone-700 disabled:opacity-30"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="space-y-3">
        <MeasurementRows
          rows={section.rows}
          onChange={(rows) => onPatch({ rows })}
          onScanClick={onScanClick}
        />

        <MaterialPicker
          materials={materials}
          materialId={section.materialId}
          customName={section.customMaterialName}
          onPick={pickMaterial}
          onCustomName={(name) => onPatch({ materialId: null, customMaterialName: name })}
          onSaveSuggested={saveSuggested}
        />

        <RateControls
          material={selectedMaterial}
          rateBasis={section.rateBasis}
          rateLow={section.rateLow}
          rateHigh={section.rateHigh}
          onBasis={onBasis}
          onRate={(low, high) => onPatch({ rateLow: low, rateHigh: high })}
        />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-stone-900 px-4 py-3 ring-1 ring-stone-800">
        <span className="text-sm text-stone-400 tabular-nums">
          {sqft(area)} sq ft × {rateStr}
        </span>
        <span className="text-lg font-bold tabular-nums text-stone-100">{subtotal}</span>
      </div>
    </section>
  );
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
