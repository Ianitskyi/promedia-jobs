-- ProMedia Events — initial schema
-- Multi-tenant event registration & check-in platform.
-- Apply with: supabase db push  (or run in the Supabase SQL editor)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

create type org_role as enum ('OWNER', 'ADMIN', 'CHECKIN_STAFF');
create type event_status as enum ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
create type checkin_method as enum ('QR', 'MANUAL', 'KIOSK');

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- organization_users (membership)
-- ---------------------------------------------------------------------

create table organization_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role org_role not null default 'CHECKIN_STAFF',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_users_user_id_idx on organization_users(user_id);

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------

create table events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  start_date date not null,
  start_time time not null,
  end_date date not null,
  end_time time not null,
  timezone text not null,
  venue_name text,
  address text,
  capacity integer check (capacity is null or capacity > 0),
  registration_deadline timestamptz,
  status event_status not null default 'DRAFT',
  logo_url text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_organization_id_idx on events(organization_id);
create index events_status_idx on events(status);

create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- registration_consents
-- ---------------------------------------------------------------------

create table registration_consents (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  text_snapshot text not null,
  consented_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- attendees
-- ---------------------------------------------------------------------

create table attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text not null check (char_length(trim(last_name)) > 0),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  normalized_email text generated always as (lower(trim(email))) stored,
  company text,
  position text,
  consent_id uuid not null references registration_consents(id),
  registered_at timestamptz not null default now(),
  unique (event_id, normalized_email)
);

create index attendees_event_id_idx on attendees(event_id);

-- ---------------------------------------------------------------------
-- tickets
-- ---------------------------------------------------------------------

create table tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  attendee_id uuid not null unique references attendees(id) on delete cascade,
  public_token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index tickets_event_id_idx on tickets(event_id);
-- public_token already has a unique index from the constraint above;
-- lookups by token are O(log n), no separate index needed.

-- ---------------------------------------------------------------------
-- checkins
-- ---------------------------------------------------------------------

create table checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references tickets(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references auth.users(id),
  method checkin_method not null
);

create index checkins_event_id_idx on checkins(event_id);

-- ---------------------------------------------------------------------
-- Database-level invariant: a checkins row's event_id must always agree
-- with the event_id of the ticket it references. Postgres CHECK
-- constraints can't reference another table, so this is enforced with a
-- trigger instead — deliberately not left to application code (neither
-- perform_checkin below nor the TypeScript pre-check in
-- lib/server/checkin.ts) to get right, because this must hold for any
-- present or future write path into checkins, not just the one we
-- happen to be careful about today.
-- ---------------------------------------------------------------------

create function enforce_checkin_event_matches_ticket() returns trigger as $$
begin
  if new.event_id <> (select t.event_id from tickets t where t.id = new.ticket_id) then
    raise exception 'checkins.event_id (%) does not match tickets.event_id for ticket %',
      new.event_id, new.ticket_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger checkins_event_matches_ticket
  before insert or update on checkins
  for each row execute function enforce_checkin_event_matches_ticket();

-- ---------------------------------------------------------------------
-- perform_checkin: atomic, race-safe check-in.
--
-- Returns the checkins row (existing or newly created) and whether this
-- call created it. SECURITY DEFINER so it can be granted to the anon/
-- authenticated roles without granting them direct INSERT on checkins,
-- keeping the single code path in control of the invariant "at most one
-- checkin per ticket" via the unique constraint + ON CONFLICT.
--
-- event_id for the inserted row is derived from the ticket itself
-- (the authoritative source), not trusted from p_event_id — p_event_id
-- is still required and compared against it, so a caller that somehow
-- reaches this function with a mismatched pair gets a clear
-- EVENT_MISMATCH error rather than either a silently-wrong row (which
-- the trigger above would refuse anyway) or a confusing constraint
-- violation. In the normal app flow, lib/server/checkin.ts already
-- rejects this earlier as WRONG_EVENT and never calls this function at
-- all — this is the defense-in-depth backstop, not the primary check.
-- ---------------------------------------------------------------------

