/**
 * Converts a wall-clock date + time in a given IANA timezone to a UTC
 * Date, using only the Intl API (no date library dependency).
 *
 * Used for registration_deadline, the one place we need to compare
 * "now" against a moment the organizer picked in the event's declared
 * timezone. Event start/end date+time+timezone are otherwise stored
 * and displayed as-is (no UTC conversion needed for display).
 */
export function zonedTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMs);
}

/**
 * Inverse of zonedTimeToUtc: renders a UTC instant as the
 * "YYYY-MM-DDTHH:mm" wall-clock digits it corresponds to in the given
 * IANA timezone, suitable for pre-filling an
 * `<input type="datetime-local">` so editing a stored timestamptz
 * (e.g. registration_deadline) round-trips through the *event's*
 * timezone rather than the browser's.
 */
export function utcToZonedDatetimeLocal(isoUtc: string, timeZone: string): string {
  const date = new Date(isoUtc);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** How far `timeZone`'s wall clock is ahead of UTC at `date`, in ms. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return asUtc - date.getTime();
}
