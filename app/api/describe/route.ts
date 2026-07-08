import { NextResponse } from "next/server";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Generates a short, professional invoice line-item description from the chosen
 * material/work and the measured area — e.g. "red oak hardwood" over 646 sq ft
 * becomes a one-sentence "Supply and installation of solid red oak hardwood
 * flooring…" line. Editable by the user before export.
 */
export async function POST(req: Request) {
  const limit = checkRateLimit(`describe:${clientIp(req)}`);
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
  let sqft: number;
  let description: string;
  let type: string;
  try {
    const body = await req.json();
    material = String(body.material ?? "").trim();
    sqft = Number(body.sqft);
    description = String(body.description ?? "").trim();
    type = String(body.type ?? "description").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!material || material.length > 120) {
    return NextResponse.json({ error: "Please select a material first." }, { status: 400 });
  }

  const areaText = Number.isFinite(sqft) && sqft > 0 ? `${Math.round(sqft * 100) / 100} sq ft` : "the measured area";

  // ── Notes / disclaimer generation ─────────────────────────────────────────
  if (type === "notes") {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 220,
        thinking: { type: "disabled" },
        system:
          "You write professional notes and disclaimer sections for construction/renovation estimates. Generate 2–3 sentences of plain-text disclaimer tailored to the specific work. Include relevant caveats about site conditions, unforeseen structural or hazardous material issues, and scope changes requiring written approval. Be concise and professional. Return only the disclaimer text — no heading, no bullets, no markdown.",
        messages: [
          {
            role: "user",
            content: `Work type: ${material}. Area: ${areaText}.${description ? ` Scope: ${description}` : ""}`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const notes = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
      if (!notes) {
        return NextResponse.json(
          { error: "Couldn't generate notes. You can type them instead." },
          { status: 502 },
        );
      }
      return NextResponse.json({ notes });
    } catch (err) {
      console.error("describe/notes error:", err);
      return NextResponse.json(
        { error: "Couldn't generate notes right now. You can type them instead." },
        { status: 502 },
      );
    }
  }

  // ── Line-item description (default) ───────────────────────────────────────
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 160,
      thinking: { type: "disabled" },
      system:
        "You write concise, professional invoice line-item descriptions for a construction/renovation company. Return ONE sentence, max 30 words, describing supply and/or installation as appropriate for the material. No preamble, no quotes, no markdown — just the sentence.",
      messages: [
        {
          role: "user",
          content: `Material/work: ${material}. Area: ${areaText}.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const result =
      textBlock && textBlock.type === "text" ? textBlock.text.trim().replace(/^["']|["']$/g, "") : "";

    if (!result) {
      return NextResponse.json(
        { error: "Couldn't generate a description. You can type one instead." },
        { status: 502 },
      );
    }
    return NextResponse.json({ description: result });
  } catch (err) {
    console.error("describe error:", err);
    return NextResponse.json(
      { error: "Couldn't generate a description right now. You can type one instead." },
      { status: 502 },
    );
  }
}
