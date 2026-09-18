import { describe, it, expect } from "vitest";
import { createRegistrationFormSchema } from "./registration";
import { en, uk } from "@/lib/i18n/dictionaries";

const registrationFormSchema = createRegistrationFormSchema(en);

const VALID = {
  first_name: "Andrii",
  last_name: "Ianitskyi",
  email: "andrii@example.com",
  company: "ProMedia",
  position: "Engineer",
  consent: "on",
  website: "",
};

describe("registrationFormSchema", () => {
  it("accepts a complete, valid submission", () => {
    expect(registrationFormSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = registrationFormSchema.safeParse({ ...VALID, email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = registrationFormSchema.safeParse({ ...VALID, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("requires consent to be explicitly checked", () => {
    const result = registrationFormSchema.safeParse({ ...VALID, consent: undefined });
    expect(result.success).toBe(false);
  });

  it("allows organization and position to be omitted", () => {
    const result = registrationFormSchema.safeParse({
      ...VALID,
      company: undefined,
      position: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("parses (but does not itself reject) a filled honeypot field", () => {
    // The schema stays permissive here on purpose — actions.ts is what
    // rejects a tripped honeypot, with a generic error that doesn't
    // hint at the anti-spam mechanism. See registerForEvent's website check.
    const result = registrationFormSchema.safeParse({ ...VALID, website: "http://spam.example" });
    expect(result.success).toBe(true);
    expect(result.data?.website).toBe("http://spam.example");
  });

  describe("localization", () => {
    it("returns English messages when built from the English dictionary", () => {
      const schema = createRegistrationFormSchema(en);
      const result = schema.safeParse({ ...VALID, email: "not-an-email" });
      expect(result.success).toBe(false);
      expect(result.success || result.error.issues[0]?.message).toBe(en.registration.validationEmail);
    });

    it("returns Ukrainian messages when built from the Ukrainian dictionary", () => {
      const schema = createRegistrationFormSchema(uk);
      const result = schema.safeParse({ ...VALID, email: "not-an-email" });
      expect(result.success).toBe(false);
      expect(result.success || result.error.issues[0]?.message).toBe(uk.registration.validationEmail);
      expect(result.success || result.error.issues[0]?.message).not.toBe(en.registration.validationEmail);
    });

    it("localizes the missing-consent message per dictionary", () => {
      const ukSchema = createRegistrationFormSchema(uk);
      const result = ukSchema.safeParse({ ...VALID, consent: undefined });
      expect(result.success).toBe(false);
      expect(result.success || result.error.issues[0]?.message).toBe(
        uk.registration.validationConsentRequired,
      );
    });
  });
});
