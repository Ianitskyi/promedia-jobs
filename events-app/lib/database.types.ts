// Hand-written to match supabase/migrations/0001_init.sql and
// 0002_platform_refactor.sql. Regenerate/verify against a live project
// with:
//   supabase gen types typescript --linked > lib/database.types.ts
// once a real Supabase project is linked.
//
// See docs/ARCHITECTURE_V2.md for what each of these tables is for.
// Terminology note: `Workspace` is a tenant/account on the platform
// (was `Organization` before the platform refactor). `CrmOrganization`
// is an unrelated, workspace-scoped CRM record (a newsroom, NGO, donor,
// etc.) — the two are deliberately different types.

import type { Locale, EventLanguage } from "@/lib/i18n/locale";

export type WorkspaceRole = "OWNER" | "ADMIN" | "CHECKIN_STAFF";
export type EventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type CheckinMethod = "QR" | "MANUAL" | "KIOSK";
export type RegistrationStatus = "registered" | "cancelled";
/** Matches the `ui_language` Postgres enum exactly — see lib/i18n/locale.ts's `Locale`. */
export type UiLanguage = Locale;
/** Matches the `event_language` Postgres enum exactly. */
export type EventLanguageOption = EventLanguage;

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type Event = {
  id: string;
  workspace_id: string;
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
  event_format: "offline" | "online" | "hybrid";
  cover_image_url: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  registration_deadline: string | null;
  status: EventStatus;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A persistent, workspace-scoped CRM contact. Reused across every event
 * (and, eventually, every module) a person interacts with — never
 * recreated per registration. See ARCHITECTURE_V2.md §2-§3 for the full
 * intended shape; only the fields the Events module actually populates
 * today (name, email, phone slot, preferred_language) are ever written
 * by this app's code — the rest (tags, custom_fields,
 * communication_preferences, city, date_of_birth, notes) exist for
 * future modules and are otherwise left at their defaults.
 */
export type Person = {
  id: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string;
  normalized_email: string;
  phone: string | null;
  preferred_language: UiLanguage | null;
  city: string | null;
  date_of_birth: string | null;
  notes: string | null;
  tags: unknown[];
  custom_fields: Record<string, unknown>;
  communication_preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/**
 * A CRM-level organization (newsroom, NGO, donor, partner, ...) —
 * distinct from `Workspace`. Not exposed in the Events UI yet; see
 * ARCHITECTURE_V2.md §4.
 */
export type CrmOrganization = {
  id: string;
  workspace_id: string;
  name: string;
  org_type: string | null;
  notes: string | null;
  tags: unknown[];
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** See ARCHITECTURE_V2.md §4. Not populated by the Events module today. */
export type PersonOrganizationRelationship = {
  id: string;
  workspace_id: string;
  person_id: string;
  organization_id: string;
  role_title: string | null;
  relationship_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_primary: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/**
 * Append-only interaction history for a person. `subject_type`/
 * `subject_id` is a loose polymorphic reference (e.g. `("event", <id>)`)
 * rather than a foreign key — see the schema comment in
 * 0002_platform_refactor.sql for why. See ARCHITECTURE_V2.md §5.
 */
export type Activity = {
  id: string;
  workspace_id: string;
  person_id: string;
  activity_type: string;
  subject_type: string | null;
  subject_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

/**
 * A person's consent record for a specific purpose (e.g.
 * "event_administration" for the current Events module). See
 * ARCHITECTURE_V2.md §7. `workspace_id`/`person_id` are nullable only
 * because a pre-refactor consent row migrated from 0001 with no
 * matching attendee is a schema edge case, not a normal state — every
 * consent this app writes going forward always sets both.
 */
export type Consent = {
  id: string;
  workspace_id: string | null;
  person_id: string | null;
  purpose: string;
  channel: string | null;
  status: string;
  version: string;
  language: UiLanguage;
  text_snapshot: string;
  source: string | null;
  occurred_at: string;
};

/**
 * An event-specific registration linking a persistent `Person` to an
 * `Event`. Replaces the old event-scoped `Attendee` row — contact
 * details now live on `Person`; only what's specific to *this*
 * registration (the employer/title they gave for this event, its
 * consent, its status) lives here. See ARCHITECTURE_V2.md §5.
 */
export type Registration = {
  id: string;
  workspace_id: string;
  event_id: string;
  person_id: string;
  company_at_registration: string | null;
  position_at_registration: string | null;
  consent_id: string | null;
  status: RegistrationStatus;
  registered_at: string;
};

export type Ticket = {
  id: string;
  event_id: string;
  registration_id: string;
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

export type EventRegistrationResult = {
  person_id: string;
  registration_id: string;
  ticket_id: string | null;
  public_token: string | null;
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
      workspaces: {
        Row: Workspace;
        Insert: Partial<Workspace> & { name: string; slug: string };
        Update: Partial<Workspace>;
        Relationships: [];
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: Partial<WorkspaceMember> & {
          workspace_id: string;
          user_id: string;
        };
        Update: Partial<WorkspaceMember>;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: Partial<Event> & {
          workspace_id: string;
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
      people: {
        Row: Person;
        Insert: Partial<Person> & {
          workspace_id: string;
          first_name: string;
          last_name: string;
          email: string;
        };
        Update: Partial<Person>;
        Relationships: [];
      };
      crm_organizations: {
        Row: CrmOrganization;
        Insert: Partial<CrmOrganization> & { workspace_id: string; name: string };
        Update: Partial<CrmOrganization>;
        Relationships: [];
      };
      person_organization_relationships: {
        Row: PersonOrganizationRelationship;
        Insert: Partial<PersonOrganizationRelationship> & {
          workspace_id: string;
          person_id: string;
          organization_id: string;
        };
        Update: Partial<PersonOrganizationRelationship>;
        Relationships: [];
      };
      activities: {
        Row: Activity;
        Insert: Partial<Activity> & {
          workspace_id: string;
          person_id: string;
          activity_type: string;
        };
        Update: Partial<Activity>;
        Relationships: [];
      };
      consents: {
        Row: Consent;
        Insert: Partial<Consent> & {
          purpose: string;
          version: string;
          language: UiLanguage;
          text_snapshot: string;
        };
        Update: Partial<Consent>;
        Relationships: [];
      };
      registrations: {
        Row: Registration;
        Insert: Partial<Registration> & {
          workspace_id: string;
          event_id: string;
          person_id: string;
        };
        Update: Partial<Registration>;
        Relationships: [];
      };
      tickets: {
        Row: Ticket;
        Insert: Partial<Ticket> & {
          event_id: string;
          registration_id: string;
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
      register_for_event: {
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
        Returns: EventRegistrationResult;
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
      create_workspace_with_owner: {
        Args: { p_name: string; p_slug: string; p_owner_user_id: string };
        Returns: Workspace;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
