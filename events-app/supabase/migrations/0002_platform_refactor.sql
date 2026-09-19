-- ProMedia Platform refactor — Events becomes the first module on a
-- reusable, CRM-ready, multi-tenant core instead of being the center of
-- the schema itself.
--
-- Apply with: supabase db push  (or run in the Supabase SQL editor)
-- after 0001_init.sql. See docs/ARCHITECTURE_V2.md for the full
-- rationale and README.md's "Migration instructions" section for the
-- operational checklist.
--
-- Conceptual shape after this migration:
--
--   Platform
--     -> Workspace                 (was: "organizations" — a tenant)
--         -> CRM Core
--             -> people            (persistent, workspace-scoped contacts)
--             -> crm_organizations (a newsroom/NGO/donor/etc. — NOT a workspace)
--             -> person_organization_relationships
--             -> activities        (append-only interaction history)
--             -> consents          (was: "registration_consents" — generalized)
--         -> Modules
--             -> Events (this migration keeps it fully working)
--                 -> events, registrations (was: "attendees"), tickets, checkins
--
-- This is a rename-and-extend migration, not a drop-and-recreate: it
-- preserves every existing workspace/owner relationship and any rows
-- already created against 0001_init.sql. See the "safety" comment
-- above each step for what it does and does not touch.
--
-- ATOMICITY: this entire file runs as one transaction (explicit BEGIN/
-- COMMIT below). Every statement here is ordinary transactional DDL —
-- nothing uses CREATE INDEX CONCURRENTLY or ALTER TYPE ... ADD VALUE
-- (the one operation Postgres cannot run inside a transaction block
-- together with using the new value). If ANY statement fails, the
-- transaction aborts and Postgres rolls back everything that ran
-- before it — the database is left exactly as it was before this file
-- ran, not half-migrated. Do not run this file's statements one at a
-- time by hand, and do not strip the BEGIN/COMMIT: a partial apply
-- (e.g. "workspaces" renamed but the CRM tables not yet created) would
-- otherwise look like success to whoever ran it, while leaving the
-- schema in a state no code in this app expects. See README.md's
-- "Database migrations" section for exactly how to apply this safely
-- (via `supabase db push`, or `psql -v ON_ERROR_STOP=1 -f`, or pasted
-- into the Supabase SQL editor as one script) against a project that
-- already has 0001_init.sql applied.

begin;

-- =======================================================================
-- STEP 1 — rename the tenant concept: organizations -> workspaces
--
-- "organizations" in 0001 was always the *tenant* (an account on the
-- platform), never a CRM record. Keeping that name would collide with
-- the new CRM-level `crm_organizations` concept below (section 4 of the
-- brief: "Do not use the same database concept for these two things").
-- Renaming preserves every row, id, and foreign key automatically —
-- Postgres table/column renames do not touch data or existing
-- relationships.
-- =======================================================================

alter table organizations rename to workspaces;
alter table organization_users rename to workspace_members;
alter table workspace_members rename column organization_id to workspace_id;
alter table events rename column organization_id to workspace_id;

alter type org_role rename to workspace_role;

alter index organization_users_user_id_idx rename to workspace_members_user_id_idx;
alter index events_organization_id_idx rename to events_workspace_id_idx;

