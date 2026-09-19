import { describe, it, expect } from "vitest";
import { extractTokenFromScan } from "./scan";

const VALID_TOKEN = "A".repeat(43);

describe("extractTokenFromScan", () => {
  it("extracts the token from a full ticket URL", () => {
    expect(extractTokenFromScan(`https://events.example.com/t/${VALID_TOKEN}`)).toBe(
      VALID_TOKEN,
    );
  });

  it("accepts a bare token", () => {
    expect(extractTokenFromScan(VALID_TOKEN)).toBe(VALID_TOKEN);
  });

  it("returns null for an unrelated QR payload", () => {
    expect(extractTokenFromScan("https://example.com/completely-unrelated")).toBeNull();
  });

  it("returns null for garbage text", () => {
    expect(extractTokenFromScan("not a url or a token")).toBeNull();
  });

  it("returns null for an empty scan", () => {
    expect(extractTokenFromScan("")).toBeNull();
  });
});
