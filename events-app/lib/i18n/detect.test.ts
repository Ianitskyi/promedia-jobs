import { describe, it, expect } from "vitest";
import { detectLocaleFromAcceptLanguage } from "./detect";

describe("detectLocaleFromAcceptLanguage", () => {
  it("picks English for an English-preferring browser (English platform selection)", () => {
    expect(detectLocaleFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(detectLocaleFromAcceptLanguage("en")).toBe("en");
  });

  it("defaults to Ukrainian for a Ukrainian-preferring browser", () => {
    expect(detectLocaleFromAcceptLanguage("uk-UA,uk;q=0.9,en;q=0.8")).toBe("uk");
  });

  it("defaults to Ukrainian for any language other than English (only two locales are supported)", () => {
    expect(detectLocaleFromAcceptLanguage("fr-FR,fr;q=0.9")).toBe("uk");
    expect(detectLocaleFromAcceptLanguage("de-DE")).toBe("uk");
  });

  it("defaults to Ukrainian when there is no header at all", () => {
    expect(detectLocaleFromAcceptLanguage(null)).toBe("uk");
  });

  it("never infers from anything other than the header itself (no nationality/geo signal)", () => {
    // Documents the contract: the function's only input is the header string.
    expect(detectLocaleFromAcceptLanguage.length).toBe(1);
  });
});