-- Composite-FK target for STEP 4's `registrations` table: lets
-- `registrations` declare "my event_id AND workspace_id must both
-- match one real events row" as a single declarative foreign key
-- (STEP 2/§2-workspace-consistency below), rather than trusting
-- application code to keep the two in sync. `id` alone is already
-- unique (it's the primary key) — this adds nothing but the ability to
-- use (id, workspace_id) as an FK target.
alter table events add constraint events_id_workspace_id_key unique (id, workspace_id);

-- Old RLS helper functions/policies are dropped and recreated under
-- their new names in STEP 6, once every table they reference has been
-- renamed.

-- =======================================================================
-- STEP 2 — CRM Core: people, crm_organizations, relationships, activities
--
-- These are additive (new tables) — nothing existing is touched. Only
-- the parts Events actually needs are wired up in STEP 4; the rest
-- (custom fields, tags, communication preferences, relationship
-- metadata) is architecture the Events module does not populate yet,
-- kept intentionally empty rather than fake-populated. See
-- docs/ARCHITECTURE_V2.md §2-§5 for what's IMPLEMENTED NOW vs FUTURE.
-- =======================================================================

-- A persistent, workspace-scoped contact. One person may register for
-- many events over time — this is the record Events registration
-- reuses instead of creating a fresh row every time (STEP 4).
create table people (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  display_name text,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Dedup key: the same normalized email within one workspace resolves
  -- to the same person. Deliberately NOT globally unique — the same
  -- email in two different workspaces must produce two independent
  -- people rows (tenant boundaries are absolute; see ARCHITECTURE_V2 §9).
  normalized_email text generated always as (lower(trim(email))) stored,
  phone text,
  preferred_language ui_language,
  city text,
  date_of_birth date,
  -- Architecture for future CRM fields the Events module does not
  -- collect or expose today (brief §3): kept as flexible jsonb rather
  -- than one column per future field, so adding a use for them later
  -- never requires another migration.
  notes text,
  tags jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  communication_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, normalized_email),
  -- Composite-FK target: lets every table that references a person
  -- also declare "and it must be in this same workspace" as a single
  -- foreign key (see person_organization_relationships, activities,
  -- consents, registrations below) instead of trusting application
  -- code to keep workspace_id in sync with the referenced person's own
  -- workspace_id. `id` alone is already unique (primary key); this
  -- exists only so (id, workspace_id) can be an FK target.
  unique (id, workspace_id)
);

create index people_workspace_id_idx on people(workspace_id);
-- Composite (not a separate single-column index): every real lookup is
-- "this email, in this workspace" — the dedup check in
-- register_for_event and any future contact search both filter on both
-- columns together, so a composite index serves them directly instead
-- of Postgres combining two separate indexes per query.
create index people_workspace_email_idx on people(workspace_id, normalized_email);

create trigger people_set_updated_at
  before update on people
  for each row execute function set_updated_at();

-- A CRM-level organization (newsroom, NGO, donor, partner, ...) — NOT a
-- workspace/tenant. Not exposed in the Events UI yet; exists so the
-- relationship model below has something to attach to, per brief §4.
create table crm_organizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  org_type text,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite-FK target — see the matching comment on people above.
  unique (id, workspace_id)
);

create index crm_organizations_workspace_id_idx on crm_organizations(workspace_id);

create trigger crm_organizations_set_updated_at
  before update on crm_organizations
  for each row execute function set_updated_at();

-- Person <-> Organization relationship (brief §4): a person may
-- represent several organizations over time, an organization may have
-- several people. Not populated by the Events module today.
--
-- WORKSPACE CONSISTENCY: person_id/organization_id deliberately have no
-- plain single-column foreign key here — only the composite ones below,
-- which force this row's workspace_id to equal BOTH the referenced
-- person's AND the referenced organization's actual workspace_id. RLS
-- cannot guarantee this on its own (a service-role connection bypasses
-- RLS entirely, and even under RLS nothing stops a workspace-A admin
-- from *trying* to insert a row naming a workspace-B person, only from
-- *reading* workspace-B's rows) — this is a real, always-on database
-- constraint, checked for every writer including service_role.
create table person_organization_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  person_id uuid not null,
  organization_id uuid not null,
  role_title text,
  relationship_type text,
  start_date date,
  end_date date,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (person_id, workspace_id) references people(id, workspace_id) on delete cascade,
  foreign key (organization_id, workspace_id) references crm_organizations(id, workspace_id) on delete cascade
);

create index person_org_rel_workspace_id_idx on person_organization_relationships(workspace_id);
create index person_org_rel_person_id_idx on person_organization_relationships(person_id);
create index person_org_rel_organization_id_idx on person_organization_relationships(organization_id);

create trigger person_org_rel_set_updated_at
  before update on person_organization_relationships
  for each row execute function set_updated_at();

-- Append-only activity timeline (brief §5). A future module adds a new
-- activity_type value, not a new column here or on `people` — this is
-- the extension point that lets modules accumulate history without
-- redesigning the core. subject_type/subject_id is a loose polymorphic
-- reference (e.g. ('event', <event id>)) rather than a foreign key,
-- deliberately: the set of subject tables grows with every future
-- module, and a hard FK here would need a schema change per module,
-- which is exactly what this table exists to avoid. Integrity for the
-- one subject type in use today (events) is instead the job of the
-- application code that writes these rows (the register_for_event and
-- perform_checkin functions below), not a database constraint.
--
-- WORKSPACE CONSISTENCY: person_id has no plain single-column foreign
-- key — only the composite one below, which forces
-- activities.workspace_id to equal the referenced person's own
-- workspace_id at all times, for every writer (see the matching
-- comment on person_organization_relationships above).
create table activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  person_id uuid not null,
  activity_type text not null,
  subject_type text,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (person_id, workspace_id) references people(id, workspace_id) on delete cascade
);

