import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1a1a1a.")
  .optional()
  .or(z.literal(""));

export const eventFormSchema = z
  .object({
    name: z.string().trim().min(2, "Enter an event name."),
    description: optionalText,
    start_date: z.string().min(1, "Start date is required."),
    start_time: z.string().min(1, "Start time is required."),
    end_date: z.string().min(1, "End date is required."),
    end_time: z.string().min(1, "End time is required."),
    timezone: z.string().min(1, "Choose a timezone."),
    venue_name: optionalText,
    address: optionalText,
    capacity: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : Number(v)))
      .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
        message: "Capacity must be a positive whole number.",
      })
      .optional(),
    registration_deadline: optionalText,
    logo_url: optionalText,
    primary_color: hexColor,
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]),
  })
  .refine(
    (data) => `${data.start_date}T${data.start_time}` <= `${data.end_date}T${data.end_time}`,
    { message: "Event end must be after its start.", path: ["end_date"] },
  );

export type EventFormValues = z.infer<typeof eventFormSchema>;
