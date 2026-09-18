import { z } from "zod";

export const registrationFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required.").max(120),
  last_name: z.string().trim().min(1, "Last name is required.").max(120),
  email: z.email("Enter a valid email address.").max(255),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  position: z.string().trim().max(200).optional().or(z.literal("")),
  consent: z.literal("on", { message: "Please accept the consent notice to continue." }),
  // Honeypot: real visitors never fill a field hidden with CSS/aria-hidden.
  // Deliberately unconstrained here — the server action checks it and
  // returns a generic error, rather than this schema surfacing a
  // field-specific validation message that would hint at the mechanism.
  website: z.string().optional().or(z.literal("")),
});