create index activities_workspace_id_idx on activities(workspace_id);
create index activities_person_id_idx on activities(person_id, occurred_at desc);

-- =======================================================================
-- STEP 3 — consents: generalize registration_consents into a reusable
-- per-person consent/history record (brief §6), instead of a bare
-- snapshot only ever reachable via one attendee row.
--
-- Renamed and extended in place (not dropped) so any consent already
-- recorded under 0001 survives with its id, text_snapshot, and
-- consented_at untouched.
-- =======================================================================

alter table registration_consents rename to consents;
alter table consents rename column consented_at to occurred_at;

alter table consents
  add column workspace_id uuid references workspaces(id) on delete cascade,
  add column person_id uuid references people(id) on delete cascade,
  add column purpose text not null default 'event_administration',
  add column channel text,
  add column status text not null default 'granted',
  add column source text;

alter table consents alter column purpose drop default;

-- WORKSPACE CONSISTENCY: person_id got a plain single-column FK above
-- (`references people(id) on delete cascade`) when the column was
-- added — that alone doesn't stop a row from naming a person_id in one
-- workspace while workspace_id says another. Drop it and replace with
-- the composite version, matching every other CRM table (see the
-- comment on person_organization_relationships above). Both columns
-- stay nullable (a pre-refactor consent row migrated with no matching
-- attendee has neither set — see STEP 4); the constraint simply isn't
-- checked when either side is null, and is enforced whenever both are
-- set, which is always true for every consent this app writes today.
alter table consents drop constraint consents_person_id_fkey;
alter table consents
  add constraint consents_person_workspace_fkey
  foreign key (person_id, workspace_id) references people(id, workspace_id) on delete cascade;

create index consents_workspace_id_idx on consents(workspace_id);
create index consents_person_id_idx on consents(person_id);

-- =======================================================================
-- STEP 4 — Events module: attendees -> registrations, keyed to a
-- persistent person instead of embedding contact fields per event.
--
-- Data migration: every existing attendees row becomes exactly one
-- people row (deduplicated by workspace + normalized email, since the
-- same person may already appear under several events in 0001's
-- event-scoped attendee model) plus one registrations row linking that
-- person back to the event they attended. Existing tickets are
-- repointed from attendee_id to the new registration_id with no data
-- loss — same ticket id, same public_token, same revoked_at.
-- =======================================================================

create table people_migration_map (
  attendee_id uuid primary key,
  person_id uuid not null
);

-- One people row per distinct (workspace, normalized_email) that
-- appears in attendees, seeded from that email's most recent attendee
-- row (arbitrary but deterministic tie-break — pre-migration data is
-- dev/test fixtures only, never real production attendee data; see
-- README "Migration instructions" if this is ever run against a
-- database that does hold real people).
insert into people (
  workspace_id, first_name, last_name, email, phone, preferred_language, created_at, updated_at
)
select distinct on (e.workspace_id, lower(trim(a.email)))
  e.workspace_id,
  a.first_name,
  a.last_name,
  a.email,
  null,
  a.preferred_language,
  a.registered_at,
  a.registered_at
from attendees a
join events e on e.id = a.event_id
order by e.workspace_id, lower(trim(a.email)), a.registered_at desc;

insert into people_migration_map (attendee_id, person_id)
select a.id, p.id
from attendees a
join events e on e.id = a.event_id
join people p on p.workspace_id = e.workspace_id and p.normalized_email = a.normalized_email;

alter table consents
  add column if not exists legacy_attendee_id uuid;
update consents c
  set person_id = m.person_id,
      workspace_id = e.workspace_id,
      legacy_attendee_id = a.id
  from attendees a
  join events e on e.id = a.event_id
  join people_migration_map m on m.attendee_id = a.id
  where a.consent_id = c.id;

