import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Same locale-aware factory pattern as lib/validation/registration.ts. */
export function createForgotPasswordFormSchema(dict: Dictionary) {
  return z.object({
    email: z.email(dict.auth.validationEmail).max(255),
  });
}

export function createResetPasswordFormSchema(dict: Dictionary) {
  return z
    .object({
      password: z.string().min(8, dict.auth.validationPasswordMinLength),
      confirmPassword: z.string().min(1, dict.auth.validationPasswordMinLength),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: dict.auth.validationPasswordMismatch,
      path: ["confirmPassword"],
    });
}
