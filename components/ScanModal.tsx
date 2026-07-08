"use client";

import { useRef, useState } from "react";
import type { MeasurementRow, ExtractResult } from "@/lib/types";
import { makeRow } from "./MeasurementRows";
import { sqft, toNumber } from "@/lib/format";
import { prepareImage } from "@/lib/image";

type Phase = "select" | "loading" | "review" | "error";
type Draft = { length: string; width: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (rows: MeasurementRow[]) => void;
}

export default function ScanModal({ open, onClose, onConfirm }: Props) {
  const [phase, setPhase] = useState<Phase>("select");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("Reading your measurements…");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setPhase("select");
    setDrafts([]);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };
  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const type = (file.type || "").toLowerCase();
    const looksLikeImage =
      type.startsWith("image/") || type === "" || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name);
    if (!looksLikeImage) {
      setError("Please choose an image file (photo, screenshot, JPG, PNG, or HEIC).");
      setPhase("error");
      return;
    }
    setPhase("loading");
    setError("");
    setLoadingLabel("Preparing your photo…");
    try {
      // Convert HEIC → JPEG and downscale/compress in the browser so uploads
      // stay small and iPhone photos work.
      const { base64, mediaType } = await prepareImage(file, (stage) =>
        setLoadingLabel(
          stage === "converting" ? "Converting iPhone photo…" : "Preparing your photo…",
        ),
      );
      setLoadingLabel("Reading your measurements…");
      const res = await fetch("/api/extract-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data: ExtractResult & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong reading that photo.");
        setPhase("error");
        return;
      }
      if (!data.rows || data.rows.length === 0) {
        setError(
          data.message ??
            "Couldn't find measurements in that photo — try a clearer shot or enter them manually.",
        );
        setPhase("error");
        return;
      }
      setDrafts(data.rows.map((r) => ({ length: String(r.length), width: String(r.width) })));
      setPhase("review");
    } catch {
      setError(
        "Couldn't process that photo. Try another image, a screenshot, or enter measurements manually.",
      );
      setPhase("error");
    }
  };

  const setDraft = (i: number, field: keyof Draft, value: string) => {
    const v = value.replace(/[^0-9.]/g, "");
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));
  };
  const removeDraft = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));

  const confirm = () => {
    const rows = drafts
      .filter((d) => toNumber(d.length) > 0 && toNumber(d.width) > 0)
      .map((d) => makeRow(d.length, d.width));
    onConfirm(rows.length ? rows : []);
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl bg-stone-900 shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-stone-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-stone-100">Scan measurements</h3>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 active:bg-stone-800"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {phase === "select" && (
            <div className="text-center">
              <p className="mb-5 text-sm text-stone-400">
                Take a photo of your handwritten measurements, or upload one from your gallery.
                Best results with a clear, well-lit shot.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/10 text-amber-300 active:bg-amber-500/20"
              >
                <CameraIcon />
                <span className="text-base font-semibold">Take / upload photo</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <p className="mt-4 text-xs text-stone-500">
                Works with iPhone HEIC photos, screenshots, JPG and PNG. Large photos are
                automatically shrunk before upload.
              </p>
            </div>
          )}

          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Spinner />
              <p className="mt-4 text-base font-medium text-stone-200">{loadingLabel}</p>
              <p className="mt-1 text-sm text-stone-500">This usually takes a few seconds.</p>
            </div>
          )}

          {phase === "error" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                <AlertIcon />
              </div>
              <p className="text-sm text-stone-300">{error}</p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="h-12 flex-1 rounded-xl bg-amber-500 font-semibold text-white active:bg-amber-600"
                >
                  Try another photo
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="h-12 flex-1 rounded-xl bg-stone-800 font-semibold text-stone-200 active:bg-stone-700"
                >
                  Enter manually
                </button>
              </div>
            </div>
          )}

          {phase === "review" && (
            <div>
              <div className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/30">
                Handwriting scans can misread numbers. Please check each value before confirming.
              </div>
              <ul className="space-y-2">
                {drafts.map((d, i) => {
                  const area = toNumber(d.length) * toNumber(d.width);
                  return (
                    <li key={i} className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2">
                      <input
                        inputMode="decimal"
                        aria-label="Length"
                        value={d.length}
                        onChange={(e) => setDraft(i, "length", e.target.value)}
                        className="h-12 w-full rounded-lg border border-stone-700 px-2 text-center text-base tabular-nums focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
                      />
                      <span className="text-stone-500">×</span>
                      <input
                        inputMode="decimal"
                        aria-label="Width"
                        value={d.width}
                        onChange={(e) => setDraft(i, "width", e.target.value)}
                        className="h-12 w-full rounded-lg border border-stone-700 px-2 text-center text-base tabular-nums focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
                      />
                      <span className="w-14 text-right text-xs font-semibold tabular-nums text-stone-400">
                        {area > 0 ? sqft(area) : "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDraft(i)}
                        aria-label="Remove"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 active:bg-stone-800"
                      >
                        <CloseIcon />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {drafts.length === 0 && (
                <p className="py-4 text-center text-sm text-stone-500">
                  All rows removed. Close and enter manually, or try another photo.
                </p>
              )}
            </div>
          )}
        </div>

        {phase === "review" && (
          <div className="flex gap-3 border-t border-stone-800 px-5 py-4">
            <button
              type="button"
              onClick={reset}
              className="h-12 flex-1 rounded-xl bg-stone-800 font-semibold text-stone-200 active:bg-stone-700"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={drafts.length === 0}
              className="h-12 flex-[2] rounded-xl bg-amber-500 font-semibold text-white active:bg-amber-600 disabled:opacity-40"
            >
              Add {drafts.length} row{drafts.length === 1 ? "" : "s"} to calculator
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-10 w-10 animate-spin text-amber-500" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
    </svg>
  );
}
