import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Attendee, Ticket } from "@/lib/database.types";

// checkin.ts talks to Postgres only through createAdminClient(); mocking
// that one seam lets these tests exercise the real state-machine logic
// in lib/server/checkin.ts (tenant/revocation checks, interpreting the
// perform_checkin RPC's was_created flag) without a live database.
let mockTickets: Record<string, Partial<Ticket>>;
let mockAttendees: Record<string, Partial<Attendee>>;
let mockRpc: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      let filterValue: string | undefined;
      const source = table === "tickets" ? mockTickets : mockAttendees;
      return {
        select() {
          return this;
        },
        eq(_column: string, value: string) {
          filterValue = value;
          return this;
        },
        async maybeSingle() {
          return { data: (filterValue && source[filterValue]) ?? null, error: null };
        },
        async single() {
          const row = filterValue ? source[filterValue] : null;
          return { data: row ?? null, error: row ? null : { message: "not found" } };
        },
      };
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

const VALID_TOKEN = "A".repeat(43);

const BASE_TICKET: Ticket = {
  id: "ticket-1",
  event_id: "event-1",
  attendee_id: "attendee-1",
  public_token: VALID_TOKEN,
  created_at: "2026-01-01T00:00:00.000Z",
  revoked_at: null,
};

const BASE_ATTENDEE: Partial<Attendee> = {
  first_name: "Andrii",
  last_name: "Ianitskyi",
  company: "ProMedia",
};

beforeEach(() => {
  mockTickets = { [VALID_TOKEN]: BASE_TICKET, "ticket-1": BASE_TICKET };
  mockAttendees = { "attendee-1": BASE_ATTENDEE };
  mockRpc = vi.fn();
});

describe("checkInByToken", () => {
  it("rejects a malformed token without querying the database", async () => {
    const { checkInByToken } = await import("./checkin");
    const result = await checkInByToken("not-a-real-token", "event-1", {
      userId: "user-1",
      method: "QR",
    });
    expect(result).toEqual({ state: "INVALID_TICKET" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("reports INVALID_TICKET for a token that doesn't exist", async () => {
    const { checkInByToken } = await import("./checkin");
    const result = await checkInByToken("B".repeat(43), "event-1", {
      userId: "user-1",
      method: "QR",
    });
    expect(result).toEqual({ state: "INVALID_TICKET" });
  });

  it("reports WRONG_EVENT when the ticket belongs to a different event", async () => {
    // This is the app-level UX check: it runs before perform_checkin is
    // ever called, so the scanner shows "WRONG EVENT" instead of a
    // generic failure. It is not the actual safety guarantee — that's
    // the enforce_checkin_event_matches_ticket trigger and
    // perform_checkin's own p_event_id-vs-ticket check at the database
    // level (see ARCHITECTURE.md §6a and the integration-test checklist
    // in supabase/INTEGRATION_TESTS.md), which hold even if this
    // TypeScript check were ever removed or buggy.
    const { checkInByToken } = await import("./checkin");
    const result = await checkInByToken(VALID_TOKEN, "some-other-event", {
      userId: "user-1",
      method: "QR",
    });
    expect(result).toEqual({ state: "WRONG_EVENT" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("reports TICKET_REVOKED for a revoked ticket, even for the right event", async () => {
    mockTickets[VALID_TOKEN] = { ...BASE_TICKET, revoked_at: "2026-02-01T00:00:00.000Z" };
    const { checkInByToken } = await import("./checkin");
    const result = await checkInByToken(VALID_TOKEN, "event-1", {
      userId: "user-1",
      method: "QR",
    });
    expect(result).toEqual({ state: "TICKET_REVOKED" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("reports CHECKED_IN on first successful check-in", async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: "checkin-1", checked_in_at: "2026-03-01T18:43:00.000Z", was_created: true }],
      error: null,
    });
    const { checkInByToken } = await import("./checkin");
    const result = await checkInByToken(VALID_TOKEN, "event-1", {
      userId: "user-1",
      method: "QR",
    });
    expect(result.state).toBe("CHECKED_IN");
    expect(result.attendee).toEqual({
      firstName: "Andrii",
      lastName: "Ianitskyi",
      company: "ProMedia",
    });
    expect(result.checkedInAt).toBe("2026-03-01T18:43:00.000Z");
  });

  it("reports ALREADY_CHECKED_IN — not a second CHECKED_IN — when perform_checkin loses the race", async () => {
    // Simulates two phones scanning the same ticket at once: the
    // unique constraint on checkins.ticket_id means only one INSERT
    // wins. was_created: false is exactly what the losing call sees.
    mockRpc.mockResolvedValue({
      data: [{ id: "checkin-1", checked_in_at: "2026-03-01T18:37:00.000Z", was_created: false }],
      error: null,
    });
    const { checkInByToken } = await import("./checkin");
    const result = await checkInByToken(VALID_TOKEN, "event-1", {
      userId: "user-2",
      method: "QR",
    });
    expect(result.state).toBe("ALREADY_CHECKED_IN");
    expect(result.checkedInAt).toBe("2026-03-01T18:37:00.000Z");
  });

  it("passes the QR method and acting user through to perform_checkin", async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: "checkin-1", checked_in_at: "2026-03-01T18:43:00.000Z", was_created: true }],
      error: null,
    });
    const { checkInByToken } = await import("./checkin");
    await checkInByToken(VALID_TOKEN, "event-1", { userId: "staff-42", method: "QR" });
    expect(mockRpc).toHaveBeenCalledWith("perform_checkin", {
      p_ticket_id: "ticket-1",
      p_event_id: "event-1",
      p_method: "QR",
      p_checked_in_by: "staff-42",
    });
  });
});

describe("checkInByTicketId (manual check-in)", () => {
  it("uses the same validation and RPC path as the QR scanner", async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: "checkin-1", checked_in_at: "2026-03-01T18:43:00.000Z", was_created: true }],
      error: null,
    });
    const { checkInByTicketId } = await import("./checkin");
    const result = await checkInByTicketId("ticket-1", "event-1", {
      userId: "staff-1",
      method: "MANUAL",
    });
    expect(result.state).toBe("CHECKED_IN");
    expect(mockRpc).toHaveBeenCalledWith("perform_checkin", expect.objectContaining({
      p_method: "MANUAL",
    }));
  });

  it("reports INVALID_TICKET for an unknown ticket id", async () => {
    const { checkInByTicketId } = await import("./checkin");
    const result = await checkInByTicketId("no-such-ticket", "event-1", {
      userId: "staff-1",
      method: "MANUAL",
    });
    expect(result).toEqual({ state: "INVALID_TICKET" });
  });
});
