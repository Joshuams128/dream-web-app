/**
 * Dead-simple in-memory fixed-window rate limiter to keep a misbehaving client
 * from burning API credits. Keyed by client IP.
 *
 * NOTE: in-memory state does not survive across serverless cold starts or span
 * multiple Vercel instances, so this is a lightweight guardrail, not a hard
 * quota. For production-grade limiting, swap the Map for an Upstash Redis
 * counter (see README) — the checkRateLimit signature stays the same.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 12; // per IP per window

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1, retryAfterSec: 0 };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: MAX_REQUESTS - existing.count,
    retryAfterSec: 0,
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
