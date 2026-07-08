import { NextResponse } from "next/server";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import type { ExtractResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACCEPTED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// The client downscales/compresses before upload, so real payloads are small
// (a few hundred KB). This cap is only a backstop against a runaway request,
// so it's set high enough that full-size phone photos never get rejected.
const MAX_BYTES = 30 * 1024 * 1024;

const PROMPT = `Extract all length × width measurements from this handwritten note. The measurements are room dimensions in feet, written like "16.5 x 11" or "29X17". Return ONLY a JSON array of objects: [{"length": 16.5, "width": 11}]. Ignore totals, prices, and any text that isn't a dimension pair. If there are no measurements, return [].`;

/** Strip markdown code fences and pull out the first JSON array in the text. */
function parseJsonArray(text: string): unknown {
  let t = text.trim();
  // Remove ```json ... ``` or ``` ... ``` fences if present.
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Fall back to the first [...] block anywhere in the response.
  if (!t.startsWith("[")) {
    const start = t.indexOf("[");
    const end = t.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      t = t.slice(start, end + 1);
    }
  }
  return JSON.parse(t);
}

/** Keep only sane room dimensions: positive, non-zero, not absurdly large. */
function sanitize(raw: unknown): { length: number; width: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { length: number; width: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const length = Number((item as Record<string, unknown>).length);
    const width = Number((item as Record<string, unknown>).width);
    if (!Number.isFinite(length) || !Number.isFinite(width)) continue;
    if (length <= 0 || width <= 0) continue;
    if (length > 1000 || width > 1000) continue; // reject absurd values
    out.push({
      length: Math.round(length * 100) / 100,
      width: Math.round(width * 100) / 100,
    });
  }
  return out;
}

export async function POST(req: Request) {
  const limit = checkRateLimit(`extract:${clientIp(req)}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const client = getAnthropic();
  if (!client) {
    return NextResponse.json(
      { error: "Server is not configured with an Anthropic API key." },
      { status: 500 },
    );
  }

  let imageBase64: string;
  let mediaType: string;
  try {
    const body = await req.json();
    imageBase64 = String(body.imageBase64 ?? "");
    mediaType = String(body.mediaType ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!imageBase64 || !ACCEPTED_MEDIA.has(mediaType)) {
    return NextResponse.json(
      { error: "Please upload a JPG, PNG, WEBP, or GIF image." },
      { status: 400 },
    );
  }

  // Rough size guard (base64 is ~4/3 of the byte size).
  if (imageBase64.length * 0.75 > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Please use a smaller photo or screenshot." },
      { status: 413 },
    );
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" }, // fast, cheap OCR — no reasoning needed
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: imageBase64,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

    let rows: { length: number; width: number }[] = [];
    try {
      rows = sanitize(parseJsonArray(text));
    } catch {
      rows = [];
    }

    const result: ExtractResult = {
      rows,
      message:
        rows.length === 0
          ? "Couldn't find measurements in that photo — try a clearer shot or enter them manually."
          : undefined,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("extract-measurements error:", err);
    return NextResponse.json(
      { error: "Couldn't read that photo right now. Please try again or enter measurements manually." },
      { status: 502 },
    );
  }
}
