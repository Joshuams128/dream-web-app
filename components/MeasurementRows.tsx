"use client";

import type { MeasurementRow } from "@/lib/types";
import { rowSqft, totalSqft } from "@/lib/quote";
import { sqft } from "@/lib/format";
import { newId } from "@/lib/store";

export function makeRow(length = "", width = ""): MeasurementRow {
  return { id: newId("row"), length, width };
}

interface Props {
  rows: MeasurementRow[];
  onChange: (rows: MeasurementRow[]) => void;
  onScanClick: () => void;
}

// Allow only digits and a single decimal point as the user types.
function clean(value: string): string {
  const v = value.replace(/[^0-9.]/g, "");
  const parts = v.split(".");
  return parts.length <= 2 ? v : `${parts[0]}.${parts.slice(1).join("")}`;
}

export default function MeasurementRows({ rows, onChange, onScanClick }: Props) {
  const update = (id: string, field: "length" | "width", value: string) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: clean(value) } : r)));
  };
  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    onChange(next.length ? next : [makeRow()]);
  };
  const add = () => onChange([...rows, makeRow()]);

  const total = totalSqft(rows);

  return (
    <section className="rounded-2xl bg-stone-900 p-4 shadow-sm ring-1 ring-stone-800 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-stone-100">Measurements</h2>
        <button
          type="button"
          onClick={onScanClick}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/30 active:bg-amber-500/25"
        >
          <CameraIcon />
          Scan from photo
        </button>
      </div>

      {/* Column labels (hidden on the very narrow layout) */}
      <div className="mb-1 hidden grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-stone-500 sm:grid">
        <span>Length (ft)</span>
        <span />
        <span>Width (ft)</span>
        <span className="text-right">Sq ft</span>
        <span />
      </div>

      <ul className="space-y-2">
        {rows.map((row) => {
          const area = rowSqft(row);
          return (
            <li
              key={row.id}
              className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2"
            >
              <input
                inputMode="decimal"
                enterKeyHint="next"
                placeholder="0"
                aria-label="Length in feet"
                value={row.length}
                onChange={(e) => update(row.id, "length", e.target.value)}
                className="h-14 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 text-center text-lg tabular-nums text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
              />
              <span className="text-lg font-medium text-stone-500">×</span>
              <input
                inputMode="decimal"
                enterKeyHint="next"
                placeholder="0"
                aria-label="Width in feet"
                value={row.width}
                onChange={(e) => update(row.id, "width", e.target.value)}
                className="h-14 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 text-center text-lg tabular-nums text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
              />
              <span className="w-16 text-right text-sm font-semibold tabular-nums text-stone-300">
                {area > 0 ? sqft(area) : "—"}
              </span>
              <button
                type="button"
                onClick={() => remove(row.id)}
                aria-label="Remove row"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-500 active:bg-stone-800"
              >
                <TrashIcon />
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={add}
        className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-stone-700 text-sm font-semibold text-stone-400 active:bg-stone-800"
      >
        <PlusIcon />
        Add measurement
      </button>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-500 px-4 py-3 text-stone-950">
        <span className="text-sm font-medium text-stone-900/70">Total area</span>
        <span className="text-2xl font-bold tabular-nums">
          {sqft(total)} <span className="text-base font-normal text-stone-900/60">sq ft</span>
        </span>
      </div>
    </section>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
