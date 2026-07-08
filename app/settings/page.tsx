"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Material } from "@/lib/types";
import { getMaterials, saveMaterials, resetMaterials, newId } from "@/lib/store";
import type { SuggestResult } from "@/lib/types";

function clean(value: string): number {
  const v = value.replace(/[^0-9.]/g, "");
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function SettingsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [ready, setReady] = useState(false);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMaterials().then((m) => {
      if (active) {
        setMaterials(m);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ready) saveMaterials(materials);
  }, [materials, ready]);

  const update = (id: string, field: keyof Material, value: string) => {
    setMaterials((list) =>
      list.map((m) => {
        if (m.id !== id) return m;
        const numeric = ["materialLow", "materialHigh", "installedLow", "installedHigh"].includes(field);
        return {
          ...m,
          [field]: numeric ? clean(value) : value,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  };

  const addMaterial = () => {
    const m: Material = {
      id: newId("custom"),
      name: "",
      category: "Custom",
      materialLow: 0,
      materialHigh: 0,
      installedLow: 0,
      installedHigh: 0,
      unit: "sq ft",
      notes: "",
      updatedAt: new Date().toISOString(),
      source: "custom",
    };
    setMaterials((list) => [m, ...list]);
  };

  const remove = (id: string) => setMaterials((list) => list.filter((m) => m.id !== id));

  const suggestPrice = async (id: string, name: string) => {
    if (!name.trim()) return;
    setSuggestingId(id);
    try {
      const res = await fetch("/api/suggest-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material: name }),
      });
      const data: SuggestResult & { error?: string } = await res.json();
      if (!res.ok || !data.low) return;
      setMaterials((list) =>
        list.map((m) =>
          m.id !== id
            ? m
            : {
                ...m,
                installedLow: data.low,
                installedHigh: data.high,
                notes: data.notes ? data.notes.slice(0, 120) : m.notes,
                source: "ai" as Material["source"],
                updatedAt: new Date().toISOString(),
              },
        ),
      );
    } catch {
      // silent — user can enter manually
    } finally {
      setSuggestingId(null);
    }
  };

  const reset = async () => {
    if (!confirm("Reset the price list to the default seed prices? Your custom edits will be lost.")) {
      return;
    }
    const seeded = await resetMaterials();
    setMaterials(seeded);
  };

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-stone-500">Loading…</main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 pb-20 pt-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Back to calculator"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900 text-stone-300 ring-1 ring-stone-800 active:bg-stone-800"
          >
            <BackIcon />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-100">Price list</h1>
            <p className="text-sm text-stone-400">Your prices — always used over internet averages</p>
          </div>
        </div>
      </header>

      <div className="mb-4 flex gap-3">
        <button
          type="button"
          onClick={addMaterial}
          className="h-12 flex-1 rounded-xl bg-amber-500 font-semibold text-white active:bg-amber-600"
        >
          + Add material
        </button>
        <button
          type="button"
          onClick={reset}
          className="h-12 rounded-xl bg-stone-900 px-4 font-semibold text-stone-300 ring-1 ring-stone-800 active:bg-stone-800"
        >
          Reset
        </button>
      </div>

      <p className="mb-3 text-xs text-stone-500">
        Changes save automatically. Prices are per sq ft in CAD. Leave material cost at 0 for
        labour-only items.
      </p>

      <ul className="space-y-3">
        {materials.map((m) => (
          <li key={m.id} className="rounded-2xl bg-stone-900 p-4 shadow-sm ring-1 ring-stone-800">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={m.name}
                placeholder="Material name"
                onChange={(e) => update(m.id, "name", e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-stone-700 px-3 py-2 text-base font-medium text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
              />
              {/* Auto-price button — shown whenever there is a name */}
              {m.name.trim() && (
                <button
                  type="button"
                  disabled={suggestingId === m.id}
                  onClick={() => suggestPrice(m.id, m.name)}
                  title="Suggest price from GTA market data"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 text-xs font-semibold text-white active:bg-indigo-700 disabled:opacity-50"
                >
                  {suggestingId === m.id ? <MiniSpinner /> : <SparkleIcon />}
                  {suggestingId === m.id ? "Searching…" : "Auto-price"}
                </button>
              )}
              <SourceBadge source={m.source} />
              <button
                type="button"
                onClick={() => remove(m.id)}
                aria-label="Delete material"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-500 active:bg-stone-800"
              >
                <TrashIcon />
              </button>
            </div>

            <input
              value={m.category}
              placeholder="Category"
              onChange={(e) => update(m.id, "category", e.target.value)}
              className="mb-3 w-full rounded-lg border border-stone-800 px-3 py-1.5 text-sm text-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <PriceField label="Material low" value={m.materialLow} onChange={(v) => update(m.id, "materialLow", v)} />
              <PriceField label="Material high" value={m.materialHigh} onChange={(v) => update(m.id, "materialHigh", v)} />
              <PriceField label="Installed low" value={m.installedLow} onChange={(v) => update(m.id, "installedLow", v)} />
              <PriceField label="Installed high" value={m.installedHigh} onChange={(v) => update(m.id, "installedHigh", v)} />
            </div>

            <input
              value={m.notes ?? ""}
              placeholder="Notes (optional)"
              onChange={(e) => update(m.id, "notes", e.target.value)}
              className="mt-3 w-full rounded-lg border border-stone-800 px-3 py-2 text-sm text-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </li>
        ))}
      </ul>

      {materials.length === 0 && (
        <p className="py-10 text-center text-sm text-stone-500">
          No materials yet. Add one, or reset to the default price list.
        </p>
      )}
    </main>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-stone-500">$</span>
        <input
          inputMode="decimal"
          value={value || ""}
          placeholder="0.00"
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-lg border border-stone-700 pr-2 pl-6 text-base tabular-nums text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
        />
      </div>
    </label>
  );
}

function SourceBadge({ source }: { source: Material["source"] }) {
  const map: Record<Material["source"], { label: string; cls: string }> = {
    seed: { label: "Seed", cls: "bg-stone-800 text-stone-400" },
    custom: { label: "Custom", cls: "bg-emerald-500/15 text-emerald-300" },
    ai: { label: "AI", cls: "bg-indigo-500/15 text-indigo-300" },
  };
  const { label, cls } = map[source];
  return <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" />
    </svg>
  );
}

function MiniSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
