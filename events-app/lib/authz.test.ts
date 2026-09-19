import { describe, it, expect, vi, beforeEach } from "vitest";
import { can, type Permission } from "./authz";
import type { WorkspaceRole } from "./database.types";

const ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "CHECKIN_STAFF"];

describe("can", () => {
  it("allows OWNER and ADMIN, but not CHECKIN_STAFF, to manage events", () => {
    expect(can("OWNER", "manageEvents")).toBe(true);
    expect(can("ADMIN", "manageEvents")).toBe(true);
    expect(can("CHECKIN_STAFF", "manageEvents")).toBe(false);
  });

  it("allows OWNER and ADMIN, but not CHECKIN_STAFF, to export attendees", () => {
    expect(can("OWNER", "exportAttendees")).toBe(true);
    expect(can("ADMIN", "exportAttendees")).toBe(true);
    expect(can("CHECKIN_STAFF", "exportAttendees")).toBe(false);
  });

  it("allows all three roles to check in attendees", () => {
    for (const role of ROLES) {
      expect(can(role, "checkIn")).toBe(true);
    }
  });

  it("never allows an unrecognized permission for any role (fail closed)", () => {
    for (const role of ROLES) {
      expect(can(role, "notARealPermission" as Permission)).toBe(false);
    }
  });
});

// getMembership/getFirstMembership/requirePermission — the application-
// layer half of tenant isolation, complementing (not replacing) the
// database's RLS policies, which only a live Postgres instance can
// verify (see supabase/INTEGRATION_TESTS.md §1 and §9). This mocks
// workspace_members as an in-memory table and drives the exact same
// .eq()-chained query shape lib/authz.ts issues, so a regression that
// dropped one of those filters (e.g. matching on user_id alone,
// forgetting workspace_id) would fail these tests even though it can
// never be caught by TypeScript.
interface MockMembershipRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

let mockUser: { id: string } | null;
let mockMemberships: MockMembershipRow[];

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
    from() {
      const filters: Record<string, string> = {};
      let ordered = false;
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: string) {
          filters[column] = value;
          return builder;
        },
        order() {
          ordered = true;
          return builder;
        },
        limit() {
          return builder;
        },
        async maybeSingle() {
          const rows = mockMemberships
            .filter((row) => Object.entries(filters).every(([k, v]) => (row as never)[k] === v))
            .sort((a, b) =>
              ordered ? a.created_at.localeCompare(b.created_at) : 0,
            );
          return { data: rows[0] ?? null, error: null };
        },
      };
      return builder;
    },
  }),
}));

beforeEach(() => {
  mockUser = { id: "user-a" };
  mockMemberships = [
    { workspace_id: "workspace-a", user_id: "user-a", role: "OWNER", created_at: "2026-01-01" },
  ];
  vi.resetModules();
});

describe("getMembership — cross-tenant isolation", () => {
  it("returns the membership for a workspace the user actually belongs to", async () => {
    const { getMembership } = await import("./authz");
    const membership = await getMembership("workspace-a");
    expect(membership).toEqual({ userId: "user-a", workspaceId: "workspace-a", role: "OWNER" });
  });

  it("SECURITY: returns null for a workspace the user does NOT belong to, even though they belong to a different one", async () => {
    const { getMembership } = await import("./authz");
    const membership = await getMembership("workspace-b");
    expect(membership).toBeNull();
  });

  it("returns null when there is no signed-in user", async () => {
    mockUser = null;
    const { getMembership } = await import("./authz");
    expect(await getMembership("workspace-a")).toBeNull();
  });
});

describe("requirePermission — cross-tenant isolation", () => {
  it("resolves with the membership when the user has the required permission in that workspace", async () => {
    const { requirePermission } = await import("./authz");
    const membership = await requirePermission("workspace-a", "manageEvents");
    expect(membership.workspaceId).toBe("workspace-a");
  });

  it("SECURITY: redirects rather than granting access for a workspace the user is not a member of", async () => {
    const { requirePermission } = await import("./authz");
    await expect(requirePermission("workspace-b", "manageEvents")).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects with a forbidden error for a member whose role lacks the permission", async () => {
    mockMemberships = [
      { workspace_id: "workspace-a", user_id: "user-a", role: "CHECKIN_STAFF", created_at: "2026-01-01" },
    ];
    const { requirePermission } = await import("./authz");
    await expect(requirePermission("workspace-a", "manageEvents")).rejects.toThrow(
      "REDIRECT:/dashboard?error=forbidden",
    );
  });
});
