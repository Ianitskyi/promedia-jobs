import { describe, it, expect } from "vitest";
import { createForgotPasswordFormSchema, createResetPasswordFormSchema } from "./auth";
import { en, uk } from "@/lib/i18n/dictionaries";

describe("forgotPasswordFormSchema", () => {
  it("accepts a valid email", () => {
    const schema = createForgotPasswordFormSchema(en);
    expect(schema.safeParse({ email: "andrii@example.com" }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const schema = createForgotPasswordFormSchema(en);
    expect(schema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects an empty email", () => {
    const schema = createForgotPasswordFormSchema(en);
    expect(schema.safeParse({ email: "" }).success).toBe(false);
  });

  it("returns the English validation message from the English dictionary", () => {
    const schema = createForgotPasswordFormSchema(en);
    const result = schema.safeParse({ email: "not-an-email" });
    expect(result.success || result.error.issues[0]?.message).toBe(en.auth.validationEmail);
  });

  it("returns the Ukrainian validation message from the Ukrainian dictionary", () => {
    const schema = createForgotPasswordFormSchema(uk);
    const result = schema.safeParse({ email: "not-an-email" });
    expect(result.success || result.error.issues[0]?.message).toBe(uk.auth.validationEmail);
    expect(result.success || result.error.issues[0]?.message).not.toBe(en.auth.validationEmail);
  });
});

describe("resetPasswordFormSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    const schema = createResetPasswordFormSchema(en);
    expect(
      schema.safeParse({ password: "a-strong-password", confirmPassword: "a-strong-password" }).success,
    ).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const schema = createResetPasswordFormSchema(en);
    const result = schema.safeParse({ password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0]?.message).toBe(en.auth.validationPasswordMinLength);
  });

  it("rejects mismatched passwords, in English", () => {
    const schema = createResetPasswordFormSchema(en);
    const result = schema.safeParse({ password: "a-strong-password", confirmPassword: "different" });
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0]?.message).toBe(en.auth.validationPasswordMismatch);
    expect(result.success || result.error.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("rejects mismatched passwords, in Ukrainian", () => {
    const schema = createResetPasswordFormSchema(uk);
    const result = schema.safeParse({ password: "a-strong-password", confirmPassword: "different" });
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0]?.message).toBe(uk.auth.validationPasswordMismatch);
    expect(result.success || result.error.issues[0]?.message).not.toBe(en.auth.validationPasswordMismatch);
  });
});
