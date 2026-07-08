"use client";

import { useState } from "react";
import type { MeasurementRow } from "@/lib/types";
import { computeQuote, quoteText } from "@/lib/quote";
import { money, sqft, rate as fmtRate } from "@/lib/format";

interface Props {
  materialName: string;
  rows: MeasurementRow[];
  rateLow: number;
  rateHigh: number;
  contingencyPct: number;
  hstPct: number;
  onContingency: (n: number) => void;
  onHst: (n: number) => void;
  onCreateInvoice: () => void;
}

function pct(value: string): number {
  const n = parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function span(low: number, high: number, isRange: boolean): string {
  return isRange ? `${money(low)} – ${money(high)}` : money(low);
}

export default function QuoteSummary({
  materialName,
  rows,
  rateLow,
  rateHigh,
  contingencyPct,
  hstPct,
  onContingency,
  onHst,
  onCreateInvoice,
}: Props) {
  const [copied, setCopied] = useState(false);
  const q = computeQuote(rows, rateLow, rateHigh, contingencyPct, hstPct);
  const rateStr = q.isRange ? `${fmtRate(q.rateLow)}–${fmtRate(q.rateHigh)}` : fmtRate(q.rateLow);

  const copy = async () => {
    const text = quoteText(materialName, q, contingencyPct, hstPct);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without the async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="print-area rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
      <div className="mb-4 border-b border-stone-200 pb-3">
        <h2 className="text-lg font-semibold text-stone-900">Quote summary</h2>
        <p className="text-sm text-stone-500">
          {materialName || "No material selected"}
        </p>
      </div>

      {/* The math, always visible so the quote is defensible. */}
      <div className="mb-4 rounded-xl bg-stone-50 px-4 py-3 ring-1 ring-stone-200">
        <p className="text-center text-sm font-medium tabular-nums text-stone-700 sm:text-base">
          {sqft(q.totalSqft)} sq ft × {rateStr} = {span(q.subtotalLow, q.subtotalHigh, q.isRange)}
        </p>
      </div>

      {/* Adjustable inputs (hidden when printing). */}
      <div className="no-print mb-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
            Contingency %
          </span>
          <input
            inputMode="decimal"
            value={contingencyPct || ""}
            placeholder="0"
            onChange={(e) => onContingency(pct(e.target.value))}
            className="h-12 w-full rounded-xl border border-stone-300 px-3 text-center text-base tabular-nums focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-400">
            HST %
          </span>
          <input
            inputMode="decimal"
            value={hstPct}
            onChange={(e) => onHst(pct(e.target.value))}
            className="h-12 w-full rounded-xl border border-stone-300 px-3 text-center text-base tabular-nums focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
          />
        </label>
      </div>

      <dl className="space-y-2 text-sm">
        <Line label="Total area" value={`${sqft(q.totalSqft)} sq ft`} />
        <Line label="Rate / sq ft" value={rateStr} />
        <Line label="Subtotal" value={span(q.subtotalLow, q.subtotalHigh, q.isRange)} />
        {contingencyPct > 0 && (
          <Line
            label={`Contingency (${contingencyPct}%)`}
            value={span(q.contingencyLow, q.contingencyHigh, q.isRange)}
          />
        )}
        <Line label={`HST (${hstPct}%)`} value={span(q.hstLow, q.hstHigh, q.isRange)} />
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-4">
        <span className="text-base font-semibold text-stone-900">Grand total</span>
        <span className="text-2xl font-bold tabular-nums text-stone-900">
          {span(q.grandLow, q.grandHigh, q.isRange)}
        </span>
      </div>

      <div className="no-print mt-5 flex gap-3">
        <button
          type="button"
          onClick={copy}
          className="flex h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-stone-900 py-3.5 font-semibold text-white active:bg-stone-700"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied!" : "Copy quote"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-stone-100 py-3.5 font-semibold text-stone-800 active:bg-stone-200"
        >
          <PrintIcon />
          Print / PDF
        </button>
      </div>

      <button
        type="button"
        onClick={onCreateInvoice}
        className="no-print mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 font-semibold text-white active:bg-amber-600"
      >
        <InvoiceIcon />
        Turn into invoice
      </button>
    </section>
  );
}

function InvoiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" />
    </svg>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className="font-medium tabular-nums text-stone-900">{value}</dd>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function PrintIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
    </svg>
  );
}