create function perform_checkin(
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
begin
  select event_id into v_ticket_event_id from tickets where id = p_ticket_id;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if v_ticket_event_id <> p_event_id then
    raise exception 'EVENT_MISMATCH';
  end if;

  return query
  with ins as (
    insert into checkins (ticket_id, event_id, method, checked_in_by)
    values (p_ticket_id, v_ticket_event_id, p_method, p_checked_in_by)
    on conflict (ticket_id) do nothing
    returning id, checkins.checked_in_at, true as was_created
  )
  select id, ins.checked_in_at, was_created from ins
  union all
  select c.id, c.checked_in_at, false
  from checkins c
  where c.ticket_id = p_ticket_id
    and not exists (select 1 from ins)
  limit 1;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Tenant isolation baseline: a member of an organization can read rows
-- that belong to it. Role-specific write restrictions (e.g. only
-- OWNER/ADMIN may edit events, only OWNER/ADMIN may export) are
-- enforced in application code (lib/authz.ts) because they need
-- friendlier error handling than RLS denials provide; RLS here is the
-- hard backstop against cross-tenant reads regardless of app bugs.
--
-- Public-facing flows (registration, ticket lookup, check-in by token)
-- go through the service-role client in lib/server/*, which bypasses
-- RLS deliberately and re-checks scoping explicitly in each query.
-- ---------------------------------------------------------------------

alter table organizations enable row level security;
alter table organization_users enable row level security;
alter table events enable row level security;
alter table attendees enable row level security;
alter table tickets enable row level security;
alter table checkins enable row level security;
alter table registration_consents enable row level security;

create function is_org_member(target_org uuid) returns boolean as $$
  select exists (
    select 1 from organization_users ou
    where ou.organization_id = target_org
      and ou.user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create function is_org_admin(target_org uuid) returns boolean as $$
  select exists (
    select 1 from organization_users ou
    where ou.organization_id = target_org
      and ou.user_id = auth.uid()
      and ou.role in ('OWNER', 'ADMIN')
  );
$$ language sql stable security definer set search_path = public;

-- organizations: members can read their own org; any authenticated user
-- can create one (org bootstrap); OWNER/ADMIN can update it.
create policy organizations_select on organizations
  for select using (is_org_member(id));

create policy organizations_insert on organizations
  for insert with check (auth.uid() is not null);

create policy organizations_update on organizations
  for update using (is_org_admin(id));

-- organization_users: members can see membership rows for their org;
-- OWNER/ADMIN can add members; a user can insert their own first
-- membership row only via the bootstrap RPC (service role), so no
-- generic self-insert policy is granted here.
create policy organization_users_select on organization_users
  for select using (is_org_member(organization_id));

create policy organization_users_insert on organization_users
  for insert with check (is_org_admin(organization_id));

create policy organization_users_delete on organization_users
  for delete using (is_org_admin(organization_id));

-- events: members can read/write events for their org (fine-grained
-- edit permission enforced in app code).
create policy events_select on events
  for select using (is_org_member(organization_id));

create policy events_insert on events
  for insert with check (is_org_admin(organization_id));

create policy events_update on events
  for update using (is_org_admin(organization_id));

-- attendees / tickets / checkins: readable by org members via the
-- parent event; writes for these happen through service-role server
-- code (public registration, check-in), so no client-side insert
-- policies are granted.
create policy attendees_select on attendees
  for select using (
    exists (select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

create policy tickets_select on tickets
  for select using (
    exists (select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

create policy checkins_select on checkins
  for select using (
    exists (select 1 from events e where e.id = event_id and is_org_member(e.organization_id))
  );

-- registration_consents has no direct organization_id; it is only ever
-- joined to via attendees, and only read through server code for
-- export. No client policy is granted (service role bypasses RLS).

-- ---------------------------------------------------------------------
-- create_organization_with_owner: bootstraps the first organization for
-- a newly signed-up user. SECURITY DEFINER because organization_users
-- otherwise has no self-insert policy (it requires is_org_admin, which
-- is a chicken-and-egg problem for the very first membership row).
-- ---------------------------------------------------------------------

create function create_organization_with_owner(p_name text, p_slug text)
returns organizations as $$
declare
  v_org organizations;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  insert into organizations (name, slug) values (p_name, p_slug)
    returning * into v_org;

  insert into organization_users (organization_id, user_id, role)
    values (v_org.id, auth.uid(), 'OWNER');

  return v_org;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- register_attendee: the single, atomic entry point for public
-- registration. Locks the event row for the duration of the call so
-- concurrent registrations can't both slip past the capacity check
-- (classic check-then-insert race), and treats "already registered" as
-- a normal outcome rather than an error.
--
-- SECURITY: a duplicate registration must NEVER return the existing
-- ticket's public_token. That token is a bearer credential — anyone
-- who has it can view the attendee's ticket and (via the scanner) is
-- indistinguishable from the real attendee at the door. If submitting
-- a known email were enough to get the token back, knowing someone's
-- email would be enough to steal their ticket. already_registered=true
-- therefore always carries a null public_token and a null ticket_id;
-- callers must not attempt to route around this by querying tickets
-- directly for the returned attendee_id (lib/server/registration.ts
-- deliberately never exposes attendee_id to the browser either).
-- ---------------------------------------------------------------------

create type registration_result as (
  attendee_id uuid,
  ticket_id uuid,
  public_token text,
  already_registered boolean
);

create function register_attendee(
  p_event_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_company text,
  p_position text,
  p_consent_version text,
  p_consent_text text
) returns registration_result as $$
declare
  v_event events%rowtype;
  v_normalized_email text := lower(trim(p_email));
  v_existing_attendee_id uuid;
  v_consent_id uuid;
  v_attendee_id uuid;
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

  select a.id into v_existing_attendee_id
    from attendees a
    where a.event_id = p_event_id and a.normalized_email = v_normalized_email;

  if found then
    -- Never return the existing ticket's public_token here — see the
    -- SECURITY note on this function. ticket_id and public_token are
    -- both null; only already_registered=true distinguishes this from
    -- a fresh registration.
    return (v_existing_attendee_id, null, null, true)::registration_result;
  end if;

  if v_event.capacity is not null then
    select count(*) into v_count from attendees where event_id = p_event_id;
    if v_count >= v_event.capacity then
      raise exception 'CAPACITY_REACHED';
    end if;
  end if;

  insert into registration_consents (version, text_snapshot)
    values (p_consent_version, p_consent_text)
    returning id into v_consent_id;

  insert into attendees (event_id, first_name, last_name, email, company, position, consent_id)
    values (p_event_id, trim(p_first_name), trim(p_last_name), p_email, nullif(trim(p_company), ''), nullif(trim(p_position), ''), v_consent_id)
    returning id into v_attendee_id;

  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_token := replace(v_token, chr(10), '');

  insert into tickets (event_id, attendee_id, public_token)
    values (p_event_id, v_attendee_id, v_token)
    returning id into v_ticket_id;

  return (v_attendee_id, v_ticket_id, v_token, false)::registration_result;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- Function execution grants.
--
-- register_attendee and perform_checkin are SECURITY DEFINER and would
-- otherwise be callable directly via PostgREST's /rpc/ endpoint by any
-- holder of the anon/authenticated key, bypassing this app's rate
-- limiting and validation. They are restricted to service_role, which
-- only server-side code (lib/server/*) holds.
-- ---------------------------------------------------------------------

revoke execute on function register_attendee from public, anon, authenticated;
revoke execute on function perform_checkin from public, anon, authenticated;
revoke execute on function create_organization_with_owner from public, anon;

grant execute on function register_attendee to service_role;
grant execute on function perform_checkin to service_role;
grant execute on function create_organization_with_owner to authenticated;
grant execute on function is_org_member to authenticated;
grant execute on function is_org_admin to authenticated;