-- WORKSPACE CONSISTENCY: event_id/person_id have no plain single-column
-- foreign key — only the composite ones below, which force
-- registrations.workspace_id to equal BOTH the referenced event's AND
-- the referenced person's actual workspace_id, for every writer
-- (including service_role, which bypasses RLS) — see the matching
-- comment on person_organization_relationships above. `unique (id,
-- event_id)` exists purely so tickets can declare, below, that its
-- registration_id must belong to the same event as its own event_id.
create table registrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  event_id uuid not null,
  person_id uuid not null,
  -- Event-specific answers, intentionally NOT promoted onto `people` or
  -- a CRM organization relationship: what someone entered as their
  -- employer/title for *this* event is a per-registration fact, not a
  -- standing truth about them. A future module can still choose to
  -- offer "link this to a CRM organization" as a separate action.
  company_at_registration text,
  position_at_registration text,
  consent_id uuid references consents(id),
  status text not null default 'registered' check (status in ('registered', 'cancelled')),
  registered_at timestamptz not null default now(),
  unique (event_id, person_id),
  unique (id, event_id),
  foreign key (event_id, workspace_id) references events(id, workspace_id) on delete cascade,
  foreign key (person_id, workspace_id) references people(id, workspace_id) on delete cascade
);

create index registrations_workspace_id_idx on registrations(workspace_id);
create index registrations_event_id_idx on registrations(event_id);
create index registrations_person_id_idx on registrations(person_id);

insert into registrations (
  id, workspace_id, event_id, person_id, company_at_registration, position_at_registration,
  consent_id, registered_at
)
select
  a.id, -- keep the same row id, so ticket repointing below is a plain FK swap
  e.workspace_id,
  a.event_id,
  m.person_id,
  a.company,
  a.position,
  a.consent_id,
  a.registered_at
from attendees a
join events e on e.id = a.event_id
join people_migration_map m on m.attendee_id = a.id;

alter table tickets add column registration_id uuid;
update tickets set registration_id = attendee_id;
alter table tickets alter column registration_id set not null;
alter table tickets add constraint tickets_registration_id_key unique (registration_id);

-- WORKSPACE/EVENT CONSISTENCY: composite, not `references
-- registrations(id)` alone — this forces tickets.event_id to equal the
-- referenced registration's own event_id for every writer, closing the
-- one gap the pre-existing `checkins_event_matches_ticket` trigger
-- doesn't cover (that trigger only checks checkins against tickets;
-- nothing previously stopped a ticket itself from naming a
-- registration that actually belongs to a different event). Requires
-- `unique (id, event_id)` on registrations, added when that table was
-- created above. Every existing ticket already satisfies this (its
-- registration_id now equals attendee_id, and that row's event_id was
-- copied from the very same attendee — see the registrations INSERT
-- above), so this ALTER cannot fail against real 0001-era data.
alter table tickets add constraint tickets_registration_id_fkey
  foreign key (registration_id, event_id) references registrations(id, event_id) on delete cascade;
alter table tickets drop constraint tickets_attendee_id_key;
alter table tickets drop constraint tickets_attendee_id_fkey;
alter table tickets drop column attendee_id;

drop table people_migration_map;
drop table attendees;
alter table consents drop column legacy_attendee_id;
alter table consents alter column workspace_id set not null;

-- =======================================================================
-- STEP 5 — RPC functions: register_for_event, perform_checkin,
-- create_workspace_with_owner
-- =======================================================================

drop function if exists register_attendee(uuid, text, text, text, text, text, ui_language, text, text);
drop type if exists registration_result;

create type event_registration_result as (
  person_id uuid,
  registration_id uuid,
  ticket_id uuid,
  public_token text,
  already_registered boolean
);

-- register_for_event: the Events-module entry point for public
-- registration, rebuilt on top of the CRM core. Atomically
-- finds-or-creates the workspace-scoped person by normalized email via
-- INSERT ... ON CONFLICT (never creating a duplicate person for a
-- repeat registration, and safe even when the same email registers for
-- two different events in this workspace at the same instant — see the
-- CONCURRENCY comment further down — brief §2), then creates an
-- event-specific registration + ticket + activity row. Locks the event
-- row for the duration of the call, same as 0001's register_attendee,
-- so concurrent registrations for the SAME event can't both slip past
-- the capacity check (that lock alone does not cover the person
-- find-or-create — see below).
--
-- SECURITY: identical to 0001's register_attendee — a duplicate
-- registration (this person already registered for this event) must
-- NEVER return the existing ticket's public_token. See that function's
-- original comment in 0001_init.sql; the same reasoning applies
-- unchanged here.
create function register_for_event(
  p_event_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_company text,
  p_position text,
  p_language ui_language,
  p_consent_version text,
  p_consent_text text
) returns event_registration_result as $$
declare
  v_event events%rowtype;
  v_normalized_email text := lower(trim(p_email));
  v_person_id uuid;
  v_existing_registration_id uuid;
  v_consent_id uuid;
  v_registration_id uuid;
  v_ticket_id uuid;
  v_token text;
  v_count integer;
