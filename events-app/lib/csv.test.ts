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

  describe("CSV/formula injection", () => {
    // Attendee-supplied fields (name, company, position) reach this
    // serializer from the public, unauthenticated registration form —
    // a leading =/+/-/@ must never reach a spreadsheet as a live formula.
    it.each([
      ["=1+1", "'=1+1"],
      ["+1234", "'+1234"],
      ["-1234", "'-1234"],
      ["@SUM(A1:A2)", "'@SUM(A1:A2)"],
      ["\tevil", "'\tevil"],
    ])("prefixes a leading formula trigger with a quote: %s", (input, expected) => {
      const csv = toCsv(["name"], [[input]]);
      expect(csv).toBe(`name\r\n${expected}`);
    });

    it("still quotes the cell if the formula-prefixed value also contains a comma", () => {
      const csv = toCsv(["name"], [['=HYPERLINK("http://evil.example","x")']]);
      expect(csv).toBe('name\r\n"\'=HYPERLINK(""http://evil.example"",""x"")"');
    });

    it("does not touch a value with a formula character in the middle", () => {
      const csv = toCsv(["name"], [["Jean-Luc"]]);
      expect(csv).toBe("name\r\nJean-Luc");
    });
  });
});
