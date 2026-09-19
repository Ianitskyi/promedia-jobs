# Integration test checklist (run against a real Supabase project)

**Status: mostly not yet executed against the real target project.**
Everything in `docs/ARCHITECTURE_V2.md` and this app's Vitest suite
(`npm test`) describes and unit-tests the *intended* behavior of the
schema and RPC functions against a **mocked** Supabase client. Do not
treat the database security/integrity model as verified for *your*
project — only as designed and reasoned about — until every item below
has actually been run against your live (or local, via `supabase
start`) project and passed. Check items off (`[x]`) as you confirm
them, and note the project/date.

**Exception — §3's concurrency scenario, §9's cross-workspace
referential-integrity scenario, and the migration's atomicity, marked
`[x]` below**: these were actually executed, in this review, against a
real local PostgreSQL 16 instance (`0001_init.sql` then
`0002_platform_refactor.sql` applied via `psql -v ON_ERROR_STOP=1`,
with `auth.users`/`auth.uid()`/the `anon`/`authenticated`/`service_role`
roles stubbed to the minimum needed for the schema to apply — not a
full Supabase environment). This is real evidence, not a mocked
Vitest assertion — but it is still **not** a substitute for running
this checklist against your actual Supabase project, which has its own
Postgres version/extensions and real RLS/auth wiring that a stub
cannot reproduce. Every other item below is still genuinely unexecuted
and must be run against your project before you rely on it.

This complements, not replaces, `npm test`: the Vitest suite covers
this app's TypeScript logic; this checklist covers the properties that
only the database itself can actually guarantee (RLS, constraints,
triggers, locking).

## Setup

- [ ] Fresh Supabase project (or `supabase start` locally) with
      `supabase db push` (or the SQL editor) applying `0001_init.sql`
      then `0002_platform_refactor.sql`, in that order, cleanly, no
      errors.
- [ ] Two workspaces, A and B, each provisioned by calling
      `create_workspace_with_owner(p_name, p_slug, p_owner_user_id)`
      **as service_role** (the Supabase SQL editor's default connection,
      or any call authenticated with the service-role key — not the
      anon/authenticated key) with a distinct signed-up auth user's id
      as `p_owner_user_id` for each.
- [ ] In workspace A: one ADMIN user, one CHECKIN_STAFF user (insert
      rows into `workspace_members` directly, or through a future
      invite flow).
- [ ] One `PUBLISHED` event in workspace A ("Event A"), one in
      workspace B ("Event B").

## 1. RLS cross-tenant isolation

Using the Supabase client authenticated as workspace A's OWNER (anon
key + that user's JWT — *not* the service role key):

- [ ] `select * from events` returns Event A but **not** Event B.
- [ ] `select * from workspaces` returns workspace A but **not**
      workspace B.
- [ ] `select * from workspace_members` returns workspace A's
      membership rows but **not** workspace B's.
- [ ] After registering a test person for Event B directly (e.g. via
      the service-role client, simulating a real registration),
      `select * from registrations where event_id = '<event B id>'` as
      workspace A's OWNER returns **zero rows** (blocked by RLS via the
      `registrations_select` policy).
- [ ] `select * from people where workspace_id = '<workspace B id>'` as
      workspace A's OWNER returns **zero rows** — **cross-tenant Person
      access denied**, the core CRM-layer isolation guarantee this
      refactor introduces (brief §2/§10).
- [ ] `select * from crm_organizations where workspace_id = '<workspace
      B id>'` as workspace A's OWNER returns **zero rows** —
      **cross-tenant (CRM) Organization access denied**.
- [ ] `select * from activities where workspace_id = '<workspace B
      id>'` as workspace A's OWNER returns **zero rows**.
- [ ] Same check for `tickets` and `checkins` scoped to Event B.
- [ ] Attempting `insert into events (...)` for workspace B's
      `workspace_id` while authenticated as workspace A's OWNER is
      rejected (no `events_insert` policy match — `is_workspace_admin`
      for workspace B is false for a workspace A user).
