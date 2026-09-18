import { describe, it, expect } from "vitest";
import { createEventFormSchema } from "./event";
import { en } from "@/lib/i18n/dictionaries";

const schema = createEventFormSchema(en);

const BASE = {
  start_date: "2026-06-15",
  start_time: "09:00",
  end_date: "2026-06-15",
  end_time: "17:00",
  timezone: "Europe/Kyiv",
  status: "DRAFT" as const,
};

describe("createEventFormSchema — bilingual content validation", () => {
  it("accepts a uk event with only name_uk set", () => {
    const result = schema.safeParse({ ...BASE, event_language: "uk", name_uk: "Подія" });
    expect(result.success).toBe(true);
  });

  it("rejects a uk event missing name_uk", () => {
    const result = schema.safeParse({ ...BASE, event_language: "uk", name_en: "Event" });
    expect(result.success).toBe(false);
  });

  it("accepts an en event with only name_en set", () => {
    const result = schema.safeParse({ ...BASE, event_language: "en", name_en: "Event" });
    expect(result.success).toBe(true);
  });

  it("rejects an en event missing name_en", () => {
    const result = schema.safeParse({ ...BASE, event_language: "en", name_uk: "Подія" });
    expect(result.success).toBe(false);
  });

  it("rejects a bilingual event missing either language's name", () => {
    expect(
      schema.safeParse({ ...BASE, event_language: "bilingual", name_uk: "Подія" }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...BASE, event_language: "bilingual", name_en: "Event" }).success,
    ).toBe(false);
  });

  it("accepts a bilingual event with both names set", () => {
    const result = schema.safeParse({
      ...BASE,
      event_language: "bilingual",
      name_uk: "Подія",
      name_en: "Event",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an event with neither name set, whatever the language", () => {
    for (const event_language of ["uk", "en", "bilingual"] as const) {
      expect(schema.safeParse({ ...BASE, event_language }).success).toBe(false);
    }
  });
});
