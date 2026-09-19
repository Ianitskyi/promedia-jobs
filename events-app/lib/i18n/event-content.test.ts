import { describe, it, expect } from "vitest";
import { eventName, eventDescription, eventVenueName } from "./event-content";

describe("eventName", () => {
  it("resolves a Ukrainian-only event ('UK event') for a uk viewer", () => {
    const event = { name_uk: "Літній табір", name_en: null };
    expect(eventName(event, "uk")).toBe("Літній табір");
  });

  it("falls back to the Ukrainian name for a uk-only event even when viewed in English", () => {
    // The event's own language and the viewer's platform locale are
    // independent (§4) — an organizer browsing in English must still
    // see *something* readable for a Ukrainian-only event.
    const event = { name_uk: "Літній табір", name_en: null };
    expect(eventName(event, "en")).toBe("Літній табір");
  });

  it("resolves an English-only event ('EN event') for an en viewer", () => {
    const event = { name_uk: null, name_en: "Summer Camp" };
    expect(eventName(event, "en")).toBe("Summer Camp");
  });

  it("falls back to the English name for an en-only event even when viewed in Ukrainian", () => {
    const event = { name_uk: null, name_en: "Summer Camp" };
    expect(eventName(event, "uk")).toBe("Summer Camp");
  });

  it("resolves a bilingual event to the matching language, not a fallback", () => {
    const event = { name_uk: "Літній табір", name_en: "Summer Camp" };
    expect(eventName(event, "uk")).toBe("Літній табір");
    expect(eventName(event, "en")).toBe("Summer Camp");
  });

  it("returns an empty string, never null/undefined, when nothing is set", () => {
    expect(eventName({ name_uk: null, name_en: null }, "uk")).toBe("");
  });
});

describe("eventDescription / eventVenueName", () => {
  it("apply the same fallback rule as eventName", () => {
    const event = {
      description_uk: "Опис",
      description_en: null,
      venue_name_uk: null,
      venue_name_en: "Main Hall",
    };
    expect(eventDescription(event, "en")).toBe("Опис");
    expect(eventVenueName(event, "uk")).toBe("Main Hall");
  });

  it("returns null (not empty string) when nothing is set — these fields are optional", () => {
    const event = {
      description_uk: null,
      description_en: null,
      venue_name_uk: null,
      venue_name_en: null,
    };
    expect(eventDescription(event, "uk")).toBeNull();
    expect(eventVenueName(event, "en")).toBeNull();
  });
});