- [ ] Attempting `insert into people (workspace_id, ...)` for workspace
      B's id while authenticated as workspace A's ADMIN is rejected —
      confirms the CRM core is exactly as tenant-isolated as the
      Events tables it sits under, not a weaker backstop.

## 2. Workspace roles

Authenticated as workspace A's CHECKIN_STAFF user:

- [ ] `POST /api/checkin` for Event A succeeds (role allows `checkIn`).
- [ ] Navigating to `/dashboard/events/<event A id>/edit` redirects
      away (does not render the form) — `requirePermission(...,
      "manageEvents")` denies CHECKIN_STAFF.
- [ ] Submitting the `updateEvent` server action directly for Event A
      is rejected even if the edit page were somehow reached.
- [ ] `GET /api/events/<event A id>/export` is rejected (403) —
      `can(role, "exportAttendees")` is false for CHECKIN_STAFF.
- [ ] `GET /api/events/<event A id>/attendees?q=...` (manual check-in
      search) succeeds — search is part of `checkIn`.

Authenticated as workspace A's ADMIN user:

- [ ] Can create/edit Event A, and export its attendee CSV.
- [ ] Can insert/update `people` and `crm_organizations` rows scoped
      to workspace A (the RLS policies added in
      `0002_platform_refactor.sql` allow this even with no UI yet).
- [ ] Cannot read or act on anything scoped to workspace B (same
      checks as §1, repeated for ADMIN, not just OWNER).

## 3. `register_for_event`

Call directly via the **service-role** client (matching how
`lib/server/registration.ts` calls it) against Event A:

- [ ] A fresh email → `already_registered: false`, non-null
      `public_token` (43 chars, base64url alphabet only), a new row in
      `people`, `registrations`, and `tickets`.
- [ ] **Person creation on first registration**: confirm exactly one
      new `people` row was created, with `workspace_id` equal to
      workspace A's id and `normalized_email` equal to the lowercased,
      trimmed email.
- [ ] **Reuse of Person for a second event in the same workspace**:
      register the *same* email for a *different* `PUBLISHED` event in
      workspace A ("Event A2"). Confirm **no new `people` row** was
      created (`select count(*) from people where workspace_id =
      '<workspace A id>' and normalized_email = '<email>'` is still
      `1`), and the new `registrations` row's `person_id` equals the
      original person's id.
- [ ] **The same email may exist independently in another workspace**:
      register that identical email for Event B (workspace B). Confirm
      a *separate* `people` row is created, scoped to workspace B, with
      a *different* `id` than workspace A's person for that email —
      the two never merge or share a row. This is the tenant-boundary
      guarantee from brief §2: `people_workspace_email_idx` is
      `(workspace_id, normalized_email)`, not a bare email index.
- [ ] **Registration belongs to the correct Person/Event/Workspace**:
      for each registration created above, confirm
      `registrations.workspace_id` matches the event's own
      `workspace_id` (not just "some workspace"), and
      `registrations.person_id`/`event_id` point at the expected rows.
- [ ] The same email again for the *same* event → `already_registered:
      true`, and **`public_token` is `null`** and **`ticket_id` is
      `null`**. This is the fix for the ticket-token-disclosure finding
      — confirm it concretely against a real response, not just the
      mocked unit test.
- [ ] Registering against a `DRAFT` event → raises `EVENT_NOT_FOUND` is
      wrong here, should be `EVENT_NOT_PUBLISHED` (confirm the actual
      exception message).
- [ ] Registering against an event with `registration_deadline` in the
      past → `REGISTRATION_CLOSED`.
- [ ] Registering against a random nonexistent `event_id` →
      `EVENT_NOT_FOUND`.
- [ ] Confirm `register_for_event` is **not** callable via
      `anon`/`authenticated` REST calls — `POST
      /rest/v1/rpc/register_for_event` with the anon key returns
      401/403 (grants are `service_role`-only).
