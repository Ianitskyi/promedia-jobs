import { describe, it, expect } from "vitest";
import { isValidTokenFormat } from "./tokens";

describe("isValidTokenFormat", () => {
  it("accepts a base64url token of the expected length (32 random bytes)", () => {
    // 32 bytes -> 43 base64 chars without padding.
    const token = "A".repeat(43);
    expect(isValidTokenFormat(token)).toBe(true);
  });

  it("rejects tokens that are too short", () => {
    expect(isValidTokenFormat("short")).toBe(false);
  });

  it("rejects tokens containing characters outside the base64url alphabet", () => {
    const withPlus = "+".repeat(43);
    const withSlash = "/".repeat(43);
    expect(isValidTokenFormat(withPlus)).toBe(false);
    expect(isValidTokenFormat(withSlash)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidTokenFormat("")).toBe(false);
  });

  it("never reveals attendee data by construction — it only checks shape", () => {
    // Documents the invariant from ARCHITECTURE.md §5: the validator
    // has no notion of attendee/email/id, so it cannot leak any.
    expect(isValidTokenFormat("not-an-email@example.com")).toBe(false);
  });
});
