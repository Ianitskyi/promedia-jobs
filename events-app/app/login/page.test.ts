import { describe, it, expect, vi } from "vitest";
import { LoginForm } from "@/components/LoginForm";
import { collectText } from "@/lib/testing/react-tree";

vi.mock("@/lib/i18n/server", () => ({
  getPlatformLocale: async () => "en",
}));

interface ElementLike {
  type?: unknown;
  props?: Record<string, unknown>;
}

function findByType(node: unknown, type: unknown): ElementLike | undefined {
  if (node == null || typeof node === "boolean") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node === "object" && node !== null && "props" in node) {
    const el = node as ElementLike;
    if (el.type === type) return el;
    return findByType(el.props?.children, type);
  }
  return undefined;
}

describe("LoginPage", () => {
  it("opens in sign-in state by default (no ?mode= param)", async () => {
    const { default: LoginPage } = await import("./page");
    const element = await LoginPage({ searchParams: Promise.resolve({}) });

    const form = findByType(element, LoginForm);
    expect(form?.props?.initialMode).toBe("signin");
  });

  it("opens directly in the signup state for ?mode=signup — the landing page's Create account CTA", async () => {
    const { default: LoginPage } = await import("./page");
    const element = await LoginPage({ searchParams: Promise.resolve({ mode: "signup" }) });

    const form = findByType(element, LoginForm);
    expect(form?.props?.initialMode).toBe("signup");
  });

  it("ignores unrecognized ?mode= values and falls back to sign-in", async () => {
    const { default: LoginPage } = await import("./page");
    const element = await LoginPage({ searchParams: Promise.resolve({ mode: "bogus" }) });

    const form = findByType(element, LoginForm);
    expect(form?.props?.initialMode).toBe("signin");
  });

  it("is still the ProMedia Events sign-in page (no intermediate organizer screen)", async () => {
    const { default: LoginPage } = await import("./page");
    const element = await LoginPage({ searchParams: Promise.resolve({}) });
    const text = collectText(element).join(" | ");

    expect(text).toContain("ProMedia Events");
  });
});
