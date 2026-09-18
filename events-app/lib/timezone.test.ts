import { describe, it, expect } from "vitest";
import { zonedTimeToUtc } from "./timezone";

describe("zonedTimeToUtc", () => {
  it("converts UTC noon to itself", () => {
    const result = zonedTimeToUtc("2026-06-15", "12:00", "UTC");
    expect(result.toISOString()).toBe("2026-06-15T12:00:00.000Z");
  });

  it("accounts for a fixed negative offset (no DST)", () => {
    // Arizona (America/Phoenix) doesn't observe DST: UTC-7 year-round.
    const result = zonedTimeToUtc("2026-06-15", "09:00", "America/Phoenix");
    expect(result.toISOString()).toBe("2026-06-15T16:00:00.000Z");
  });

  it("accounts for a fixed positive offset", () => {
    const result = zonedTimeToUtc("2026-06-15", "09:00", "Asia/Tokyo");
    expect(result.toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  it("handles the summer DST offset for a zone that observes it", () => {
    // Europe/Kyiv is UTC+3 in summer (EEST).
    const result = zonedTimeToUtc("2026-07-01", "10:00", "Europe/Kyiv");
    expect(result.toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
});
