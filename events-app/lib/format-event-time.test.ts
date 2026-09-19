import { describe, it, expect } from "vitest";
import { formatEventDateTime, formatCalendarDate } from "./format-event-time";

describe("formatEventDateTime", () => {
  // en-US locale for deterministic assertions; the app itself calls
  // this with the viewer's own locale (undefined).

  it("formats correctly for Europe/Kyiv (UTC+3 in summer)", () => {
    const result = formatEventDateTime("2026-07-01", "14:00", "Europe/Kyiv", "en-US");
    expect(result).toContain("July 1, 2026");
    expect(result).toContain("2:00 PM");
  });

  it("formats correctly for Europe/Berlin (UTC+1 in winter)", () => {
    const result = formatEventDateTime("2026-01-15", "09:30", "Europe/Berlin", "en-US");
    expect(result).toContain("January 15, 2026");
    expect(result).toContain("9:30 AM");
  });

  it("formats correctly for America/New_York (UTC-5 in winter)", () => {
    const result = formatEventDateTime("2026-01-15", "09:30", "America/New_York", "en-US");
    expect(result).toContain("January 15, 2026");
    expect(result).toContain("9:30 AM");
  });

  it("formats correctly for America/New_York in summer (DST, UTC-4)", () => {
    const result = formatEventDateTime("2026-07-01", "09:30", "America/New_York", "en-US");
    expect(result).toContain("July 1, 2026");
    expect(result).toContain("9:30 AM");
  });

  it("the displayed wall-clock digits depend only on the passed timeZone, not the runtime's own zone — the same date+time digits produce identical output across different target zones (since each is that zone's own wall clock, by definition of how the value was entered)", () => {
    const kyiv = formatEventDateTime("2026-03-10", "18:00", "Europe/Kyiv", "en-US");
    const newYork = formatEventDateTime("2026-03-10", "18:00", "America/New_York", "en-US");
    // Different zones, same input digits -> same displayed digits.
    // A regression to "parse as ambient local time" would instead make
    // these differ (or worse, both come out identical to whatever the
    // *test runner's* local zone produces, unrelated to either
    // Europe/Kyiv or America/New_York).
    expect(kyiv).toContain("March 10, 2026");
    expect(kyiv).toContain("6:00 PM");
    expect(newYork).toContain("March 10, 2026");
    expect(newYork).toContain("6:00 PM");
  });

  it("handles a date right at a DST spring-forward boundary in the target zone without shifting the displayed digits", () => {
    // 2026-03-08 is a US DST transition date (02:00 -> 03:00 doesn't
    // exist that day in America/New_York); an implementation that
    // parses via `new Date(\`${date}T${time}\`)` as *ambient local*
    // time is exactly what would misbehave here if the test runner's
    // own zone also observes DST on a different date. This asserts
    // formatEventDateTime is immune because it never parses the
    // date/time as local at all.
    const result = formatEventDateTime("2026-03-08", "10:00", "America/New_York", "en-US");
    expect(result).toContain("March 8, 2026");
    expect(result).toContain("10:00 AM");
  });
});

describe("formatCalendarDate", () => {
  it("never shifts a date-only string by a day regardless of the runtime's zone", () => {
    // new Date("2026-01-01") parses as UTC midnight; naively formatting
    // with the ambient local zone shows "December 31, 2025" in any
    // negative-UTC-offset zone. Explicit timeZone: "UTC" avoids that.
    expect(formatCalendarDate("2026-01-01", "en-US")).toBe("January 1, 2026");
  });

  it("formats an end-of-month date correctly", () => {
    expect(formatCalendarDate("2026-12-31", "en-US")).toBe("December 31, 2026");
  });
});

describe("timezone formatting is correct in both interface locales", () => {
  // The `locale` parameter to formatEventDateTime/formatCalendarDate is
  // purely a *display* concern (month/weekday names, AM/PM vs 24h) —
  // independent of the `timeZone` correctness already covered above.
  // These lock in that both interface languages the app ships produce
  // sane, non-empty, correctly-dated output — not just whichever one
  // the earlier tests happened to use.

  it("renders Ukrainian month/day names for a uk locale, same underlying instant as English", () => {
    const uk = formatEventDateTime("2026-07-01", "14:00", "Europe/Kyiv", "uk");
    const en = formatEventDateTime("2026-07-01", "14:00", "Europe/Kyiv", "en-US");
    expect(uk).toContain("липня");
    expect(uk).toContain("2026");
    expect(uk).toContain("14:00");
    expect(en).toContain("July 1, 2026");
    expect(en).toContain("2:00 PM");
    // Same wall-clock time, just formatted differently — not different times.
    expect(uk).not.toBe(en);
  });

  it("renders a Ukrainian calendar date correctly, matching the same UTC-anchored day as English", () => {
    expect(formatCalendarDate("2026-01-01", "uk")).toContain("січня");
    expect(formatCalendarDate("2026-01-01", "uk")).toContain("2026");
    expect(formatCalendarDate("2026-01-01", "en-US")).toBe("January 1, 2026");
  });

  it("keeps DST-boundary correctness in the Ukrainian locale too", () => {
    const result = formatEventDateTime("2026-03-08", "10:00", "America/New_York", "uk");
    expect(result).toContain("2026");
    expect(result).toContain("10:00");
  });
});
