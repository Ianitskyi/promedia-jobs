import { describe, it, expect } from "vitest";
import { CONSENT_VERSION, getConsentText } from "./consent";
import { en, uk } from "@/lib/i18n/dictionaries";

describe("CONSENT_VERSION", () => {
  it("is a non-empty version identifier", () => {
    expect(CONSENT_VERSION.length).toBeGreaterThan(0);
  });
});

describe("getConsentText", () => {
  it("returns the English consent text for the English locale", () => {
    expect(getConsentText("en")).toBe(en.registration.consentText);
  });

  it("returns the Ukrainian consent text for the Ukrainian locale", () => {
    expect(getConsentText("uk")).toBe(uk.registration.consentText);
  });

  it("returns different text per locale — a consent record must reflect what was actually shown", () => {
    expect(getConsentText("uk")).not.toBe(getConsentText("en"));
  });
});
