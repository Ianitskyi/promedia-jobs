// Hand-written to match supabase/migrations/0001_init.sql.
// Regenerate/verify against a live project with:
//   supabase gen types typescript --linked > lib/database.types.ts
// once a real Supabase project is linked.

import type { Locale, EventLanguage } from "@/lib/i18n/locale";

export type OrgRole = "OWNER" | "ADMIN" | "CHECKIN_STAFF";
export type EventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type CheckinMethod = "QR" | "MANUAL" | "KIOSK";
/** Matches the `ui_language` Postgres enum exactly — see lib/i18n/locale.ts's `Locale`. */
export type UiLanguage = Locale;
/** Matches the `event_language` Postgres enum exactly. */
export type EventLanguageOption = EventLanguage;

export type Organization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationUser = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
};

export type Event = {
  id: string;
  organization_id: string;
  slug: string;
  event_language: EventLanguageOption;
  name_uk: string | null;
  name_en: string | null;
  description_uk: string | null;
  description_en: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  timezone: string;
  venue_name_uk: string | null;
  venue_name_en: string | null;
  address: string | null;
  capacity: number | null;
  registration_deadline: string | null;
  status: EventStatus;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
  updated_at: string;
};

export type RegistrationConsent = {
  id: string;
  version: string;
  language: UiLanguage;
  text_snapshot: string;
  consented_at: string;
};

export type Attendee = {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  normalized_email: string;
  company: string | null;
  position: string | null;
  preferred_language: UiLanguage;
  consent_id: string;
  registered_at: string;
};

export type Ticket = {
  id: string;
  event_id: string;
  attendee_id: string;
  public_token: string;
  created_at: string;
  revoked_at: string | null;
};

export type Checkin = {
  id: string;
  ticket_id: string;
  event_id: string;
  checked_in_at: string;
  checked_in_by: string | null;
  method: CheckinMethod;
};

export type RegistrationResult = {
  attendee_id: string;
  ticket_id: string | null;
  public_token: string;
  already_registered: boolean;
};

export type PerformCheckinResult = {
  checkin_id: string;
  checked_in_at: string;
  was_created: boolean;
};

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Partial<Organization> & { name: string; slug: string };
        Update: Partial<Organization>;
        Relationships: [];
      };
      organization_users: {
        Row: OrganizationUser;
        Insert: Partial<OrganizationUser> & {
          organization_id: string;
          user_id: string;
        };
        Update: Partial<OrganizationUser>;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: Partial<Event> & {
          organization_id: string;
          slug: string;
          start_date: string;
          start_time: string;
          end_date: string;
          end_time: string;
          timezone: string;
        };
        Update: Partial<Event>;
        Relationships: [];
      };
      registration_consents: {
        Row: RegistrationConsent;
        Insert: Partial<RegistrationConsent> & {
          version: string;
          language: UiLanguage;
          text_snapshot: string;
        };
        Update: Partial<RegistrationConsent>;
        Relationships: [];
      };
      attendees: {
        Row: Attendee;
        Insert: Partial<Attendee> & {
          event_id: string;
          first_name: string;
          last_name: string;
          email: string;
          preferred_language: UiLanguage;
          consent_id: string;
        };
        Update: Partial<Attendee>;
        Relationships: [];
      };
      tickets: {
        Row: Ticket;
        Insert: Partial<Ticket> & {
          event_id: string;
          attendee_id: string;
          public_token: string;
        };
        Update: Partial<Ticket>;
        Relationships: [];
      };
      checkins: {
        Row: Checkin;
        Insert: Partial<Checkin> & {
          ticket_id: string;
          event_id: string;
          method: CheckinMethod;
        };
        Update: Partial<Checkin>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      register_attendee: {
        Args: {
          p_event_id: string;
          p_first_name: string;
          p_last_name: string;
          p_email: string;
          p_company: string | null;
          p_position: string | null;
          p_language: UiLanguage;
          p_consent_version: string;
          p_consent_text: string;
        };
        Returns: RegistrationResult;
      };
      perform_checkin: {
        Args: {
          p_ticket_id: string;
          p_event_id: string;
          p_method: CheckinMethod;
          p_checked_in_by: string | null;
        };
        Returns: PerformCheckinResult[];
      };
      create_organization_with_owner: {
        Args: { p_name: string; p_slug: string; p_owner_user_id: string };
        Returns: Organization;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
