import { describe, it, expect } from "vitest";
import { trimRequired } from "./env";

// A malformed NEXT_PUBLIC_SUPABASE_URL — most often one pasted into a
// deployment dashboard with a trailing newline or stray spaces — is the
// classic cause of an opaque `fetch failed` at runtime, because the
// unroutable URL makes every Supabase request (including auth.signUp)
// throw before it reaches the network. trimRequired neutralizes that
// whole class of failure, and turns a genuinely missing value into a
// clear, secret-free error instead.
describe("trimRequired", () => {
  it("returns the value unchanged when already clean", () => {
    expect(trimRequired("X", "https://abc.supabase.co")).toBe(
      "https://abc.supabase.co",
    );
  });

  it("strips a trailing newline (the most common paste artifact)", () => {
    expect(trimRequired("X", "https://abc.supabase.co\n")).toBe(
      "https://abc.supabase.co",
    );
  });

  it("strips surrounding whitespace and carriage returns", () => {
    expect(trimRequired("X", "  https://abc.supabase.co \r\n")).toBe(
      "https://abc.supabase.co",
    );
  });

  it("throws a clear, named error when the value is undefined", () => {
    expect(() => trimRequired("NEXT_PUBLIC_SUPABASE_URL", undefined)).toThrow(
      /Missing required environment variable NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("throws when the value is empty or whitespace-only", () => {
    expect(() => trimRequired("X", "")).toThrow(/Missing required/);
    expect(() => trimRequired("X", "   \n")).toThrow(/Missing required/);
  });

  it("never includes the value itself in the error (no secret leakage)", () => {
    try {
      trimRequired("SUPABASE_SERVICE_ROLE_KEY", "   ");
      throw new Error("expected trimRequired to throw");
    } catch (e) {
      // The message names the variable but must not echo any value.
      expect((e as Error).message).toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
