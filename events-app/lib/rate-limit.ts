import "server-only";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Rate limiter contract. Every call site (public registration,
 * check-in) goes through this interface via `checkRateLimit()` below,
 * not a concrete implementation directly — so swapping the
 * implementation before public launch means changing the single
 * `limiter =` assignment in this file, not touching app/api/** or
 * app/e/**.
 */
export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): RateLimitResult;
}

/**
 * DEVELOPMENT / SINGLE-INSTANCE PROTECTION ONLY — not production-grade
 * rate limiting. State is a `Map` local to one Node process: it does
 * not share counts across multiple serverless instances, does not
 * survive a process restart, and offers no real protection the moment
 * more than one instance is running (which is the normal case once
 * this is deployed, not an edge case). It exists to blunt the most
 * naive abuse during MVP development, nothing stronger.
 *
 * Replace with a durable-store implementation (e.g. Upstash Redis, or
 * any store shared across instances) behind the `RateLimiter` interface
 * above before relying on this for public launch. Deliberately not
 * added now — this MVP doesn't need a paid dependency yet.
 */
class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }

    if (bucket.count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    bucket.count += 1;
    return { allowed: true, remaining: limit - bucket.count };
  }
}

const limiter: RateLimiter = new InMemoryRateLimiter();

/** The active rate limiter. See the `RateLimiter` docs above before relying on this. */
export function getRateLimiter(): RateLimiter {
  return limiter;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  return limiter.check(key, limit, windowMs);
}

export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