begin
  select * into v_event from events where id = p_event_id for update;
  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  if v_event.status <> 'PUBLISHED' then
    raise exception 'EVENT_NOT_PUBLISHED';
  end if;
  if v_event.registration_deadline is not null and now() > v_event.registration_deadline then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  if v_event.event_language <> 'bilingual' and v_event.event_language::text <> p_language::text then
    raise exception 'INVALID_LANGUAGE';
  end if;

  -- Find-or-create the person within this workspace — CONCURRENCY:
  -- the `for update` lock above only serializes registrations for THIS
  -- event. Two concurrent registrations by the same email for two
  -- DIFFERENT events in the same workspace take out no shared lock at
  -- all before reaching this point, so a plain "SELECT, then INSERT if
  -- not found" can let both transactions observe no existing person
  -- and both attempt the INSERT — one succeeds, the other hits the
  -- `people(workspace_id, normalized_email)` unique violation and the
  -- whole registration fails instead of quietly reusing the winner's
  -- person row. `insert ... on conflict do nothing returning` avoids
  -- this: Postgres's unique-index insertion itself blocks a concurrent
  -- inserter of the same key until the first inserter commits or rolls
  -- back, then re-checks for a conflict — so this is a genuinely
  -- atomic find-or-create, not just a narrower race window. On a
  -- conflict (row already existed, whether from before this call or
  -- from the concurrent transaction that just won), nothing is
  -- written and the fallback SELECT below reads the now-committed row.
  -- Either way, an existing person's stored name/language is never
  -- overwritten by a later registration — a later registration might
  -- be filled in by someone else on their behalf, or a nickname, and
  -- should not silently rewrite the CRM record of record.
  insert into people (workspace_id, first_name, last_name, email, preferred_language)
    values (v_event.workspace_id, trim(p_first_name), trim(p_last_name), p_email, p_language)
    on conflict (workspace_id, normalized_email) do nothing
    returning id into v_person_id;

  if v_person_id is null then
    select id into v_person_id
      from people
      where workspace_id = v_event.workspace_id and normalized_email = v_normalized_email;
  end if;

  select id into v_existing_registration_id
    from registrations
    where event_id = p_event_id and person_id = v_person_id;

  if found then
    -- Never return the existing ticket's public_token — see SECURITY
    -- note above. Only already_registered=true distinguishes this from
    -- a fresh registration.
    return (v_person_id, v_existing_registration_id, null, null, true)::event_registration_result;
  end if;

  if v_event.capacity is not null then
    select count(*) into v_count from registrations where event_id = p_event_id;
    if v_count >= v_event.capacity then
      raise exception 'CAPACITY_REACHED';
    end if;
  end if;

  insert into consents (workspace_id, person_id, purpose, channel, status, source, version, language, text_snapshot)
    values (v_event.workspace_id, v_person_id, 'event_administration', 'registration_form', 'granted', 'public_registration_form', p_consent_version, p_language, p_consent_text)
    returning id into v_consent_id;

  insert into registrations (workspace_id, event_id, person_id, company_at_registration, position_at_registration, consent_id)
    values (v_event.workspace_id, p_event_id, v_person_id, nullif(trim(p_company), ''), nullif(trim(p_position), ''), v_consent_id)
    returning id into v_registration_id;

  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_token := replace(v_token, chr(10), '');

  insert into tickets (event_id, registration_id, public_token)
    values (p_event_id, v_registration_id, v_token)
    returning id into v_ticket_id;

  insert into activities (workspace_id, person_id, activity_type, subject_type, subject_id, payload)
    values (v_event.workspace_id, v_person_id, 'event_registered', 'event', p_event_id,
      jsonb_build_object('registration_id', v_registration_id, 'event_id', p_event_id));

  return (v_person_id, v_registration_id, v_ticket_id, v_token, false)::event_registration_result;
