import { describe, it, expect, beforeEach, vi } from "vitest";
import en from "@/lib/i18n/dictionaries/en";

// ---------------------------------------------------------------------------
// Mocks. The signup/signin server actions talk to Supabase Auth and the i18n
// layer and call next/navigation's redirect(); all three are stubbed so the
// tests exercise the action's own branching (error classification, redirects,
// and — critically — that signup never touches workspace/membership tables).
// ---------------------------------------------------------------------------

type AuthResult = {
  data: { session: unknown | null; user: unknown | null };
  error: { name?: string; status?: number; code?: string; message?: string } | null;
};

let signUpResult: AuthResult;
let signInResult: AuthResult;
let signUpCalls: Array<{ email: string; password: string }>;
let signInCalls: Array<{ email: string; password: string }>;
let fromCalls: string[];

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/i18n/server", () => ({
  getPlatformLocale: async () => "en",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signUp: async (creds: { email: string; password: string }) => {
        signUpCalls.push(creds);
        return signUpResult;
      },
      signInWithPassword: async (creds: { email: string; password: string }) => {
        signInCalls.push(creds);
        return signInResult;
      },
    },
    // If the signup path ever tried to provision a workspace or membership
    // it would have to go through .from(...) — recording every call lets the
    // tests assert it never does (Account != Workspace).
    from: (table: string) => {
      fromCalls.push(table);
      const builder = {
        insert: () => builder,
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data: null, error: null }),
      };
      return builder;
    },
  }),
}));

function form(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

const NETWORK_ERROR = {
  name: "AuthRetryableFetchError",
  status: 0,
  message: "fetch failed",
};

beforeEach(() => {
  signUpResult = { data: { session: null, user: null }, error: null };
  signInResult = { data: { session: null, user: null }, error: null };
  signUpCalls = [];
  signInCalls = [];
  fromCalls = [];
  vi.resetModules();
});

describe("signUp — error handling", () => {
  it("maps a transport failure to a friendly message and NEVER leaks the raw 'fetch failed'", async () => {
    signUpResult = { data: { session: null, user: null }, error: NETWORK_ERROR };
    const { signUp } = await import("./actions");

    const state = await signUp({ error: null }, form("a@example.com", "password123"));

    expect(state.error).toBe(en.auth.serviceUnavailable);
    expect(state.error).not.toBe("fetch failed");
    expect(state.error).not.toContain("fetch failed");
  });

  it("maps an already-registered email (422) to the friendly duplicate message", async () => {
    signUpResult = {
      data: { session: null, user: null },
      error: { name: "AuthApiError", status: 422, code: "user_already_exists", message: "User already registered" },
    };
    const { signUp } = await import("./actions");

    const state = await signUp({ error: null }, form("a@example.com", "password123"));

    expect(state.error).toBe(en.auth.emailAlreadyRegistered);
  });

  it("rejects invalid input without ever calling Supabase", async () => {
    const { signUp } = await import("./actions");

    const state = await signUp({ error: null }, form("not-an-email", "short"));

    expect(state.error).toBe(en.auth.invalidSignupInput);
    expect(signUpCalls).toHaveLength(0);
  });

  it("returns the confirm-email message (no error) when signup succeeds without a session", async () => {
    signUpResult = { data: { session: null, user: { id: "u1" } }, error: null };
    const { signUp } = await import("./actions");

    const state = await signUp({ error: null }, form("a@example.com", "password123"));

    expect(state.error).toBeNull();
    expect(state.message).toBe(en.auth.checkEmailToConfirm);
  });

  it("redirects to /dashboard when signup returns a session", async () => {
    signUpResult = { data: { session: { access_token: "t" }, user: { id: "u1" } }, error: null };
    const { signUp } = await import("./actions");

    await expect(
      signUp({ error: null }, form("a@example.com", "password123")),
    ).rejects.toThrow("REDIRECT:/dashboard");
  });
});

describe("signUp — Account != Person != Workspace", () => {
  it("SECURITY: creating an account never provisions a workspace or membership (no table writes)", async () => {
    // Success with an active session — the closest thing to "a brand-new
    // account is now signed in". Even here, signup must not create a
    // workspace or grant membership: those are service-role-only.
    signUpResult = { data: { session: { access_token: "t" }, user: { id: "u1" } }, error: null };
    const { signUp } = await import("./actions");

    await expect(
      signUp({ error: null }, form("owner@example.com", "password123")),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(fromCalls).toHaveLength(0);
  });

  it("SECURITY: signup without a session also performs no workspace/membership writes", async () => {
    signUpResult = { data: { session: null, user: { id: "u1" } }, error: null };
    const { signUp } = await import("./actions");

    await signUp({ error: null }, form("owner@example.com", "password123"));

    expect(fromCalls).toHaveLength(0);
  });
});

describe("signIn — error handling", () => {
  it("maps a transport failure to the service-unavailable message, not 'invalid credentials'", async () => {
    signInResult = { data: { session: null, user: null }, error: NETWORK_ERROR };
    const { signIn } = await import("./actions");

    const state = await signIn({ error: null }, form("a@example.com", "password123"));

    expect(state.error).toBe(en.auth.serviceUnavailable);
    expect(state.error).not.toContain("fetch failed");
  });

  it("maps a genuine auth failure to the invalid-credentials message", async () => {
    signInResult = {
      data: { session: null, user: null },
      error: { name: "AuthApiError", status: 400, code: "invalid_credentials", message: "Invalid login credentials" },
    };
    const { signIn } = await import("./actions");

    const state = await signIn({ error: null }, form("a@example.com", "password123"));

    expect(state.error).toBe(en.auth.invalidCredentials);
  });

  it("redirects to /dashboard on success", async () => {
    signInResult = { data: { session: { access_token: "t" }, user: { id: "u1" } }, error: null };
    const { signIn } = await import("./actions");

    await expect(
      signIn({ error: null }, form("a@example.com", "password123")),
    ).rejects.toThrow("REDIRECT:/dashboard");
  });
});
