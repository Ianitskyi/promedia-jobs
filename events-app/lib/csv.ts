/** Minimal RFC 4180 CSV serializer — no dependency needed for this shape of data. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    let s = String(value);
    // Neutralize CSV/formula injection (CWE-1236): a cell starting with
    // =, +, -, @, tab, or CR can be interpreted as a formula by Excel/
    // Sheets when opened. Row data here includes attendee-supplied
    // fields (name, company, position) from the public, unauthenticated
    // registration form, so this isn't just defense in depth.
    if (/^[=+\-@\t\r]/.test(s)) {
      s = `'${s}`;
    }
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(","));
  return lines.join("\r\n");
}
