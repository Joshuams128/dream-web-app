"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Material, RateBasis, SessionState } from "@/lib/types";
import { getMaterials, saveMaterials, getSession, saveSession } from "@/lib/store";
import MeasurementRows, { makeRow } from "@/components/MeasurementRows";
import MaterialPicker from "@/components/MaterialPicker";
import RateControls from "@/components/RateControls";
import QuoteSummary from "@/components/QuoteSummary";
import ScanModal from "@/components/ScanModal";
import InvoiceModal from "@/components/InvoiceModal";
import { totalSqft } from "@/lib/quote";

function defaultSession(): SessionState {
  return {
    rows: [makeRow()],
    materialId: null,
    customMaterialName: "",
    rateBasis: "installed",
    rateLow: 0,
    rateHigh: 0,
    contingencyPct: 0,
    hstPct: 13,
  };
}

export default function Home() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [session, setSession] = useState<SessionState>(defaultSession);
  const [ready, setReady] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  // Load persisted price list + session on mount (client-only localStorage).
  useEffect(() => {
    let active = true;
    (async () => {
      const [mats, saved] = await Promise.all([getMaterials(), getSession()]);
      if (!active) return;
      setMaterials(mats);
      if (saved) {
        setSession({
          ...defaultSession(),
          ...saved,
          rows: saved.rows?.length ? saved.rows : [makeRow()],
        });
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Persist the session whenever it changes (after the initial load).
  useEffect(() => {
    if (ready) saveSession(session);
  }, [session, ready]);

  const patch = (p: Partial<SessionState>) => setSession((s) => ({ ...s, ...p }));

  const selectedMaterial = session.materialId
    ? materials.find((m) => m.id === session.materialId) ?? null
    : null;
  const materialName = selectedMaterial?.name ?? session.customMaterialName;

  const pickMaterial = (m: Material) =>
    patch({
      materialId: m.id,
      customMaterialName: "",
      rateBasis: "installed",
      rateLow: m.installedLow,
      rateHigh: m.installedHigh,
    });

  const onBasis = (b: RateBasis) => {
    if (!selectedMaterial) return patch({ rateBasis: b });
    const low = b === "material" ? selectedMaterial.materialLow : selectedMaterial.installedLow;
    const high = b === "material" ? selectedMaterial.materialHigh : selectedMaterial.installedHigh;
    patch({ rateBasis: b, rateLow: low, rateHigh: high });
  };

  const onSaveSuggested = async (m: Material) => {
    const next = [m, ...materials];
    setMaterials(next);
    await saveMaterials(next);
    pickMaterial(m);
  };

  const onScanConfirm = (scanned: ReturnType<typeof makeRow>[]) => {
    if (scanned.length === 0) return;
    const existing = session.rows.filter((r) => r.length !== "" || r.width !== "");
    patch({ rows: [...existing, ...scanned] });
  };

  const newQuote = () => setSession(defaultSession());

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-stone-400">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 pb-16 pt-4">
      <header className="no-print mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Dream Build Group</h1>
          <p className="text-sm text-stone-500">Material price calculator</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={newQuote}
            className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-stone-600 ring-1 ring-stone-200 active:bg-stone-100"
          >
            New quote
          </button>
          <Link
            href="/settings"
            aria-label="Price list settings"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-stone-600 ring-1 ring-stone-200 active:bg-stone-100"
          >
            <GearIcon />
          </Link>
        </div>
      </header>

      <div className="space-y-4">
        <div className="no-print space-y-4">
          <MeasurementRows
            rows={session.rows}
            onChange={(rows) => patch({ rows })}
            onScanClick={() => setScanOpen(true)}
          />

          <MaterialPicker
            materials={materials}
            materialId={session.materialId}
            customName={session.customMaterialName}
            onPick={pickMaterial}
            onCustomName={(name) => patch({ materialId: null, customMaterialName: name })}
            onSaveSuggested={onSaveSuggested}
          />

          <RateControls
            material={selectedMaterial}
            rateBasis={session.rateBasis}
            rateLow={session.rateLow}
            rateHigh={session.rateHigh}
            onBasis={onBasis}
            onRate={(low, high) => patch({ rateLow: low, rateHigh: high })}
          />
        </div>

        <QuoteSummary
          materialName={materialName}
          rows={session.rows}
          rateLow={session.rateLow}
          rateHigh={session.rateHigh}
          contingencyPct={session.contingencyPct}
          hstPct={session.hstPct}
          onContingency={(n) => patch({ contingencyPct: n })}
          onHst={(n) => patch({ hstPct: n })}
          onCreateInvoice={() => setInvoiceOpen(true)}
        />
      </div>

      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} onConfirm={onScanConfirm} />

      <InvoiceModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        materialName={materialName}
        totalSqft={totalSqft(session.rows)}
        rateLow={session.rateLow}
        rateHigh={session.rateHigh}
        contingencyPct={session.contingencyPct}
        hstPct={session.hstPct}
      />
    </main>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
