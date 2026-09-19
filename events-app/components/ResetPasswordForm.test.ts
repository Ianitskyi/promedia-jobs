import { describe, it, expect } from "vitest";
import { AuthWeakPasswordError, AuthApiError } from "@supabase/supabase-js";
import { statusFromSearch, resolveUpdatePasswordError } from "./ResetPasswordForm";
import { en, uk } from "@/lib/i18n/dictionaries";

describe("statusFromSearch", () => {
  it("stays in 'verifying' when there is no error query parameter", () => {
    expect(statusFromSearch("")).toBe("verifying");
  });

  it("treats a Supabase 'error' query parameter as an invalid/expired link", () => {
    expect(statusFromSearch("?error=access_denied&error_description=Email+link+is+invalid")).toBe(
      "invalid",
    );
  });

  it("treats a Supabase 'error_code' query parameter as an invalid/expired link", () => {
    expect(statusFromSearch("?error_code=otp_expired")).toBe("invalid");
  });
});

describe("resolveUpdatePasswordError", () => {
  it("returns the localized weak-password message for AuthWeakPasswordError, in English", () => {
    const error = new AuthWeakPasswordError("Password too weak", 422, ["length"]);
    expect(resolveUpdatePasswordError(error, en)).toBe(en.auth.resetPasswordRejected);
  });

  it("returns the localized weak-password message for AuthWeakPasswordError, in Ukrainian", () => {
    const error = new AuthWeakPasswordError("Password too weak", 422, ["length"]);
    expect(resolveUpdatePasswordError(error, uk)).toBe(uk.auth.resetPasswordRejected);
  });

  it("never surfaces the raw Supabase error message for any other error type", () => {
    const error = new AuthApiError("some internal implementation detail", 500, "unexpected_failure");
    const message = resolveUpdatePasswordError(error, en);
    expect(message).toBe(en.common.genericError);
    expect(message).not.toContain("internal implementation detail");
  });
});
