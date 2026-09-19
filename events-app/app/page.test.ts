import { describe, it, expect, vi } from "vitest";
import en from "@/lib/i18n/dictionaries/en";
import uk from "@/lib/i18n/dictionaries/uk";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { collectText, collectHrefs, usesComponent, findAll } from "@/lib/testing/react-tree";

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

  it("renders a visible 'ProMedia Events' heading, independent of the wordmark's alt text", async () => {
    platformLocale = "en";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();

    const headings = findAll(element, (el) => el.type === "h1");
    expect(headings).toHaveLength(1);
    expect(collectText(headings[0])).toContain(en.landing.title);

    // The wordmark image is still present in the header, separately.
    const images = findAll(element, (el) => el.type === "img");
    expect(images).toHaveLength(1);
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
  });

  it("renders the capabilities heading and all 5 list items (English)", async () => {
    platformLocale = "en";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();
    const text = collectText(element).join(" | ");

    expect(text).toContain(en.landing.capabilitiesHeading);
    expect(text).toContain(en.landing.capabilityRegisterParticipants);
    expect(text).toContain(en.landing.capabilityIssueQrTickets);
    expect(text).toContain(en.landing.capabilitySelfCheckIn);
    expect(text).toContain(en.landing.capabilityVerifyAtEntrance);
    expect(text).toContain(en.landing.capabilityDownloadList);
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

    // The one phrase explicitly ruled out for this landing page.
    expect(text).not.toContain("Події без зайвої організаційної роботи");
  });

  it("renders the capabilities heading and all 5 list items (Ukrainian)", async () => {
    platformLocale = "uk";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();
    const text = collectText(element).join(" | ");

    expect(text).toContain(uk.landing.capabilitiesHeading);
    expect(text).toContain(uk.landing.capabilityRegisterParticipants);
    expect(text).toContain(uk.landing.capabilityIssueQrTickets);
    expect(text).toContain(uk.landing.capabilitySelfCheckIn);
    expect(text).toContain(uk.landing.capabilityVerifyAtEntrance);
    expect(text).toContain(uk.landing.capabilityDownloadList);
  });

  it("renders the capabilities as a plain list, not cards or interactive controls", async () => {
    platformLocale = "en";
    const { default: HomePage } = await import("./page");
    const element = await HomePage();

    const lists = findAll(element, (el) => el.type === "ul");
    expect(lists).toHaveLength(1);

    const items = findAll(lists[0], (el) => el.type === "li");
    expect(items).toHaveLength(5);

    // No card/button-like surface anywhere in the capabilities list.
    for (const item of items) {
      expect(String(item.props?.className ?? "")).not.toContain("card");
    }

    // Nothing in the whole page still uses the old card grid, and the
    // capability text isn't wrapped in a button or a link.
    expect(findAll(element, (el) => String(el.props?.className ?? "").includes("card"))).toHaveLength(0);
    expect(findAll(lists[0], (el) => el.type === "button" || el.type === "a")).toHaveLength(0);
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
