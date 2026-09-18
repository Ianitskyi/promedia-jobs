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
    expect(result).toEqual({ ok: true, publicToken: "A".repeat(43), alreadyRegistered: false });
  });

  it("returns the existing ticket, not an error, for a duplicate registration", async () => {
    mockRpc.mockResolvedValue({
      data: {
        attendee_id: "attendee-1",
        ticket_id: null,
        public_token: "B".repeat(43),
        already_registered: true,
      },
      error: null,
    });
    const { registerAttendee } = await import("./registration");
    const result = await registerAttendee(INPUT);
    expect(result).toEqual({ ok: true, publicToken: "B".repeat(43), alreadyRegistered: true });
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
      "register_attendee",
      expect.objectContaining({
        p_event_id: "event-1",
        p_email: "andrii@example.com",
        p_company: null,
        p_position: null,
        p_consent_version: expect.any(String),
        p_consent_text: expect.any(String),
      }),
    );
  });
});
