"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Material, Section, SessionState } from "@/lib/types";
import { getMaterials, saveMaterials, getSession, saveSession, newId } from "@/lib/store";
import { createClient } from "@/utils/supabase/client";
import { makeRow } from "@/components/MeasurementRows";
import SectionCard from "@/components/SectionCard";
import QuoteSummary from "@/components/QuoteSummary";
import ScanModal from "@/components/ScanModal";
import InvoiceModal from "@/components/InvoiceModal";
import { sectionLines } from "@/lib/quote";

function makeSection(name = ""): Section {
  return {
    id: newId("sec"),
    name,
    rows: [makeRow()],
    materialId: null,
    customMaterialName: "",
    rateBasis: "installed",
    rateLow: 0,
    rateHigh: 0,
  };
}

function defaultSession(): SessionState {
  return {
    sections: [makeSection()],
    contingencyPct: 0,
    hstPct: 13,
  };
}

export default function Home() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [session, setSession] = useState<SessionState>(defaultSession);
  const [ready, setReady] = useState(false);
  const [scanTarget, setScanTarget] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

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
          sections: saved.sections?.length ? saved.sections : [makeSection()],
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

  const patchSection = (id: string, p: Partial<Section>) =>
    setSession((s) => ({
      ...s,
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...p } : sec)),
    }));

  const addSection = () =>
    setSession((s) => ({ ...s, sections: [...s.sections, makeSection()] }));

  const removeSection = (id: string) =>
    setSession((s) => {
      const next = s.sections.filter((sec) => sec.id !== id);
      return { ...s, sections: next.length ? next : [makeSection()] };
    });

  const onAddMaterial = async (m: Material) => {
    const next = [m, ...materials];
    setMaterials(next);
    await saveMaterials(next);
  };

  const onScanConfirm = (scanned: ReturnType<typeof makeRow>[]) => {
    if (!scanTarget || scanned.length === 0) return;
    setSession((s) => ({
      ...s,
      sections: s.sections.map((sec) => {
        if (sec.id !== scanTarget) return sec;
        const existing = sec.rows.filter((r) => r.length !== "" || r.width !== "");
        return { ...sec, rows: [...existing, ...scanned] };
      }),
    }));
  };

  const newQuote = () => setSession(defaultSession());

  const lines = sectionLines(session.sections, (id) => materials.find((m) => m.id === id)?.name);

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
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-stone-600 ring-1 ring-stone-200 active:bg-stone-100"
          >
            <SignOutIcon />
          </button>
        </div>
      </header>

      <div className="space-y-4">
        <div className="no-print space-y-4">
          {session.sections.map((sec, i) => (
            <SectionCard
              key={sec.id}
              index={i}
              section={sec}
              materials={materials}
              canRemove={session.sections.length > 1}
              onPatch={(p) => patchSection(sec.id, p)}
              onRemove={() => removeSection(sec.id)}
              onScanClick={() => setScanTarget(sec.id)}
              onAddMaterial={onAddMaterial}
            />
          ))}

          <button
            type="button"
            onClick={addSection}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 text-sm font-semibold text-stone-600 active:bg-stone-50"
          >
            <PlusIcon />
            Add section (room / area)
          </button>
        </div>

        <QuoteSummary
          lines={lines}
          contingencyPct={session.contingencyPct}
          hstPct={session.hstPct}
          onContingency={(n) => patch({ contingencyPct: n })}
          onHst={(n) => patch({ hstPct: n })}
          onCreateInvoice={() => setInvoiceOpen(true)}
        />
      </div>

      <ScanModal
        open={scanTarget !== null}
        onClose={() => setScanTarget(null)}
        onConfirm={onScanConfirm}
      />

      <InvoiceModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        lines={lines}
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

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
