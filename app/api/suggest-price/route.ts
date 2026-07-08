import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import type { SuggestResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_RESUMES = 3;

function buildPrompt(material: string): string {
  return `What is the typical INSTALLED price per square foot, in Canadian dollars, for "${material}" in the Toronto / Greater Toronto Area, Ontario, Canada in 2026? Search the web for current local pricing.

Return ONLY a JSON object of this exact shape and nothing else:
{"low": <number>, "high": <number>, "notes": "<one short sentence of context>"}

low and high are the per-square-foot dollar figures (numbers only, no "$"). Keep notes under 20 words.`;
}

function parseJsonObject(text: string): unknown {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!t.startsWith("{")) {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  }
  return JSON.parse(t);
}

/** Collect the assistant's final text + any web-search sources from a message. */
function collect(msg: Anthropic.Message, sources: SuggestResult["sources"]) {
  let text = "";
  for (const block of msg.content) {
    if (block.type === "text") {
      text += block.text;
    } else if (block.type === "web_search_tool_result") {
      const content = block.content;
      if (Array.isArray(content)) {
        for (const r of content) {
          if (
            r.type === "web_search_result" &&
            sources.length < 5 &&
            !sources.some((s) => s.url === r.url)
          ) {
            sources.push({ title: r.title, url: r.url });
          }
        }
      }
    }
  }
  return text;
}

export async function POST(req: Request) {
  const limit = checkRateLimit(`suggest:${clientIp(req)}`);
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

  let material: string;
  try {
    const body = await req.json();
    material = String(body.material ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!material || material.length > 120) {
    return NextResponse.json({ error: "Please enter a material name." }, { status: 400 });
  }

  try {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: buildPrompt(material) },
    ];
    const sources: SuggestResult["sources"] = [];
    let finalText = "";

    // Web search runs a server-side loop; on pause_turn we resume until done.
    for (let i = 0; i <= MAX_RESUMES; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        thinking: { type: "disabled" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
        messages,
      });

      finalText += collect(response, sources);

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      break;
    }

    let low = 0;
    let high = 0;
    let notes = "";
    try {
      const obj = parseJsonObject(finalText) as Record<string, unknown>;
      low = Number(obj.low);
      high = Number(obj.high);
      notes = typeof obj.notes === "string" ? obj.notes : "";
    } catch {
      // fall through to the validation below
    }

    if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0 || high > 500) {
      return NextResponse.json(
        { error: "Couldn't find a reliable price for that material. Try rephrasing, or enter a rate manually." },
        { status: 422 },
      );
    }
    if (low > high) [low, high] = [high, low];

    const result: SuggestResult = {
      low: Math.round(low * 100) / 100,
      high: Math.round(high * 100) / 100,
      unit: "sq ft",
      notes,
      sources,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("suggest-price error:", err);
    return NextResponse.json(
      { error: "Couldn't fetch a price suggestion right now. Please try again." },
      { status: 502 },
    );
  }
}
