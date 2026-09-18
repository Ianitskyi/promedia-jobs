import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, clientIpFrom, getRateLimiter } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 3, 60_000)).toEqual({ allowed: true, remaining: 2 });
    expect(checkRateLimit(key, 3, 60_000)).toEqual({ allowed: true, remaining: 1 });
    expect(checkRateLimit(key, 3, 60_000)).toEqual({ allowed: true, remaining: 0 });
  });

  it("rejects requests once the limit is exceeded within the window", () => {
    const key = `test:${Math.random()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    expect(checkRateLimit(key, 2, 60_000)).toEqual({ allowed: false, remaining: 0 });
  });

  it("tracks separate keys independently", () => {
    const keyA = `test:a:${Math.random()}`;
    const keyB = `test:b:${Math.random()}`;
    checkRateLimit(keyA, 1, 60_000);
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });

  describe("window reset", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("allows requests again once the window has elapsed", () => {
      const key = `test:${Math.random()}`;
      checkRateLimit(key, 1, 1000);
      expect(checkRateLimit(key, 1, 1000).allowed).toBe(false);

      vi.advanceTimersByTime(1001);

      expect(checkRateLimit(key, 1, 1000).allowed).toBe(true);
    });
  });
});

describe("getRateLimiter", () => {
  it("exposes the RateLimiter interface directly (the seam a durable implementation replaces)", () => {
    const limiter = getRateLimiter();
    const key = `test:direct:${Math.random()}`;
    expect(limiter.check(key, 1, 60_000)).toEqual({ allowed: true, remaining: 0 });
    expect(limiter.check(key, 1, 60_000)).toEqual({ allowed: false, remaining: 0 });
  });
});

describe("clientIpFrom", () => {
  it("prefers the first address in x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIpFrom(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFrom(headers)).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' if neither header is present", () => {
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});