- [ ] After a successful fresh registration, `select * from activities
      where person_id = '<person id>' and activity_type =
      'event_registered'` returns exactly one row, with `subject_id`
      equal to the event's id.

- [x] **CONCURRENCY — same workspace, same email, simultaneous
      registrations for two different events.** This is the scenario
      the pre-fix `register_for_event` got wrong: its person
      find-or-create was a plain `SELECT`, then `INSERT` if not found,
      and the `for update` lock on the event row only serializes
      registrations for *that one event* — it does nothing for two
      concurrent calls targeting two *different* events, so both could
      observe "no person yet" and race to `INSERT`, and the loser would
      fail outright with a `people(workspace_id, normalized_email)`
      unique violation instead of the registration just succeeding.
      **Verified in this review**, against a real local Postgres 16:
      fired 40 concurrent `register_for_event` calls (20 pairs — one
      call per pair against each of two distinct `PUBLISHED` events in
      the same workspace, launched together as background processes)
      with the identical email and no pre-existing person. Result: zero
      errors across all 40 calls; `people` held exactly **one** row for
      that `(workspace_id, normalized_email)`; `registrations` held
      exactly one row per event (two total) pointing at that same
      person. As a control, the *original* `SELECT`-then-`INSERT`
      pattern was reproduced in isolation (with an injected delay to
      widen the race window) and reliably failed 4 times out of 5 with
      exactly the predicted `duplicate key value violates unique
      constraint "people_workspace_id_normalized_email_key"` error —
      confirming both that the bug was real and that the `insert ...
      on conflict (workspace_id, normalized_email) do nothing
      returning` fix in the current `register_for_event` (see
      `0002_platform_refactor.sql`) actually closes it, rather than
      merely narrowing the race window. To re-run this yourself against
      your own project: fire N concurrent calls (`Promise.all` against
      the service-role RPC, or parallel `psql` sessions) with the same
      email against two different `PUBLISHED` events in the same
      workspace and confirm `select count(*) from people where
      workspace_id = '<id>' and normalized_email = '<email>'` is
      exactly `1` afterward, with no errors from any call.

## 4. Capacity race

- [ ] Set Event A's `capacity` to `1` with zero existing registrations.
- [ ] Fire two `register_for_event` calls **concurrently** (two
      parallel requests/connections, two different emails — e.g. two
      `psql` sessions each running `select register_for_event(...)` at
      the same time, or two parallel `curl`/script invocations hitting
      the registration endpoint).
- [ ] Exactly one succeeds (`already_registered: false`, a ticket
      created); the other raises `CAPACITY_REACHED`.
- [ ] `select count(*) from registrations where event_id = '<event A
      id>'` equals exactly `1` afterward — never `2`. This is what the
      `for update` lock on the event row inside `register_for_event` is
      supposed to guarantee; confirm it actually does under real
      concurrent connections, not just sequential calls.

## 5. `perform_checkin`

- [ ] First check-in for a valid, unrevoked ticket → `was_created:
      true`, a new `checkins` row, `checkins.event_id` equal to that
      ticket's `tickets.event_id`, and a new `activities` row
      (`activity_type = 'event_checked_in'`) for the ticket's
      registration's person.
- [ ] Calling `perform_checkin` again for the same ticket → `was_created:
      false`, returns the **original** `checkin_id`/`checked_in_at`
      (not a new row), and **no additional** `activities` row is
      created (confirm the count for that person/activity_type stays
      at `1`, not `2`).
- [ ] Call `perform_checkin` with a `p_event_id` that does **not**
      match the ticket's real `event_id` → raises `EVENT_MISMATCH`, and
      no `checkins` row is created.
