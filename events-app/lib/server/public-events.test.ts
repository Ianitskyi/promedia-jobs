import { describe, it, expect, vi } from "vitest";

let mockEvent: Record<string, unknown> | null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async single() {
          if (table === "events") {
            return mockEvent ? { data: mockEvent, error: null } : { data: null, error: { message: "not found" } };
          }
          throw new Error(`unexpected table in .single(): ${table}`);
        },
      };
      return builder;
    },
  }),
}));

describe("getPublicEventBySlug — DRAFT events stay unpublished to unauthenticated visitors", () => {
  it("returns null for a DRAFT event, identically to a nonexistent slug", async () => {
    mockEvent = {
      id: "event-1",
      slug: "secret-draft",
      status: "DRAFT",
      workspaces: { name: "ProMedia", logo_url: null, primary_color: null },
    };
    const { getPublicEventBySlug } = await import("./public-events");
    expect(await getPublicEventBySlug("secret-draft")).toBeNull();
  });

  it("returns null for a slug that doesn't exist at all", async () => {
    mockEvent = null;
    const { getPublicEventBySlug } = await import("./public-events");
    expect(await getPublicEventBySlug("does-not-exist")).toBeNull();
  });

  it("returns event data for a PUBLISHED event", async () => {
    mockEvent = {
      id: "event-2",
      slug: "public-event",
      status: "PUBLISHED",
      capacity: null,
      registration_deadline: null,
      workspaces: { name: "ProMedia", logo_url: null, primary_color: null },
    };
    const { getPublicEventBySlug } = await import("./public-events");
    const result = await getPublicEventBySlug("public-event");
    expect(result).not.toBeNull();
    expect(result?.state).toBe("open");
  });
});
