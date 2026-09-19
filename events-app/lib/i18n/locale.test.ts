import { describe, it, expect } from "vitest";
import { DEFAULT_LOCALE, FALLBACK_LOCALE, isLocale, LOCALES, EVENT_LANGUAGES } from "./locale";

describe("locale constants", () => {
  it("defaults the platform to Ukrainian", () => {
    expect(DEFAULT_LOCALE).toBe("uk");
  });

  it("falls back to English", () => {
    expect(FALLBACK_LOCALE).toBe("en");
  });

  it("supports exactly uk and en for the MVP — no more, no fewer", () => {
    expect(LOCALES).toEqual(["uk", "en"]);
  });

  it("supports exactly uk/en/bilingual for event language", () => {
    expect(EVENT_LANGUAGES).toEqual(["uk", "en", "bilingual"]);
  });
});

describe("isLocale", () => {
  it("accepts uk and en", () => {
    expect(isLocale("uk")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  it("rejects anything else, including a third language", () => {
    expect(isLocale("bilingual")).toBe(false);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});