- [ ] Attempt a raw `insert into checkins (ticket_id, event_id, method)
      values (<ticket A's id>, <event B's id>, 'MANUAL')` directly
      (service role, bypassing `perform_checkin` entirely) → the
      `checkins_event_matches_ticket` trigger raises an exception and
      the insert is rejected. This is the actual database-level
      invariant from the fix for the event/ticket-consistency finding
      — confirm it holds even when `perform_checkin` is bypassed
      entirely, not just when called normally.
- [ ] Confirm `perform_checkin` is **not** callable via
      `anon`/`authenticated` REST calls, same as `register_for_event`.

## 6. Simultaneous duplicate scan (the concurrency guarantee)

- [ ] Create one ticket for Event A.
- [ ] Fire two `perform_checkin` calls for that **same ticket**
      **concurrently** (two parallel connections at the same instant —
      this is the two-phones-scanning-at-once scenario).
- [ ] `select count(*) from checkins where ticket_id = '<ticket id>'`
      equals exactly `1` afterward — never `2`.
- [ ] Exactly one of the two calls returned `was_created: true`; the
      other returned `was_created: false` with the **same**
      `checked_in_at` as the winning call (both calls should report an
      identical timestamp — the one from whichever insert actually
      won).
- [ ] Repeat with 10+ concurrent calls (not just 2) to raise confidence
      under higher contention.

## 7. Wrong-event ticket

- [ ] Create a ticket for Event A. Call
      `checkInByToken`/`POST /api/checkin` with that ticket's token but
      Event B's `eventId`.
- [ ] Result is `WRONG_EVENT`; no `checkins` row is created; `perform_checkin`
      is never even called (confirm via logs/mocking at the app layer,
      already covered by the Vitest suite — this step is about
      confirming the *ticket lookup* behind it returns the real
      `tickets.event_id` from the database, matching what the unit test
      assumes).

## 8. Revoked ticket

- [ ] Set `tickets.revoked_at` to now for a ticket.
- [ ] `POST /api/checkin` for that ticket → `TICKET_REVOKED`; no
      `checkins` row created.

## 9. Workspace provisioning is locked to service_role

See `docs/ARCHITECTURE_V2.md` §9 — this closes what is documented there
as a residual gap; these are the checks that prove it's actually
closed, not just described as closed:

- [ ] **anon cannot create a workspace.** `POST /rest/v1/workspaces`
      with the anon key (no session) → rejected (no insert policy
      exists for `anon`, and RLS is enabled with no policy means deny).
- [ ] **An authenticated user cannot `INSERT` into `workspaces`
      directly**, PostgREST or a Supabase client alike — `insert into
      workspaces (...)` as a signed-in user with no matching policy →
      rejected. (There is deliberately no `workspaces_insert` policy
      for any role at all, not even a narrowed one.)
- [ ] **An authenticated user cannot invoke
      `create_workspace_with_owner`.** `POST
      /rest/v1/rpc/create_workspace_with_owner` with a signed-in user's
      JWT (anon key + their session, not the service-role key) →
      rejected outright (`EXECUTE` is revoked from
      `anon`/`authenticated`; PostgREST returns a permission error
      before the function body ever runs).
- [ ] **An authenticated user cannot self-assign `OWNER`.** With no
      path to create a workspace row at all, there is also no path to
      a `workspace_members` row for one — confirm directly: `insert
      into workspace_members (workspace_id, user_id, role) values
      (<any workspace>, auth.uid(), 'OWNER')` as a signed-in non-admin
      user → rejected (`workspace_members_insert` requires
      `is_workspace_admin`, which is false for a user with no existing
      membership in that workspace).
- [ ] **service_role can provision a workspace and its initial
      OWNER.** Calling `create_workspace_with_owner('Workspace Name',
      'workspace-slug', '<real auth.users id>')` as service_role →
      succeeds, returns the new `workspaces` row, and creates exactly
      one `workspace_members` row for that id with `role = 'OWNER'`.
