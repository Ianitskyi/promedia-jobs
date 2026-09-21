import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectHrefs, collectText } from "@/lib/testing/react-tree";

let mockEvent: Record<string, unknown> | null;

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("@/lib/authz", () => ({
  getMembership: async () => ({ userId: "user-a", workspaceId: "workspace-a", role: "OWNER" }),
  can: () => true,
}));

vi.mock("@/lib/server/attendees", () => ({
  listEventAttendees: async () => [],
}));

vi.mock("@/lib/i18n/server", () => ({
  getPlatformLocale: async () => "en",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
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

const BASE_EVENT = {
  id: "event-1",
  workspace_id: "workspace-a",
  slug: "my-event",
  status: "DRAFT",
  event_language: "en",
  name_uk: null,
  name_en: "My Event",
  start_date: "2026-06-01",
  venue_name_uk: null,
  venue_name_en: null,
};

beforeEach(() => {
  mockEvent = { ...BASE_EVENT };
  vi.resetModules();
});

describe("EventDetailPage — draft vs published link behavior", () => {
  it("shows a Preview action linking to the dashboard preview route for a DRAFT event, not the public link", async () => {
    mockEvent = { ...BASE_EVENT, status: "DRAFT" };
    const { default: EventDetailPage } = await import("./page");
    const element = await EventDetailPage({ params: Promise.resolve({ eventId: "event-1" }) });

    const hrefs = collectHrefs(element);
    expect(hrefs).toContain("/dashboard/events/event-1/preview");
    expect(hrefs).not.toContain("/e/my-event");
    expect(collectText(element)).toContain("Preview");
  });

  it("shows an Open event page action linking to the public page for a PUBLISHED event", async () => {
    mockEvent = { ...BASE_EVENT, status: "PUBLISHED" };
    const { default: EventDetailPage } = await import("./page");
    const element = await EventDetailPage({ params: Promise.resolve({ eventId: "event-1" }) });

    const hrefs = collectHrefs(element);
    expect(hrefs).toContain("/e/my-event");
    expect(hrefs).not.toContain("/dashboard/events/event-1/preview");
    expect(collectText(element)).toContain("Open event page");
  });

  it("shows an Open event page action linking to the public page for a CLOSED event (unchanged existing behavior)", async () => {
    mockEvent = { ...BASE_EVENT, status: "CLOSED" };
    const { default: EventDetailPage } = await import("./page");
    const element = await EventDetailPage({ params: Promise.resolve({ eventId: "event-1" }) });

    const hrefs = collectHrefs(element);
    expect(hrefs).toContain("/e/my-event");
    expect(hrefs).not.toContain("/dashboard/events/event-1/preview");
  });

  it("404s when the event doesn't exist", async () => {
    mockEvent = null;
    const { default: EventDetailPage } = await import("./page");
    await expect(
      EventDetailPage({ params: Promise.resolve({ eventId: "does-not-exist" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