end;
$$ language plpgsql security definer set search_path = public;

-- perform_checkin: same atomic, race-safe shape as 0001 (event_id is
-- still derived from the ticket, still compared against p_event_id,
-- still relies on the checkins.ticket_id unique constraint + ON
-- CONFLICT for the "at most one checkin per ticket" guarantee) — now
-- also records an 'event_checked_in' activity for the registration's
-- person, but only the first time a ticket is actually checked in
-- (was_created), never on a repeat scan of an already-checked-in
-- ticket.
create or replace function perform_checkin(
  p_ticket_id uuid,
  p_event_id uuid,
  p_method checkin_method,
  p_checked_in_by uuid
) returns table (
  checkin_id uuid,
  checked_in_at timestamptz,
  was_created boolean
) as $$
declare
  v_ticket_event_id uuid;
  v_registration_id uuid;
  v_person_id uuid;
  v_workspace_id uuid;
  v_checkin_id uuid;
  v_checked_in_at timestamptz;
  v_was_created boolean;
begin
  select t.event_id, t.registration_id into v_ticket_event_id, v_registration_id
    from tickets t where t.id = p_ticket_id;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if v_ticket_event_id <> p_event_id then
    raise exception 'EVENT_MISMATCH';
  end if;

  insert into checkins (ticket_id, event_id, method, checked_in_by)
    values (p_ticket_id, v_ticket_event_id, p_method, p_checked_in_by)
    on conflict (ticket_id) do nothing
    returning id, checkins.checked_in_at into v_checkin_id, v_checked_in_at;

  v_was_created := found;

  if not v_was_created then
    select c.id, c.checked_in_at into v_checkin_id, v_checked_in_at
      from checkins c where c.ticket_id = p_ticket_id;
  else
    select r.person_id, r.workspace_id into v_person_id, v_workspace_id
      from registrations r where r.id = v_registration_id;

    insert into activities (workspace_id, person_id, activity_type, subject_type, subject_id, payload)
      values (v_workspace_id, v_person_id, 'event_checked_in', 'event', v_ticket_event_id,
        jsonb_build_object('ticket_id', p_ticket_id, 'method', p_method));
  end if;

  return query select v_checkin_id, v_checked_in_at, v_was_created;
end;
$$ language plpgsql security definer set search_path = public;

drop function if exists create_organization_with_owner(text, text, uuid);

create function create_workspace_with_owner(
  p_name text,
  p_slug text,
  p_owner_user_id uuid
) returns workspaces as $$
declare
  v_workspace workspaces;
begin
  if p_owner_user_id is null then
    raise exception 'OWNER_USER_ID_REQUIRED';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_owner_user_id) then
    raise exception 'OWNER_USER_NOT_FOUND';
  end if;

  insert into workspaces (name, slug) values (p_name, p_slug)
    returning * into v_workspace;

  insert into workspace_members (workspace_id, user_id, role)
    values (v_workspace.id, p_owner_user_id, 'OWNER');

  return v_workspace;
end;
$$ language plpgsql security definer set search_path = public;

-- =======================================================================
-- STEP 6 — Row Level Security: rebuild the tenant-membership helper
-- functions under their new names, then policies for every table
-- (renamed or new) against workspace_id.
-- =======================================================================

drop policy if exists organizations_select on workspaces;
drop policy if exists organizations_update on workspaces;
drop policy if exists organization_users_select on workspace_members;
drop policy if exists organization_users_insert on workspace_members;
drop policy if exists organization_users_delete on workspace_members;
drop policy if exists events_select on events;
drop policy if exists events_insert on events;
drop policy if exists events_update on events;
drop policy if exists attendees_select on registrations;
drop policy if exists tickets_select on tickets;
drop policy if exists checkins_select on checkins;

drop function if exists is_org_member(uuid);
drop function if exists is_org_admin(uuid);

