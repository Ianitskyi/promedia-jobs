import { zonedTimeToUtc } from "@/lib/timezone";

/**
 * Formats an event's wall-clock start (or end) date+time for display,
 * correctly rendered in the event's own configured IANA timezone —
 * never in whatever timezone the server process happens to be running
 * in.
 *
 * `start_date`/`start_time` are stored as the wall-clock time the
 * organizer entered for `timezone` (see ARCHITECTURE.md §4/§9): there
 * is no UTC conversion to "undo" for display, but there IS a real
 * timezone-database lookup needed to render it — weekday names, month
 * boundaries, and DST-adjacent instants all depend on it. The previous
 * implementation built a plain `new Date(\`${date}T${time}\`)` (parsed
 * as local time in whatever zone the Node process happens to run in)
 * and then merely appended the event's timezone as a trailing label —
 * the displayed digits never actually depended on `timeZone` at all,
 * they just happened to look right because parsing and formatting both
 * used the same ambient zone. That's fragile (silently wrong the
 * moment either side of that round trip changes) and demonstrably
 * wrong exactly at a DST transition in the *server's* zone.
 *
 * This instead round-trips through `zonedTimeToUtc` (an Intl-based,
 * environment-independent conversion) and formats the result with
 * `Intl.DateTimeFormat`'s own `timeZone` option — so the displayed
 * value is always genuinely derived from `timeZone`, not the runtime's
 * ambient zone, and is the same regardless of which region a server
 * happens to execute in.
 */
export function formatEventDateTime(
  dateStr: string,
  timeStr: string,
  timeZone: string,
  locale?: string,
): string {
  const instant = zonedTimeToUtc(dateStr, timeStr, timeZone);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  }).format(instant);
}

/**
 * Formats a date-only "YYYY-MM-DD" string (no time-of-day, e.g. as a
 * quick reference in an events list) without ever risking an off-by-
 * one-day shift. `new Date("YYYY-MM-DD")` parses as UTC midnight per
 * spec, so formatting it with the ambient local zone (no explicit
 * `timeZone`) shows the *previous* day for any negative UTC offset —
 * classic date-only-string bug. Explicitly formatting in UTC keeps the
 * parse and format symmetric on purpose, rather than symmetric by
 * accident on whatever zone the runtime happens to default to.
 */
export function formatCalendarDate(dateStr: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateStr}T00:00:00Z`));
}
