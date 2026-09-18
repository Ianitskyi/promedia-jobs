"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Input, Textarea } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { listTimezones } from "@/lib/timezone-list";
import { utcToZonedDatetimeLocal } from "@/lib/timezone";
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
  const [state, formAction, pending] = useActionState(action, { error: null });
  const formTimeZone =
    defaultValues?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6" noValidate>
      <FormField label="Event name" htmlFor="name" required>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required />
      </FormField>

      <FormField label="Short description" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Start date" htmlFor="start_date" required>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={defaultValues?.start_date}
            required
          />
        </FormField>
        <FormField label="Start time" htmlFor="start_time" required>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            defaultValue={defaultValues?.start_time?.slice(0, 5)}
            required
          />
        </FormField>
        <FormField label="End date" htmlFor="end_date" required>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={defaultValues?.end_date}
            required
          />
        </FormField>
        <FormField label="End time" htmlFor="end_time" required>
          <Input
            id="end_time"
            name="end_time"
            type="time"
            defaultValue={defaultValues?.end_time?.slice(0, 5)}
            required
          />
        </FormField>
      </div>

      <FormField label="Timezone" htmlFor="timezone" required>
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
        <FormField label="Venue name" htmlFor="venue_name">
          <Input id="venue_name" name="venue_name" defaultValue={defaultValues?.venue_name ?? ""} />
        </FormField>
        <FormField label="Address" htmlFor="address">
          <Input id="address" name="address" defaultValue={defaultValues?.address ?? ""} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Registration capacity"
          htmlFor="capacity"
          hint="Optional. Leave blank for unlimited."
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
          label="Registration deadline"
          htmlFor="registration_deadline"
          hint="Optional, in the event's timezone."
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
          label="Event logo URL"
          htmlFor="logo_url"
          hint="Optional. Falls back to the organization logo."
        >
          <Input id="logo_url" name="logo_url" defaultValue={defaultValues?.logo_url ?? ""} />
        </FormField>
        <FormField
          label="Accent color"
          htmlFor="primary_color"
          hint="Optional hex color, e.g. #1a1a1a."
        >
          <Input
            id="primary_color"
            name="primary_color"
            placeholder="#1a1a1a"
            defaultValue={defaultValues?.primary_color ?? ""}
          />
        </FormField>
      </div>

      <FormField label="Status" htmlFor="status" required>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues?.status ?? "DRAFT"}
          className="w-full rounded-sm border border-[var(--border)] bg-background px-3 py-2.5 text-sm"
        >
          <option value="DRAFT">Draft — not visible publicly</option>
          <option value="PUBLISHED">Published — registration open</option>
          <option value="CLOSED">Closed — registration closed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </FormField>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
