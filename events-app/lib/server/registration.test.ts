import { describe, it, expect, vi, beforeEach } from "vitest";

let mockRpc: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }),
}));

const INPUT = {
  eventId: "event-1",
  firstName: "Andrii",
  lastName: "Ianitskyi",
  email: "andrii@example.com",
  language: "uk" as const,
};

beforeEach(() => {
  mockRpc = vi.fn();
});

describe("registerAttendee", () => {
  it("returns the new ticket token on success", async () => {
    mockRpc.mockResolvedValue({
      data: {
        attendee_id: "attendee-1",
        ticket_id: "ticket-1",
        public_token: "A".repeat(43),
        already_registered: false,
      },
      error: null,
    });
    const { registerAttendee } = await import("./registration");
    const result = await registerAttendee(INPUT);
    expect(result).toEqual({ ok: true, publicToken: "A".repeat(43) });
  });

  it("SECURITY: never returns a ticket token for a duplicate registration, even if the RPC sent one", async () => {
    // The register_for_event RPC (as of the fix) always returns a null
    // public_token when already_registered is true — but this test
    // defends the app-layer contract independently of that: even if a
    // future/buggy RPC response carried a token alongside
    // already_registered: true, registerAttendee() must still report
    // ALREADY_REGISTERED and must never surface that token. A duplicate
    // registration must never let someone who merely knows a
    // registered attendee's email obtain their ticket.
    mockRpc.mockResolvedValue({
      data: {
        attendee_id: "attendee-1",
        ticket_id: "leaked-ticket-id",
        public_token: "B".repeat(43),
        already_registered: true,
      },
      error: null,
    });
    const { registerAttendee } = await import("./registration");
    const result = await registerAttendee(INPUT);
    expect(result).toEqual({ ok: false, error: "ALREADY_REGISTERED" });
    expect(JSON.stringify(result)).not.toContain("B".repeat(43));
  });

  it("reports ALREADY_REGISTERED for the normal (token-less) duplicate response", async () => {
    mockRpc.mockResolvedValue({
      data: {
        attendee_id: "attendee-1",
        ticket_id: null,
        public_token: null,
        already_registered: true,
      },
      error: null,
    });
    const { registerAttendee } = await import("./registration");
    const result = await registerAttendee(INPUT);
    expect(result).toEqual({ ok: false, error: "ALREADY_REGISTERED" });
  });

  it("reports UNKNOWN if a fresh registration somehow comes back without a token", async () => {
    mockRpc.mockResolvedValue({
      data: {
        attendee_id: "attendee-1",
        ticket_id: "ticket-1",
        public_token: null,
        already_registered: false,
      },
      error: null,
    });
    const { registerAttendee } = await import("./registration");
    const result = await registerAttendee(INPUT);
    expect(result).toEqual({ ok: false, error: "UNKNOWN" });
  });

  it.each([
    ["EVENT_NOT_FOUND"],
    ["EVENT_NOT_PUBLISHED"],
    ["REGISTRATION_CLOSED"],
    ["CAPACITY_REACHED"],
  ] as const)("maps a %s database error to the matching result", async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: code } });
    const { registerAttendee } = await import("./registration");
    const result = await registerAttendee(INPUT);
    expect(result).toEqual({ ok: false, error: code });
  });

  it("falls back to UNKNOWN for an unrecognized database error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    const { registerAttendee } = await import("./registration");
    const result = await registerAttendee(INPUT);
    expect(result).toEqual({ ok: false, error: "UNKNOWN" });
  });

  it("passes consent version/text and normalizes optional fields to null", async () => {
    mockRpc.mockResolvedValue({
      data: {
        attendee_id: "a",
        ticket_id: "t",
        public_token: "C".repeat(43),
        already_registered: false,
      },
      error: null,
    });
    const { registerAttendee } = await import("./registration");
    await registerAttendee(INPUT);
    expect(mockRpc).toHaveBeenCalledWith(
      "register_for_event",
      expect.objectContaining({
        p_event_id: "event-1",
        p_email: "andrii@example.com",
        p_company: null,
        p_position: null,
        p_language: "uk",
        p_consent_version: expect.any(String),
        p_consent_text: expect.any(String),
      }),
    );
  });

  it("stores the consent text in the attendee's chosen language, not always the same one (consent language/version storage)", async () => {
    // Both languages must reach the RPC call with the matching consent
    // copy — register_for_event persists p_language onto both
    // attendees.preferred_language and registration_consents.language
    // (see supabase/migrations/0001_init.sql), so what this app sends
    // here is what gets recorded as "the language this consent was
    // shown and accepted in".
    mockRpc.mockResolvedValue({
      data: { attendee_id: "a", ticket_id: "t", public_token: "D".repeat(43), already_registered: false },
      error: null,
    });
    const { registerAttendee } = await import("./registration");

    await registerAttendee({ ...INPUT, language: "uk" });
    const ukCall = mockRpc.mock.calls.at(-1)?.[1] as { p_language: string; p_consent_text: string };
    expect(ukCall.p_language).toBe("uk");

    await registerAttendee({ ...INPUT, language: "en" });
    const enCall = mockRpc.mock.calls.at(-1)?.[1] as { p_language: string; p_consent_text: string };
    expect(enCall.p_language).toBe("en");

    // Same consent *version*, different consent *text* per language —
    // the version identifies a revision of the wording as a whole
    // (see lib/consent.ts), the text is what was actually shown.
    expect(ukCall.p_consent_text).not.toBe(enCall.p_consent_text);
  });
});