- [ ] Calling it with a `p_owner_user_id` that doesn't exist in
      `auth.users` → raises `OWNER_USER_NOT_FOUND` (not a raw foreign-key
      constraint error, and no workspace row left behind — confirm the
      `workspaces` insert this function does earlier in its body
      doesn't leave an orphaned workspace: the whole call is one
      transaction, so it should roll back completely).
- [ ] **The new OWNER can subsequently access that workspace** — sign
      in as the user named in `p_owner_user_id` above, confirm
      `/dashboard` shows the workspace (not the invite-only onboarding
      page), and that they can read/manage events per the normal OWNER
      permissions (§2 above).
- [ ] **Cross-tenant isolation still works** after provisioning through
      this new path — repeat the relevant checks from §1 (RLS
      cross-tenant isolation) using a workspace created via
      `create_workspace_with_owner` rather than direct insert, to
      confirm the provisioning path doesn't produce rows that somehow
      bypass the same RLS policies every other workspace is subject to.
- [ ] A signed-in user with no workspace membership visits `/dashboard`
      (or any `/dashboard/*` route) → lands on `/dashboard/onboarding`,
      sees the localized invite-only message (in their platform
      locale), and is offered no form or other way to create a
      workspace from the UI.

## 10. Internationalization (uk/en)

See `docs/ARCHITECTURE_V2.md` §10.

- [ ] Creating an event with `event_language='uk'` and no `name_en`
      succeeds; the same with no `name_uk` fails
      (`events_name_matches_language`).
- [ ] Same for `event_language='en'` (requires `name_en`, not `name_uk`).
- [ ] Creating a `event_language='bilingual'` event with only one of
      `name_uk`/`name_en` set fails; with both set, succeeds.
- [ ] `register_for_event` against a `uk` event with `p_language='en'`
      raises `INVALID_LANGUAGE`; against a `bilingual` event, both
      `'uk'` and `'en'` succeed.
