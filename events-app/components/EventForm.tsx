"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { listTimezones } from "@/lib/timezone-list";
import { utcToZonedDatetimeLocal } from "@/lib/timezone";
import { useI18n } from "@/lib/i18n/client";
import type { EventLanguage } from "@/lib/i18n/locale";
import type { Event } from "@/lib/database.types";

export interface EventFormState {
  error: string | null;
}

interface EventFormProps {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  defaultValues?: Partial<Event>;
  submitLabel: string;
}

const timezones = listTimezones();

/**
 * Pre-fills the deadline field in the *event's* timezone, not the
 * editor's browser timezone — the form submits this value combined
 * with the timezone field and interprets it as being in that zone
 * (see zonedTimeToUtc in the create/edit server actions), so pre-
 * filling it in a different zone would silently shift the stored
 * deadline on save unless the organizer happened to change it anyway.
 */
function toDatetimeLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return utcToZonedDatetimeLocal(iso, timeZone);
}

export function EventForm({ action, defaultValues, submitLabel }: EventFormProps) {
  const { dict } = useI18n();
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [eventLanguage, setEventLanguage] = useState<EventLanguage>(
    defaultValues?.event_language ?? "uk",
  );
  const formTimeZone =
    defaultValues?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const needsUk = eventLanguage === "uk" || eventLanguage === "bilingual";
  const needsEn = eventLanguage === "en" || eventLanguage === "bilingual";

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6" noValidate>
      <FormField label={dict.events.fieldEventLanguage} htmlFor="event_language" required>
        <select
          id="event_language"
          name="event_language"
          value={eventLanguage}
          onChange={(e) => setEventLanguage(e.target.value as EventLanguage)}
          className="w-full rounded-sm border border-[var(--border)] bg-background px-3 py-2.5 text-sm"
        >
          <option value="uk">{dict.events.eventLanguageUk}</option>
          <option value="en">{dict.events.eventLanguageEn}</option>
          <option value="bilingual">{dict.events.eventLanguageBilingual}</option>
        </select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={dict.events.fieldNameUk} htmlFor="name_uk" required={needsUk}>
          <Input id="name_uk" name="name_uk" defaultValue={defaultValues?.name_uk ?? ""} />
        </FormField>
        <FormField label={dict.events.fieldNameEn} htmlFor="name_en" required={needsEn}>
          <Input id="name_en" name="name_en" defaultValue={defaultValues?.name_en ?? ""} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={dict.events.fieldDescriptionUk} htmlFor="description_uk">
          <Textarea
            id="description_uk"
            name="description_uk"
            rows={3}
            defaultValue={defaultValues?.description_uk ?? ""}
          />
        </FormField>
        <FormField label={dict.events.fieldDescriptionEn} htmlFor="description_en">
          <Textarea
            id="description_en"
            name="description_en"
            rows={3}
            defaultValue={defaultValues?.description_en ?? ""}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={dict.events.fieldStartDate} htmlFor="start_date" required>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={defaultValues?.start_date}
            required
          />
        </FormField>
        <FormField label={dict.events.fieldStartTime} htmlFor="start_time" required>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            defaultValue={defaultValues?.start_time?.slice(0, 5)}
            required
          />
        </FormField>
        <FormField label={dict.events.fieldEndDate} htmlFor="end_date" required>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={defaultValues?.end_date}
            required
          />
        </FormField>
        <FormField label={dict.events.fieldEndTime} htmlFor="end_time" required>
          <Input
            id="end_time"
            name="end_time"
            type="time"
            defaultValue={defaultValues?.end_time?.slice(0, 5)}
            required
          />
        </FormField>
      </div>

      <FormField label={dict.events.fieldTimezone} htmlFor="timezone" required>
        <select
          id="timezone"
          name="timezone"
          defaultValue={formTimeZone}
          required
          className="w-full rounded-sm border border-[var(--border)] bg-background px-3 py-2.5 text-sm"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={dict.events.fieldVenueNameUk} htmlFor="venue_name_uk">
          <Input
            id="venue_name_uk"
            name="venue_name_uk"
            defaultValue={defaultValues?.venue_name_uk ?? ""}
          />
        </FormField>
        <FormField label={dict.events.fieldVenueNameEn} htmlFor="venue_name_en">
          <Input
            id="venue_name_en"
            name="venue_name_en"
            defaultValue={defaultValues?.venue_name_en ?? ""}
          />
        </FormField>
      </div>

      <FormField label={dict.events.fieldAddress} htmlFor="address">
        <Input id="address" name="address" defaultValue={defaultValues?.address ?? ""} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label={dict.events.fieldCapacity}
          htmlFor="capacity"
          hint={dict.events.fieldCapacityHint}
        >
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={defaultValues?.capacity ?? ""}
          />
        </FormField>
        <FormField
          label={dict.events.fieldDeadline}
          htmlFor="registration_deadline"
          hint={dict.events.fieldDeadlineHint}
        >
          <Input
            id="registration_deadline"
            name="registration_deadline"
            type="datetime-local"
            defaultValue={toDatetimeLocal(defaultValues?.registration_deadline, formTimeZone)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label={dict.events.fieldLogoUrl}
          htmlFor="logo_url"
          hint={dict.events.fieldLogoUrlHint}
        >
          <Input id="logo_url" name="logo_url" defaultValue={defaultValues?.logo_url ?? ""} />
        </FormField>
        <FormField
          label={dict.events.fieldAccentColor}
          htmlFor="primary_color"
          hint={dict.events.fieldAccentColorHint}
        >
          <Input
            id="primary_color"
            name="primary_color"
            placeholder="#1a1a1a"
            defaultValue={defaultValues?.primary_color ?? ""}
          />
        </FormField>
      </div>

      <FormField label={dict.events.fieldStatus} htmlFor="status" required>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues?.status ?? "DRAFT"}
          className="w-full rounded-sm border border-[var(--border)] bg-background px-3 py-2.5 text-sm"
        >
          <option value="DRAFT">{dict.events.statusOptionDraft}</option>
          <option value="PUBLISHED">{dict.events.statusOptionPublished}</option>
          <option value="CLOSED">{dict.events.statusOptionClosed}</option>
          <option value="ARCHIVED">{dict.events.statusOptionArchived}</option>
        </select>
      </FormField>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? dict.events.submitSaving : submitLabel}
        </Button>
      </div>
    </form>
  );
}
