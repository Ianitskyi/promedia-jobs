import { describe, it, expect } from "vitest";
import { zonedTimeToUtc, utcToZonedDatetimeLocal } from "./timezone";

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

describe("utcToZonedDatetimeLocal", () => {
  it("is the inverse of zonedTimeToUtc for a fixed-offset zone", () => {
    const utc = zonedTimeToUtc("2026-06-15", "09:00", "America/Phoenix");
    expect(utcToZonedDatetimeLocal(utc.toISOString(), "America/Phoenix")).toBe(
      "2026-06-15T09:00",
    );
  });

  it("is the inverse of zonedTimeToUtc across Europe/Kyiv, Europe/Berlin, America/New_York", () => {
    for (const timeZone of ["Europe/Kyiv", "Europe/Berlin", "America/New_York"]) {
      const utc = zonedTimeToUtc("2026-07-01", "14:00", timeZone);
      expect(utcToZonedDatetimeLocal(utc.toISOString(), timeZone)).toBe("2026-07-01T14:00");
    }
  });

  it("renders the same UTC instant differently for different target zones", () => {
    const utcNoon = "2026-06-15T12:00:00.000Z";
    expect(utcToZonedDatetimeLocal(utcNoon, "UTC")).toBe("2026-06-15T12:00");
    expect(utcToZonedDatetimeLocal(utcNoon, "America/Phoenix")).toBe("2026-06-15T05:00");
    expect(utcToZonedDatetimeLocal(utcNoon, "Asia/Tokyo")).toBe("2026-06-15T21:00");
  });
});
