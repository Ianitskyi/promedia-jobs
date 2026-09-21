import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectText, usesComponent, findAll } from "@/lib/testing/react-tree";
import { getDictionary } from "@/lib/i18n/dictionaries";
import DashboardLayout, { ProMediaBrand } from "./layout";

let mockMembership: { userId: string; workspaceId: string; role: string } | null;
let mockWorkspace: Record<string, unknown> | null;

vi.mock("@/lib/authz", () => ({
  getFirstMembership: async () => mockMembership,
}));

vi.mock("@/lib/i18n/server", () => ({
  getPlatformLocale: async () => "en",
}));

vi.mock("@/app/login/actions", () => ({
  signOut: async () => {},
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
          if (table === "workspaces") {
            return mockWorkspace ? { data: mockWorkspace, error: null } : { data: null, error: { message: "not found" } };
          }
          throw new Error(`unexpected table in .single(): ${table}`);
        },
      };
      return builder;
    },
  }),
}));

beforeEach(() => {
  mockMembership = { userId: "user-a", workspaceId: "workspace-a", role: "OWNER" };
  mockWorkspace = { id: "workspace-a", name: "ProMedia", slug: "promedia", logo_url: null, primary_color: null };
});

describe("ProMediaBrand — the product identity block, tested directly since it's an opaque nested component to the tree walker", () => {
  it("shows 'ProMedia Events' as visible text, not only as an image's alt text", () => {
    const dict = getDictionary("en");
    const element = ProMediaBrand({ dict });

    expect(collectText(element)).toContain("ProMedia Events");
    const images = findAll(element, (el) => el.type === "img");
    // The name is real text elsewhere in this same element, so the
    // wordmark image itself is decorative and can be alt="".
    expect(images[0]?.props?.alt).toBe("");
  });
});

describe("DashboardLayout — ProMedia Events product identity vs workspace identity", () => {
  it("wires the ProMediaBrand product identity into the header, alongside the workspace name shown separately", async () => {
    const element = await DashboardLayout({ children: "CHILD_MARKER" });

    expect(usesComponent(element, ProMediaBrand)).toBe(true);
    const text = collectText(element).join(" | ");
    expect(text).toContain("Workspace");
    expect(text).toContain("ProMedia");
  });

  it("renders the child content", async () => {
    const element = await DashboardLayout({ children: "CHILD_MARKER" });
    expect(collectText(element)).toContain("CHILD_MARKER");
  });

  it("still wires the ProMediaBrand product identity when the user has no workspace membership yet", async () => {
    mockMembership = null;
    const element = await DashboardLayout({ children: "CHILD_MARKER" });
    expect(usesComponent(element, ProMediaBrand)).toBe(true);
  });

  it("still wires the ProMediaBrand product identity when the membership's workspace can't be found", async () => {
    mockWorkspace = null;
    const element = await DashboardLayout({ children: "CHILD_MARKER" });
    expect(usesComponent(element, ProMediaBrand)).toBe(true);
  });
});
