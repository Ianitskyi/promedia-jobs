import { describe, it, expect, vi, beforeEach } from "vitest";

let cookieStore: Map<string, string>;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

beforeEach(() => {
  cookieStore = new Map();
});

describe("getPlatformLocale", () => {
  it("defaults to Ukrainian when no cookie is set", async () => {
    const { getPlatformLocale } = await import("./server");
    expect(await getPlatformLocale()).toBe("uk");
  });

  it("reads an explicitly set platform locale cookie (English platform selection)", async () => {
    cookieStore.set("pm_locale", "en");
    const { getPlatformLocale } = await import("./server");
    expect(await getPlatformLocale()).toBe("en");
  });

  it("ignores a garbage cookie value and falls back to the default", async () => {
    cookieStore.set("pm_locale", "fr");
    const { getPlatformLocale } = await import("./server");
    expect(await getPlatformLocale()).toBe("uk");
  });
});

describe("resolvePublicLocale", () => {
  it("a UK event always renders in Ukrainian, regardless of any cookie", async () => {
    cookieStore.set("pm_public_locale", "en");
    const { resolvePublicLocale } = await import("./server");
    expect(await resolvePublicLocale("uk")).toBe("uk");
  });

  it("an EN event always renders in English, regardless of any cookie", async () => {
    cookieStore.set("pm_public_locale", "uk");
    const { resolvePublicLocale } = await import("./server");
    expect(await resolvePublicLocale("en")).toBe("en");
  });

  it("a bilingual event uses the attendee's remembered choice", async () => {
    cookieStore.set("pm_public_locale", "en");
    const { resolvePublicLocale } = await import("./server");
    expect(await resolvePublicLocale("bilingual")).toBe("en");
  });

  it("a bilingual event with no remembered choice defaults to Ukrainian", async () => {
    const { resolvePublicLocale } = await import("./server");
    expect(await resolvePublicLocale("bilingual")).toBe("uk");
  });
});

describe("resolveTicketLocale", () => {
  it("a UK event's ticket always renders in Ukrainian", async () => {
    const { resolveTicketLocale } = await import("./server");
    expect(await resolveTicketLocale("uk", "en")).toBe("uk");
  });

  it("a bilingual event's ticket defaults to the attendee's own registered language, not the platform default", async () => {
    const { resolveTicketLocale } = await import("./server");
    expect(await resolveTicketLocale("bilingual", "en")).toBe("en");
  });

  it("a bilingual event's ticket honors an explicit switcher choice over the attendee's registered language", async () => {
    cookieStore.set("pm_public_locale", "uk");
    const { resolveTicketLocale } = await import("./server");
    expect(await resolveTicketLocale("bilingual", "en")).toBe("uk");
  });
});

describe("getKioskLocale", () => {
  it("falls back to the platform locale when the kiosk hasn't been set yet", async () => {
    cookieStore.set("pm_locale", "en");
    const { getKioskLocale } = await import("./server");
    expect(await getKioskLocale()).toBe("en");
  });

  it("uses its own cookie once set, independent of the platform locale", async () => {
    cookieStore.set("pm_locale", "uk");
    cookieStore.set("pm_kiosk_locale", "en");
    const { getKioskLocale } = await import("./server");
    expect(await getKioskLocale()).toBe("en");
  });
});
