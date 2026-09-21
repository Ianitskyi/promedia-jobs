import { describe, it, expect } from "vitest";
import { EventPublicContent, type EventPublicContentEvent } from "./EventPublicContent";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { collectText, usesComponent, findAll } from "@/lib/testing/react-tree";

const BASE_EVENT: EventPublicContentEvent = {
  event_language: "uk",
  name_uk: "Тестова подія",
  name_en: "Test Event",
  description_uk: "Опис українською",
  description_en: "English description",
  start_date: "2026-06-01",
  start_time: "10:00",
  timezone: "Europe/Kyiv",
  venue_name_uk: "Місце",
  venue_name_en: "Venue",
  address: "123 Main St",
  logo_url: null,
};

const noopLocaleChange = async () => {};

describe("EventPublicContent", () => {
  it("renders the event's title, description, venue, and address for the given locale", () => {
    const element = EventPublicContent({
      event: BASE_EVENT,
      organizationName: "ProMedia",
      organizationLogoUrl: null,
      locale: "uk",
      showLanguageSwitcher: false,
      onLocaleChange: noopLocaleChange,
      children: null,
    });
    const text = collectText(element).join(" | ");

    expect(text).toContain("Тестова подія");
    expect(text).toContain("Опис українською");
    expect(text).toContain("Місце");
    expect(text).toContain("123 Main St");
    expect(text).toContain("ProMedia");
  });

  it("renders the English fields when locale is en", () => {
    const element = EventPublicContent({
      event: BASE_EVENT,
      organizationName: "ProMedia",
      organizationLogoUrl: null,
      locale: "en",
      showLanguageSwitcher: false,
      onLocaleChange: noopLocaleChange,
      children: null,
    });
    const text = collectText(element).join(" | ");

    expect(text).toContain("Test Event");
    expect(text).toContain("English description");
  });

  it("renders the passed-in children (the registration form / status notice slot)", () => {
    const element = EventPublicContent({
      event: BASE_EVENT,
      organizationName: "ProMedia",
      organizationLogoUrl: null,
      locale: "uk",
      showLanguageSwitcher: false,
      onLocaleChange: noopLocaleChange,
      children: "REGISTRATION_SLOT_MARKER",
    });
    expect(collectText(element)).toContain("REGISTRATION_SLOT_MARKER");
  });

  it("shows the language switcher only when showLanguageSwitcher is true", () => {
    const withSwitcher = EventPublicContent({
      event: BASE_EVENT,
      organizationName: "ProMedia",
      organizationLogoUrl: null,
      locale: "uk",
      showLanguageSwitcher: true,
      onLocaleChange: noopLocaleChange,
      children: null,
    });
    expect(usesComponent(withSwitcher, LanguageSwitcher)).toBe(true);

    const withoutSwitcher = EventPublicContent({
      event: BASE_EVENT,
      organizationName: "ProMedia",
      organizationLogoUrl: null,
      locale: "uk",
      showLanguageSwitcher: false,
      onLocaleChange: noopLocaleChange,
      children: null,
    });
    expect(usesComponent(withoutSwitcher, LanguageSwitcher)).toBe(false);
  });

  it("prefers the event's own logo over the organization's, falling back when unset", () => {
    // Logo is itself a nested custom component, opaque to the tree
    // walker (it's never invoked) — so this asserts on the `logoUrl`
    // prop passed into the un-rendered <Logo> element, not on an <img>.
    const withEventLogo = EventPublicContent({
      event: { ...BASE_EVENT, logo_url: "https://example.com/event-logo.png" },
      organizationName: "ProMedia",
      organizationLogoUrl: "https://example.com/org-logo.png",
      locale: "uk",
      showLanguageSwitcher: false,
      onLocaleChange: noopLocaleChange,
      children: null,
    });
    const logos = findAll(withEventLogo, (el) => el.type === Logo);
    expect(logos[0]?.props?.logoUrl).toBe("https://example.com/event-logo.png");

    const withoutEventLogo = EventPublicContent({
      event: BASE_EVENT,
      organizationName: "ProMedia",
      organizationLogoUrl: "https://example.com/org-logo.png",
      locale: "uk",
      showLanguageSwitcher: false,
      onLocaleChange: noopLocaleChange,
      children: null,
    });
    const fallbackLogos = findAll(withoutEventLogo, (el) => el.type === Logo);
    expect(fallbackLogos[0]?.props?.logoUrl).toBe("https://example.com/org-logo.png");
  });
});
