import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { EVENT_LANGUAGES } from "@/lib/i18n/locale";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/**
 * Builds the event form's validation schema with messages in `dict`'s
 * language — validation runs server-side (in the create/edit server
 * actions), so the messages shown to the organizer must follow their
 * platform locale, not a hardcoded language.
 */
export function createEventFormSchema(dict: Dictionary) {
  const hexColor = z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, dict.events.validationAccentColor)
    .optional()
    .or(z.literal(""));

  return z
    .object({
      event_language: z.enum(EVENT_LANGUAGES),
      name_uk: optionalText,
      name_en: optionalText,
      description_uk: optionalText,
      description_en: optionalText,
      start_date: z.string().min(1, dict.events.validationStartDateRequired),
      start_time: z.string().min(1, dict.events.validationStartTimeRequired),
      end_date: z.string().min(1, dict.events.validationEndDateRequired),
      end_time: z.string().min(1, dict.events.validationEndTimeRequired),
      timezone: z.string().min(1, dict.events.validationTimezoneRequired),
      event_format: z.enum(["offline", "online", "hybrid"]),
      cover_image_url: optionalText,
      country_code: optionalText.transform((v) => v?.toUpperCase()).refine((v) => v === undefined || /^[A-Z]{2}$/.test(v), { message: dict.events.validationCountryCode }),
      region: optionalText,
      city: optionalText,
      venue_name_uk: optionalText,
      venue_name_en: optionalText,
      address: optionalText,
      capacity: z
        .string()
        .trim()
        .transform((v) => (v === "" ? undefined : Number(v)))
        .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
          message: dict.events.validationCapacityPositive,
        })
        .optional(),
      registration_deadline: optionalText,
      logo_url: optionalText,
      primary_color: hexColor,
      status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]),
    })
    .refine(
      (data) => `${data.start_date}T${data.start_time}` <= `${data.end_date}T${data.end_time}`,
      { message: dict.events.validationEndAfterStart, path: ["end_date"] },
    )
    .refine((data) => data.event_language === "en" || Boolean(data.name_uk), {
      message: dict.events.validationNameUkRequired,
      path: ["name_uk"],
    })
    .refine((data) => data.event_language === "uk" || Boolean(data.name_en), {
      message: dict.events.validationNameEnRequired,
      path: ["name_en"],
    });
}

export type EventFormValues = z.infer<ReturnType<typeof createEventFormSchema>>;
