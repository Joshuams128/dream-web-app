import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client factory. The API key lives in ANTHROPIC_API_KEY
 * and is read here, inside route handlers, so it is never bundled to the client.
 *
 * Returns null when the key is missing so routes can respond with a clear 500
 * instead of throwing an opaque SDK error.
 */
export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

/** Newest Sonnet — used for the vision + web-search assist routes. */
export const MODEL = "claude-sonnet-5";
