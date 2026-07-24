import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting with two tiers:
 *
 *  1. DURABLE (preferred) - when UPSTASH_REDIS_REST_URL / _TOKEN are set, limits
 *     are enforced globally across every serverless instance via Upstash Redis
 *     (sliding window). This is the real quota.
 *
 *  2. IN-PROCESS FALLBACK - if Upstash isn't configured OR the backend errors,
 *     we fall back to a per-instance fixed-window counter. It only bounds bursts
 *     against a single warm instance, but it means a misconfiguration or an
 *     Upstash outage never hard-fails a request.
 *
 * Either way this FAILS OPEN: a legitimate user is never blocked because of an
 * infrastructure problem.
 */

export type RateResult = { ok: boolean; retryAfterSeconds: number };

// ---- in-process fallback --------------------------------------------------

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000 && buckets.size < 10_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function memoryLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { ok: true, retryAfterSeconds: 0 };
}

// ---- durable (Upstash) ----------------------------------------------------

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

// One Ratelimit instance per distinct (limit, window) config, cached.
const limiters = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  const cfg = `${limit}:${windowMs}`;
  let limiter = limiters.get(cfg);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "kbg-rl",
      analytics: false,
    });
    limiters.set(cfg, limiter);
  }
  return limiter;
}

/**
 * Counts one hit against `key`, allowing up to `limit` hits per `windowMs`.
 * Prefers the durable Upstash backend; falls back to in-memory and fails open.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  const limiter = getLimiter(limit, windowMs);
  if (!limiter) return memoryLimit(key, limit, windowMs);
  try {
    const res = await limiter.limit(key);
    return {
      ok: res.success,
      retryAfterSeconds: res.success
        ? 0
        : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  } catch (err) {
    // Backend hiccup must never block a real user - fall open (and still get a
    // weak per-instance bound from the in-memory limiter).
    console.error("Rate-limit backend error; failing open:", err);
    return memoryLimit(key, limit, windowMs);
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function ipFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}