- [ ] After a successful registration, `people.preferred_language` and
      `consents.language` both equal the `p_language` passed in — for a
      *newly created* person. For a *reused* person (see §3), confirm
      `people.preferred_language` is **not** overwritten by a later
      registration in a different language (the find-or-create path
      never updates an existing person's stored fields — brief §2).
- [ ] Register the same email twice in different languages against a
      bilingual event (`p_language='uk'` then `'en'`) — confirm the
      second call reports `already_registered=true` (language doesn't
      bypass the one-registration-per-person-per-event rule) and, as
      always, returns no token.

## 11. CRM core (people, crm_organizations, activities, consents)

New in `0002_platform_refactor.sql` — see `docs/ARCHITECTURE_V2.md`
§2-§7 for what each table is for.

- [ ] `people.normalized_email` is generated (lowercase, trimmed) and
      the `unique (workspace_id, normalized_email)` constraint actually
      rejects a duplicate: `insert into people (workspace_id,
      first_name, last_name, email) values ('<workspace A id>', 'A',
      'B', 'Same@Example.com')` twice → the second insert fails with a
      unique-violation, even though the casing/whitespace differs from
      the first.
- [ ] `consents.workspace_id`/`consents.person_id` are populated for
      every consent `register_for_event` creates (not left null) — the
      migration only leaves them null for a legacy pre-refactor
      consent row with no matching attendee, which should not exist in
      a fresh project.
- [ ] `activities.subject_type`/`subject_id` for an `event_registered`
      row are `'event'` and the event's id, respectively — confirm the
      loose polymorphic reference actually points at a real row today,
      even though the database can't enforce that with a foreign key
      (see the schema comment in `0002_platform_refactor.sql`).
- [ ] `person_organization_relationships` and `crm_organizations` are
      installed with working RLS (per §1/§2 above) but have zero rows
      in a fresh Events-only workspace — confirming they are dormant
      architecture, not something the Events module silently populates
      today.

## 12. Cross-workspace referential integrity (composite foreign keys)

RLS (§1) stops a workspace-A client from *reading* workspace-B rows.
It does **not**, on its own, stop any writer — including a
**service-role connection, which bypasses RLS entirely** — from
*inserting* a row that names workspace_id = A while the person/event/
organization it actually references belongs to workspace B. That gap
is closed at the schema level in `0002_platform_refactor.sql` with
composite foreign keys (`foreign key (x_id, workspace_id) references
x(id, workspace_id)`) on every CRM-core relationship, rather than left
to application code or RLS to get right. See the "WORKSPACE
CONSISTENCY" comments next to each table in that migration.

**Every item below was verified in this review**, as the service-role
-equivalent connection (a Postgres superuser, which — like
`service_role` — is not subject to RLS at all) against a real local
Postgres 16 instance running the actual, unmodified
`0002_platform_refactor.sql`. Each negative case below was confirmed
to fail with a `foreign key constraint` violation (not merely "assumed
to fail because the DDL looks right"); each positive control case was
confirmed to succeed. Re-run these yourself against your project (as
service_role, specifically, not just as an RLS-restricted user — the
whole point is that this holds even when RLS is bypassed) as part of
applying this migration:

- [x] `registrations`: inserting a row with `workspace_id = A` but
      `event_id` belonging to workspace B → rejected
      (`registrations_event_id_workspace_id_fkey`).
- [x] `registrations`: `workspace_id = A`, a valid `event_id` in A, but
      `person_id` belonging to workspace B → rejected
      (`registrations_person_id_workspace_id_fkey`).
- [x] `registrations`: `workspace_id = B` while both `event_id` and
      `person_id` actually belong to workspace A → rejected (fails the
      same `event_id`/`workspace_id` composite check, since no
      workspace-B event has that id).
- [x] `registrations`: a fully self-consistent row (workspace,
      event, and person all agree) → succeeds.
- [x] `person_organization_relationships`: `workspace_id = A` with a
      `person_id` belonging to workspace B → rejected
      (`..._person_id_workspace_id_fkey`). A fully consistent row
      succeeds.
- [x] `consents`: `workspace_id = A` with a `person_id` belonging to
      workspace B → rejected (`consents_person_workspace_fkey`).
- [x] `activities`: `workspace_id = A` with a `person_id` belonging to
      workspace B → rejected (`activities_person_id_workspace_id_fkey`).
- [x] **Ticket ↔ Registration ↔ Event consistency**: a ticket whose
      `event_id` does not match its own `registration_id`'s actual
      `event_id` → rejected (`tickets_registration_id_fkey`, now a
      composite `(registration_id, event_id) references
      registrations(id, event_id)` rather than a plain
      `references registrations(id)`). A ticket whose `event_id` does
      match → succeeds. This is a genuinely new guarantee this review
      added — the pre-existing `checkins_event_matches_ticket` trigger
      only ever checked `checkins` against `tickets`; nothing
      previously stopped a *ticket* itself from naming a registration
      that actually belonged to a different event.
- [x] **The pre-existing check-in invariant is preserved**: inserting a
      `checkins` row whose `event_id` doesn't match its ticket's own
      `event_id` still fails via `enforce_checkin_event_matches_ticket`
      (this trigger was not touched by this review — reconfirmed
      working, not just assumed).
- [x] **Migration atomicity**: applying an intentionally-broken copy of
      `0002_platform_refactor.sql` (an injected error near the end of
      STEP 5, after most of the schema work had already run) against a
      database that had only `0001_init.sql` applied resulted in a
      clean, total rollback — `\dt` afterward showed the tenant table
      still named `organizations` (not `workspaces`), and none of
      `people`/`crm_organizations`/`registrations`/`activities`
      existed. The real, unmodified migration file was then applied to
      that same untouched database and completed successfully. This
      confirms the file's `begin; ... commit;` wrapping (added in this
      review) actually delivers "a failure cannot silently leave you
      believing the migration completed successfully" — a partial
      apply is not possible, by construction, not just by convention.
