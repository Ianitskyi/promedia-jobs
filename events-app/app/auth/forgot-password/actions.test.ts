import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { en, uk } from "@/lib/i18n/dictionaries";
import { getAppUrl } from "@/lib/url";

let mockResetPasswordForEmail: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;
let currentIp: string;

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": currentIp }),
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  }),
}));

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

let ipCounter = 0;

beforeEach(() => {
  mockResetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
  // A fresh IP per test — the rate limiter is a module-level singleton,
  // so sharing one IP across tests would let earlier tests consume the
  // budget a later test relies on.
  ipCounter += 1;
  currentIp = `203.0.113.${ipCounter}`;
});

describe("requestPasswordReset", () => {
  it("sends the reset email and reports the neutral 'sent' state for a valid email", async () => {
    const { requestPasswordReset } = await import("./actions");
    const result = await requestPasswordReset(
      { status: "idle", error: null },
      formDataWith({ email: "andrii@example.com" }),
    );
    expect(result).toEqual({ status: "sent", error: null });
    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed email before ever calling Supabase", async () => {
    const { requestPasswordReset } = await import("./actions");
    const result = await requestPasswordReset(
      { status: "idle", error: null },
      formDataWith({ email: "not-an-email" }),
    );
    expect(result.status).toBe("error");
    expect(result.error).toBe(uk.auth.validationEmail);
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("SECURITY: still reports the neutral 'sent' state even if Supabase returns a generic error", async () => {
    // Supabase's own resetPasswordForEmail never reveals whether the
    // email is registered — this defends the same contract at the app
    // layer, so a future/unexpected error type can't accidentally leak
    // account existence through a different response shape.
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { name: "AuthApiError", message: "some internal detail", status: 400 },
    });
    const { requestPasswordReset } = await import("./actions");
    const result = await requestPasswordReset(
      { status: "idle", error: null },
      formDataWith({ email: "nobody@example.com" }),
    );
    expect(result).toEqual({ status: "sent", error: null });
  });

  it("reports a distinct network error on a transport failure, without revealing account existence", async () => {
    mockResetPasswordForEmail.mockRejectedValue(new Error("fetch failed"));
    const { requestPasswordReset } = await import("./actions");
    const result = await requestPasswordReset(
      { status: "idle", error: null },
      formDataWith({ email: "andrii@example.com" }),
    );
    expect(result.status).toBe("error");
    expect(result.error).toBe(uk.common.networkError);
  });

  it("reports a distinct network error when Supabase itself returns a retryable fetch error", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: new AuthRetryableFetchError("Service temporarily unavailable", 503),
    });
    const { requestPasswordReset } = await import("./actions");
    const result = await requestPasswordReset(
      { status: "idle", error: null },
      formDataWith({ email: "andrii@example.com" }),
    );
    expect(result.status).toBe("error");
    expect(result.error).toBe(uk.common.networkError);
  });

  it("reports too-many-attempts when Supabase itself rate-limits the request", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: new AuthApiError("Email rate limit exceeded", 429, "over_email_send_rate_limit"),
    });
    const { requestPasswordReset } = await import("./actions");
    const result = await requestPasswordReset(
      { status: "idle", error: null },
      formDataWith({ email: "andrii@example.com" }),
    );
    expect(result.status).toBe("error");
    expect(result.error).toBe(uk.auth.forgotPasswordTooManyAttempts);
  });

  it("rate-limits repeated requests from the same IP", async () => {
    const { requestPasswordReset } = await import("./actions");
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = await requestPasswordReset(
        { status: "idle", error: null },
        formDataWith({ email: `attempt-${i}@example.com` }),
      );
    }
    expect(last).toEqual({ status: "error", error: uk.auth.forgotPasswordTooManyAttempts });
  });

  it("SECURITY: builds the redirect URL from the app's configured public URL only — no attacker-controlled field can change it", async () => {
    const { requestPasswordReset } = await import("./actions");
    await requestPasswordReset(
      { status: "idle", error: null },
      formDataWith({
        email: "andrii@example.com",
        // None of these are read by the schema/action at all — proves
        // there is no field an attacker could add to influence the
        // redirect target (an open-redirect vector).
        redirectTo: "https://evil.example.com",
        next: "https://evil.example.com",
        redirect: "https://evil.example.com",
      }),
    );
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      "andrii@example.com",
      { redirectTo: `${getAppUrl()}/auth/reset-password` },
    );
  });

  it("SECURITY: never imports or references the service-role/admin Supabase client", () => {
    const source = readFileSync(fileURLToPath(new URL("./actions.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/supabase\/admin/);
    expect(source).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("English dictionary carries the exact required neutral message", () => {
    expect(en.auth.forgotPasswordNeutralMessage).toBe(
      "If an account with this email address exists, we have sent password reset instructions.",
    );
  });

  it("Ukrainian dictionary carries the exact required neutral message", () => {
    expect(uk.auth.forgotPasswordNeutralMessage).toBe(
      "Якщо обліковий запис із такою електронною адресою існує, ми надіслали інструкції для зміни пароля.",
    );
  });
});
