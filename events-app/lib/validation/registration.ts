import { z } from "zod";

export const registrationFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required.").max(120),
  last_name: z.string().trim().min(1, "Last name is required.").max(120),
  email: z.email("Enter a valid email address.").max(255),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  position: z.string().trim().max(200).optional().or(z.literal("")),
  consent: z.literal("on", { message: "Please accept the consent notice to continue." }),
  // Honeypot: real visitors never fill a field hidden with CSS/aria-hidden.
  website: z.string().max(0, "").optional().or(z.literal("")),
});
