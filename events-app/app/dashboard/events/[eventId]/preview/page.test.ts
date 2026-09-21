import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventPublicContent } from "@/components/EventPublicContent";
import { RegistrationForm } from "@/components/RegistrationForm";
import { usesComponent, findAll } from "@/lib/testing/react-tree";

interface MockMembershipRow {
  workspace_id: string;
  user_id: string;
  role: string;
}

let mockUser: { id: string } | null;
let mockMemberships: MockMembershipRow[];
let mockEvent: Record<string, unknown> | null;
let mockWorkspace: Record<string, unknown> | null;

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/i18n/server", () => ({
  resolvePublicLocale: async () => "en",
}));

// The real getMembership/requirePermission run unmocked against this
// stubbed Supabase client — matching lib/authz.test.ts's own pattern —
// so this test exercises the actual authorization code path, not a
// mocked stand-in for it.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
    from(table: string) {
      const filters: Record<string, string> = {};
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: string) {
          filters[column] = value;
          return builder;
        },
        async single() {
          if (table === "events") {
            return mockEvent && mockEvent.id === filters.id
              ? { data: mockEvent, error: null }
              : { data: null, error: { message: "not found" } };
          }
          if (table === "workspaces") {
            return mockWorkspace && mockWorkspace.id === filters.id
              ? { data: mockWorkspace, error: null }
              : { data: null, error: { message: "not found" } };
          }
          throw new Error(`unexpected table in .single(): ${table}`);
        },
        async maybeSingle() {
          // Backs lib/authz.ts's getMembership() query against workspace_members.
          const rows = mockMemberships.filter((row) =>
            Object.entries(filters).every(([k, v]) => (row as never)[k] === v),
          );
          return { data: rows[0] ?? null, error: null };
        },
      };
      return builder;
    },
  }),
}));

// Imported statically (once vi.mock's hoisted mocks are in place) so
// this file's EventPublicContent/RegistrationForm references are the
// exact same module instances the page under test imports — required
// for usesComponent/findAll's `===` identity checks. A dynamic
// `import("./page")` after `vi.resetModules()` would instead load a
// fresh, separately-instantiated copy of those components, which
// would never compare equal here.
const { default: EventPreviewPage } = await import("./page");

const WORKSPACE_A = { id: "workspace-a", name: "Workspace A", logo_url: null, primary_color: null };
const EVENT_DRAFT_A = {
  id: "event-1",
  workspace_id: "workspace-a",
  slug: "draft-event",
  status: "DRAFT",
  event_language: "uk",
  name_uk: "Чернетка",
  name_en: null,
  description_uk: null,
  description_en: null,
  start_date: "2026-06-01",
  start_time: "10:00",
  timezone: "Europe/Kyiv",
  venue_name_uk: null,
  venue_name_en: null,
  address: null,
  logo_url: null,
};

beforeEach(() => {
  mockUser = { id: "user-a" };
  mockMemberships = [{ workspace_id: "workspace-a", user_id: "user-a", role: "OWNER" }];
  mockEvent = EVENT_DRAFT_A;
  mockWorkspace = WORKSPACE_A;
});

describe("EventPreviewPage — authorization", () => {
  it("renders for a workspace member with manageEvents access, even though the event is DRAFT", async () => {
    const element = await EventPreviewPage({ params: Promise.resolve({ eventId: "event-1" }) });
    expect(element).toBeTruthy();
  });

  it("SECURITY: denies a signed-in user who is not a member of the event's workspace", async () => {
    mockMemberships = [{ workspace_id: "workspace-b", user_id: "user-a", role: "OWNER" }];
    await expect(
      EventPreviewPage({ params: Promise.resolve({ eventId: "event-1" }) }),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("SECURITY: denies a workspace member whose role lacks manageEvents (e.g. CHECKIN_STAFF)", async () => {
    mockMemberships = [{ workspace_id: "workspace-a", user_id: "user-a", role: "CHECKIN_STAFF" }];
    await expect(
      EventPreviewPage({ params: Promise.resolve({ eventId: "event-1" }) }),
    ).rejects.toThrow("REDIRECT:/dashboard?error=forbidden");
  });

  it("404s for a nonexistent event id rather than leaking whether it exists in another workspace", async () => {
    mockEvent = null;
    await expect(
      EventPreviewPage({ params: Promise.resolve({ eventId: "does-not-exist" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("EventPreviewPage — presentation reuse and non-submitting registration", () => {
  it("renders the event using the shared EventPublicContent presentation, same as the public page", async () => {
    const element = await EventPreviewPage({ params: Promise.resolve({ eventId: "event-1" }) });
    expect(usesComponent(element, EventPublicContent)).toBe(true);
  });

  it("SECURITY: wires RegistrationForm in preview mode, with no real register() action bound", async () => {
    const element = await EventPreviewPage({ params: Promise.resolve({ eventId: "event-1" }) });

    const forms = findAll(element, (el) => el.type === RegistrationForm);
    expect(forms).toHaveLength(1);
    expect(forms[0]?.props?.preview).toBe(true);
    expect(forms[0]?.props?.action).toBeUndefined();
  });

  it("never mutates the event's status while building the preview", async () => {
    await EventPreviewPage({ params: Promise.resolve({ eventId: "event-1" }) });
    // The mock Supabase client above exposes no .update()/.insert() at
    // all on the "events" table builder — calling either would throw
    // (TypeError: ... is not a function), so simply completing without
    // throwing demonstrates the page performs reads only.
    expect(mockEvent?.status).toBe("DRAFT");
  });
});
