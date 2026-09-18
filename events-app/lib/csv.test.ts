import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]]);
    expect(csv).toBe("a,b\r\n1,2");
  });

  it("quotes values containing commas", () => {
    const csv = toCsv(["name"], [["Doe, Jane"]]);
    expect(csv).toBe('name\r\n"Doe, Jane"');
  });

  it("escapes embedded quotes by doubling them", () => {
    const csv = toCsv(["note"], [['She said "hi"']]);
    expect(csv).toBe('note\r\n"She said ""hi"""');
  });

  it("quotes values containing newlines", () => {
    const csv = toCsv(["note"], [["line1\nline2"]]);
    expect(csv).toBe('note\r\n"line1\nline2"');
  });

  it("leaves plain values unquoted", () => {
    const csv = toCsv(["email"], [["jane@example.com"]]);
    expect(csv).toBe("email\r\njane@example.com");
  });
});
