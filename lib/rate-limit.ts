/**
 * In-memory rate limiter for expensive endpoints (draft proposal).
 *
 * Scope: single-instance only. Resets on process restart. Good enough for P0 demo —
 * production uses Upstash Redis or Vercel KV with a per-user key.
 *
 * Prevents accidental API spam costing money during the demo.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export function rateLimit(key: string, opts: { max: number; windowMs: number }): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true };
  }

  if (bucket.count >= opts.max) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true };
}
