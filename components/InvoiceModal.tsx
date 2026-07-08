"use client";

import { useEffect, useState } from "react";
import type { BusinessInfo, ClientInfo } from "@/lib/types";
import type { SectionLine } from "@/lib/quote";
import { getBusiness, saveBusiness } from "@/lib/store";
import { exportInvoicePdf, invoiceTotals, lineAmount, type InvoiceLine } from "@/lib/invoice";
import { money, sqft as fmtSqft } from "@/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  lines: SectionLine[];
  contingencyPct: number;
  hstPct: number;
}

/** Editable scope line: an InvoiceLine plus a stable key for the list. */
interface EditLine extends InvoiceLine {
  id: string;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" });
}

/** Turn each priced section into a firm (single-rate) invoice line. */
function toEditLines(lines: SectionLine[]): EditLine[] {
  return lines.map((l) => ({
    id: l.id,
    description: l.materialName ? `${l.name} — ${l.materialName}` : l.name,
    area: l.area,
    rate: l.rateHigh > 0 ? l.rateHigh : l.rateLow,
  }));
}

export default function InvoiceModal({ open, onClose, lines, contingencyPct, hstPct }: Props) {
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [client, setClient] = useState<ClientInfo>({ name: "", address: "", email: "" });
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(todayISO());
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [serviceAddress, setServiceAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [exporting, setExporting] = useState(false);

  const DEFAULT_NOTES =
    "This estimate is based on current site conditions as observed. Additional costs may apply if unforeseen conditions are discovered during construction (e.g., structural issues, code violations, hidden damage, or hazardous materials). Changes or additions to the scope of work requested by the customer will be quoted separately and require written approval before proceeding.";

  // Initialise from persisted business info + the current quote each time the modal opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    getBusiness().then((b) => {
      if (!active) return;
      setBusiness(b);
      setInvoiceNumber(`INV-${String(b.invoiceCounter).padStart(4, "0")}`);
    });
    setDate(todayISO());
    // Client details are per-invoice and never persisted — clear them each open
    // so a new estimate starts blank and no client's info carries over.
    setClient({ name: "", address: "", email: "" });
    setServiceAddress("");
    setEditLines(toEditLines(lines));
    setNotesError("");
    setNotes(DEFAULT_NOTES);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Persist ONLY the owner's business info (never the client). It carries to the
  // next invoice; the "Bill to" fields above stay local and reset on each open.
  useEffect(() => {
    if (business) saveBusiness(business);
  }, [business]);

  if (!open || !business) {
    return open ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 text-white">
        Loading…
      </div>
    ) : null;
  }

  const t = invoiceTotals(editLines, contingencyPct, hstPct);
  const totalSqft = editLines.reduce((sum, l) => sum + l.area, 0);
  const materialsLabel =
    lines.map((l) => l.materialName).filter(Boolean).join(", ") || "the work";
  const anyRange = lines.some((l) => l.isRange);

  const setBiz = (field: keyof BusinessInfo, value: string) =>
    setBusiness((b) => (b ? { ...b, [field]: value } : b));
  const rateNum = (v: string) => {
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const setLine = (id: string, patch: Partial<EditLine>) =>
    setEditLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const generateNotes = async () => {
    setGeneratingNotes(true);
    setNotesError("");
    try {
      const res = await fetch("/api/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material: materialsLabel,
          sqft: totalSqft,
          description: editLines.map((l) => l.description).join("; "),
          type: "notes",
        }),
      });
      const payload: { notes?: string; error?: string } = await res.json();
      if (!res.ok || !payload.notes) {
        setNotesError(payload.error ?? "Couldn't generate notes.");
        return;
      }
      setNotes(payload.notes);
    } catch {
      setNotesError("Couldn't reach the server.");
    } finally {
      setGeneratingNotes(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportInvoicePdf({
        business,
        client,
        serviceAddress,
        invoiceNumber,
        dateLabel: formatDate(date),
        lines: editLines.map(({ description, area, rate }) => ({ description, area, rate })),
        notes,
        contingencyPct,
        hstPct,
      });
      // Bump the counter for the next invoice.
      setBusiness((b) => (b ? { ...b, invoiceCounter: b.invoiceCounter + 1 } : b));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col rounded-t-3xl bg-stone-900 shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-stone-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-stone-100">Create invoice</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 active:bg-stone-800"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          {/* Your business */}
          <Fieldset title="Your business (saved for next time)">
            <Field label="Business name" value={business.name} onChange={(v) => setBiz("name", v)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Phone" value={business.phone} onChange={(v) => setBiz("phone", v)} />
              <Field label="Email" value={business.email} onChange={(v) => setBiz("email", v)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Business address" value={business.address} onChange={(v) => setBiz("address", v)} />
              <Field label="HST #" value={business.hstNumber} onChange={(v) => setBiz("hstNumber", v)} />
            </div>
          </Fieldset>

          {/* Invoice meta */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Invoice #" value={invoiceNumber} onChange={setInvoiceNumber} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-lg border border-stone-700 px-3 text-base text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
              />
            </label>
          </div>

          {/* Bill to */}
          <Fieldset title="Bill to (your client)">
            <Field label="Client name" value={client.name} onChange={(v) => setClient({ ...client, name: v })} />
            <Field label="Billing address" value={client.address} onChange={(v) => setClient({ ...client, address: v })} />
            <Field label="Email / phone" value={client.email} onChange={(v) => setClient({ ...client, email: v })} />
          </Fieldset>

          {/* Job site */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">Job site / service address</span>
            <input
              value={serviceAddress}
              placeholder={business.address || "398 Adelaide St W, Toronto, ON"}
              onChange={(e) => setServiceAddress(e.target.value)}
              className="h-11 w-full rounded-lg border border-stone-700 px-3 text-base text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
          </label>

          {/* Scope of work — one line per section */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Scope of work</span>
              {anyRange && (
                <span className="text-xs text-stone-500">Ranges collapsed to a firm rate — adjust below</span>
              )}
            </div>
            <ul className="space-y-3">
              {editLines.map((l) => (
                <li key={l.id} className="rounded-xl bg-stone-800 p-3 ring-1 ring-stone-800">
                  <textarea
                    rows={2}
                    value={l.description}
                    onChange={(e) => setLine(l.id, { description: e.target.value })}
                    className="w-full resize-none rounded-lg border border-stone-700 px-3 py-2 text-sm text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-stone-400 tabular-nums">{fmtSqft(l.area)} sq ft</span>
                    <label className="flex items-center gap-2">
                      <span className="text-xs font-medium text-stone-400">Rate $/sq ft</span>
                      <input
                        inputMode="decimal"
                        value={l.rate || ""}
                        placeholder="0.00"
                        onChange={(e) => setLine(l.id, { rate: rateNum(e.target.value) })}
                        className="h-10 w-24 rounded-lg border border-stone-700 px-2 text-center text-base tabular-nums focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
                      />
                    </label>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums text-stone-100">
                      {money(lineAmount(l))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Notes & Disclaimer */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Notes &amp; Disclaimer</span>
              <button
                type="button"
                onClick={generateNotes}
                disabled={generatingNotes}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white active:bg-indigo-700 disabled:opacity-50"
              >
                {generatingNotes ? <MiniSpinner /> : <SparkleIcon />}
                {generatingNotes ? "Writing…" : "AI rewrite"}
              </button>
            </div>
            <textarea
              rows={4}
              value={notes}
              placeholder="Notes and disclaimer text printed at the bottom of the estimate…"
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-stone-700 px-3 py-2 text-sm text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
            />
            {notesError && <p className="mt-1 text-xs text-red-600">{notesError}</p>}
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-stone-800 p-4 ring-1 ring-stone-800">
            <p className="mb-3 text-sm text-stone-400">
              {editLines.length} line{editLines.length === 1 ? "" : "s"} · {fmtSqft(totalSqft)} sq ft total
            </p>
            <dl className="space-y-1 text-sm">
              <Line label="Subtotal" value={money(t.subtotal)} />
              {contingencyPct > 0 && <Line label={`Contingency (${contingencyPct}%)`} value={money(t.contingency)} />}
              <Line label={`HST (${hstPct}%)`} value={money(t.hst)} />
              <div className="flex items-center justify-between border-t border-stone-800 pt-2 text-base font-bold text-stone-100">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(t.total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="border-t border-stone-800 px-5 py-4">
          <button
            type="button"
            onClick={exportPdf}
            disabled={exporting}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-stone-100 py-3.5 font-semibold text-stone-900 active:bg-stone-200 disabled:opacity-60"
          >
            <DownloadIcon />
            {exporting ? "Preparing PDF…" : "Export invoice PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-stone-700 px-3 text-base text-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
      />
    </label>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-400">{label}</dt>
      <dd className="font-medium tabular-nums text-stone-100">{value}</dd>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
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