create function is_workspace_member(target_workspace uuid) returns boolean as $$
  select exists (
    select 1 from workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create function is_workspace_admin(target_workspace uuid) returns boolean as $$
  select exists (
    select 1 from workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.role in ('OWNER', 'ADMIN')
  );
$$ language sql stable security definer set search_path = public;

alter table people enable row level security;
alter table crm_organizations enable row level security;
alter table person_organization_relationships enable row level security;
alter table activities enable row level security;
alter table registrations enable row level security;

-- workspaces / workspace_members: same shape as 0001's
-- organizations/organization_users — still no insert policy for any
-- client role. Workspace provisioning stays controlled: the only way a
-- new workspace (and its first OWNER membership) can be created is the
-- service-role-only create_workspace_with_owner function above, never
-- a direct client-side insert. See docs/ARCHITECTURE_V2.md §9 and §18
-- (brief §17: "Do not re-enable public Workspace creation.").
create policy workspaces_select on workspaces
  for select using (is_workspace_member(id));

create policy workspaces_update on workspaces
  for update using (is_workspace_admin(id));

create policy workspace_members_select on workspace_members
  for select using (is_workspace_member(workspace_id));

create policy workspace_members_insert on workspace_members
  for insert with check (is_workspace_admin(workspace_id));

create policy workspace_members_delete on workspace_members
  for delete using (is_workspace_admin(workspace_id));

create policy events_select on events
  for select using (is_workspace_member(workspace_id));

create policy events_insert on events
  for insert with check (is_workspace_admin(workspace_id));

create policy events_update on events
  for update using (is_workspace_admin(workspace_id));

create policy registrations_select on registrations
  for select using (is_workspace_member(workspace_id));

create policy tickets_select on tickets
  for select using (
    exists (select 1 from events e where e.id = event_id and is_workspace_member(e.workspace_id))
  );

create policy checkins_select on checkins
  for select using (
    exists (select 1 from events e where e.id = event_id and is_workspace_member(e.workspace_id))
  );

-- CRM core tables: readable by any workspace member (needed for a
-- future contact/organization directory and for exports); writable by
-- workspace admins directly (these are plain tenant-scoped business
-- records, not a privileged provisioning operation like workspace
-- creation, so — unlike workspaces/workspace_members above — an
-- ordinary RLS insert/update policy is the right and sufficient
-- control here). No UI exists yet to exercise these write policies;
-- they exist so a future minimal CRM screen doesn't need a database
-- change to go with it.
create policy people_select on people
  for select using (is_workspace_member(workspace_id));

create policy people_insert on people
  for insert with check (is_workspace_admin(workspace_id));

create policy people_update on people
  for update using (is_workspace_admin(workspace_id));

create policy crm_organizations_select on crm_organizations
  for select using (is_workspace_member(workspace_id));

create policy crm_organizations_insert on crm_organizations
  for insert with check (is_workspace_admin(workspace_id));

create policy crm_organizations_update on crm_organizations
  for update using (is_workspace_admin(workspace_id));

create policy person_org_rel_select on person_organization_relationships
  for select using (is_workspace_member(workspace_id));

create policy person_org_rel_insert on person_organization_relationships
  for insert with check (is_workspace_admin(workspace_id));

create policy person_org_rel_update on person_organization_relationships
  for update using (is_workspace_admin(workspace_id));

create policy person_org_rel_delete on person_organization_relationships
  for delete using (is_workspace_admin(workspace_id));

-- activities: read-only audit trail for workspace members. No client
-- insert/update/delete policy — rows are only ever written by
-- SECURITY DEFINER functions (register_for_event, perform_checkin
-- today; future modules add their own), never directly by a client.
create policy activities_select on activities
  for select using (is_workspace_member(workspace_id));

-- consents: now carries workspace_id/person_id, so — unlike 0001's
-- registration_consents, which had no client policy at all — workspace
-- members can read consent records for their own people (useful for a
-- future audit/export view). Still no client insert policy: consents
-- are only ever written by register_for_event today.
create policy consents_select on consents
  for select using (workspace_id is not null and is_workspace_member(workspace_id));

-- =======================================================================
-- STEP 7 — function execution grants
-- =======================================================================

revoke execute on function register_for_event from public, anon, authenticated;
revoke execute on function perform_checkin from public, anon, authenticated;
revoke execute on function create_workspace_with_owner from public, anon, authenticated;

grant execute on function register_for_event to service_role;
grant execute on function perform_checkin to service_role;
grant execute on function create_workspace_with_owner to service_role;
grant execute on function is_workspace_member to authenticated;
grant execute on function is_workspace_admin to authenticated;

commit;
