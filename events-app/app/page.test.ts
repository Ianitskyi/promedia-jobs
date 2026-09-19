import { describe, it, expect, vi } from "vitest";
import en from "@/lib/i18n/dictionaries/en";
import uk from "@/lib/i18n/dictionaries/uk";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { collectText, collectHrefs, usesComponent } from "@/lib/testing/react-tree";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

let platformLocale: "en" | "uk" = "en";
vi.mock("@/lib/i18n/server", () => ({
  getPlatformLocale: async () => platformLocale,
}));

describe("HomePage (/)", () => {
  it("no longer redirects to /login", async () => {
    platformLocale = "en";
    const { default: HomePage } = await import("./page");

    // Would throw REDIRECT:/login if the old behavior were still in place.
    await expect(HomePage()).resolves.toBeTruthy();
  });

  it("renders the ProMedia Events landing content (English)", async () => {
    platformLocale = "en";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();
    const text = collectText(element).join(" | ");

    expect(text).toContain(en.landing.title);
    expect(text).toContain(en.landing.description);
    expect(text).toContain(en.landing.supportingText);
    expect(text).toContain(en.landing.primaryCta);
    expect(text).toContain(en.landing.secondaryCta);
    expect(text).toContain(en.landing.capabilityRegistration);
    expect(text).toContain(en.landing.capabilityQrTickets);
    expect(text).toContain(en.landing.capabilityCheckIn);
    expect(text).toContain(en.landing.capabilityExport);
  });

  it("renders the ProMedia Events landing content (Ukrainian)", async () => {
    platformLocale = "uk";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();
    const text = collectText(element).join(" | ");

    expect(text).toContain(uk.landing.title);
    expect(text).toContain(uk.landing.description);
    expect(text).toContain(uk.landing.supportingText);
    expect(text).toContain(uk.landing.primaryCta);
    expect(text).toContain(uk.landing.secondaryCta);
    expect(text).toContain(uk.landing.capabilityRegistration);
    expect(text).toContain(uk.landing.capabilityQrTickets);
    expect(text).toContain(uk.landing.capabilityCheckIn);
    expect(text).toContain(uk.landing.capabilityExport);

    // The one phrase explicitly ruled out for this landing page.
    expect(text).not.toContain("Події без зайвої організаційної роботи");
  });

  it("points the sign-in CTA at the existing /login flow", async () => {
    platformLocale = "en";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();

    expect(collectHrefs(element)).toContain("/login");
  });

  it("points the create-account CTA at the existing signup state of /login", async () => {
    platformLocale = "en";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();

    expect(collectHrefs(element)).toContain("/login?mode=signup");
  });

  it("keeps the language switcher on the landing page", async () => {
    platformLocale = "en";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();

    expect(usesComponent(element, LanguageSwitcher)).toBe(true);
  });
});
