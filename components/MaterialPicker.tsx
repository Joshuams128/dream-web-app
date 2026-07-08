"use client";

import { useEffect, useRef, useState } from "react";
import type { Material, SuggestResult } from "@/lib/types";
import { newId } from "@/lib/store";
import { rate as fmtRate } from "@/lib/format";

interface Props {
  materials: Material[];
  materialId: string | null;
  customName: string;
  onPick: (m: Material) => void;
  onCustomName: (name: string) => void;
  onSaveSuggested: (m: Material) => void;
}

type SuggestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: SuggestResult }
  | { status: "error"; message: string };

export default function MaterialPicker({
  materials,
  materialId,
  customName,
  onPick,
  onCustomName,
  onSaveSuggested,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggest, setSuggest] = useState<SuggestState>({ status: "idle" });
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the input text in sync with the parent's selection / custom name.
  useEffect(() => {
    const display = materialId
      ? materials.find((m) => m.id === materialId)?.name ?? ""
      : customName;
    setQuery(display);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId, customName]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const trimmed = query.trim();
  const matches = trimmed
    ? materials.filter((m) => m.name.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 8)
    : materials.slice(0, 8);
  const exact = materials.some((m) => m.name.toLowerCase() === trimmed.toLowerCase());
  const showSuggestPrompt = trimmed.length > 1 && !exact && !materialId;

  const handleType = (value: string) => {
    setQuery(value);
    setOpen(true);
    setSuggest({ status: "idle" });
    onCustomName(value); // clears any selected material in the parent
  };

  const pick = (m: Material) => {
    onPick(m);
    setOpen(false);
    setSuggest({ status: "idle" });
  };

  const runSuggest = async () => {
    setSuggest({ status: "loading" });
    try {
      const res = await fetch("/api/suggest-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material: trimmed }),
      });
      const data: SuggestResult & { error?: string } = await res.json();
      if (!res.ok) {
        setSuggest({ status: "error", message: data.error ?? "Couldn't fetch a suggestion." });
        return;
      }
      setSuggest({ status: "done", result: data });
    } catch {
      setSuggest({ status: "error", message: "Couldn't reach the server. Try again." });
    }
  };

  const saveSuggested = () => {
    if (suggest.status !== "done") return;
    const r = suggest.result;
    const m: Material = {
      id: newId("ai"),
      name: trimmed,
      category: "Custom",
      materialLow: 0,
      materialHigh: 0,
      installedLow: r.low,
      installedHigh: r.high,
      unit: r.unit || "sq ft",
      notes: `AI-suggested market range. ${r.notes}`.trim(),
      updatedAt: new Date().toISOString(),
      source: "ai",
    };
    onSaveSuggested(m);
    setSuggest({ status: "idle" });
    setOpen(false);
  };

  return (
    <section className="rounded-2xl bg-stone-900 p-4 shadow-sm ring-1 ring-stone-800 sm:p-5">
      <h2 className="mb-3 text-lg font-semibold text-stone-100">Material / work</h2>

      <div ref={boxRef} className="relative">
        <input
          value={query}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="e.g. red oak hardwood, vinyl plank, tile install…"
          className="h-14 w-full rounded-xl border border-stone-700 bg-stone-900 px-4 text-base text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
        />

        {open && matches.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-800 bg-stone-900 py-1 shadow-lg">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-stone-800"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-stone-100">{m.name}</span>
                    <span className="text-xs text-stone-500">{m.category}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-stone-400">
                    {fmtRate(m.installedLow)}–{fmtRate(m.installedHigh)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showSuggestPrompt && suggest.status === "idle" && (
        <div className="mt-3 rounded-xl bg-stone-800 p-3 ring-1 ring-stone-800">
          <p className="text-sm text-stone-300">
            <span className="font-medium">&ldquo;{trimmed}&rdquo;</span> isn&apos;t in your price list.
          </p>
          <button
            type="button"
            onClick={runSuggest}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white active:bg-indigo-700"
          >
            <SparkleIcon />
            Get AI price suggestion
          </button>
        </div>
      )}

      {suggest.status === "loading" && (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-stone-800 p-3 ring-1 ring-stone-800">
          <MiniSpinner />
          <span className="text-sm text-stone-300">Checking Ontario market prices…</span>
        </div>
      )}

      {suggest.status === "error" && (
        <div className="mt-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-500/30">
          {suggest.message}
          <button type="button" onClick={runSuggest} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {suggest.status === "done" && (
        <div className="mt-3 rounded-xl bg-indigo-500/10 p-4 ring-1 ring-indigo-500/30">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300">
            <SparkleIcon />
            Suggested market range — verify before quoting
          </div>
          <p className="text-2xl font-bold tabular-nums text-indigo-100">
            {fmtRate(suggest.result.low)} – {fmtRate(suggest.result.high)}
            <span className="text-sm font-normal text-indigo-400"> / sq ft installed</span>
          </p>
          {suggest.result.notes && (
            <p className="mt-1 text-sm text-indigo-300">{suggest.result.notes}</p>
          )}
          {suggest.result.sources.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {suggest.result.sources.slice(0, 3).map((s) => (
                <li key={s.url} className="truncate text-xs text-indigo-400">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={saveSuggested}
            className="mt-3 h-11 w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white active:bg-indigo-700"
          >
            Save to price list &amp; use it
          </button>
          <p className="mt-2 text-center text-xs text-indigo-400">
            Saving makes it editable in Settings. It is never added to a quote until you use it.
          </p>
        </div>
      )}
    </section>
  );
}

function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2zM19 14l.9 2.6L22 17.5l-2.1.9L19 21l-.9-2.6L16 17.5l2.1-.9L19 14z" />
    </svg>
  );
}
function MiniSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
