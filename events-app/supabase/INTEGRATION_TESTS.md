# Integration test checklist (run against a real Supabase project)

**Status: not yet executed.** Everything in `ARCHITECTURE.md` and this
app's Vitest suite (`npm test`) describes and unit-tests the *intended*
behavior of the schema and RPC functions in
`supabase/migrations/0001_init.sql` against a **mocked** Supabase
client — none of it has been run against a real Postgres instance. Do
not treat the database security/integrity model as verified — only as
designed and reasoned about — until every item below has actually been
run against a live (or local, via `supabase start`) project and passed.
Check items off (`[x]`) as you confirm them, and note the project/date.

This complements, not replaces, `npm test`: the Vitest suite covers
this app's TypeScript logic; this checklist covers the properties that
only the database itself can actually guarantee (RLS, constraints,
triggers, locking).

## Setup

- [ ] Fresh Supabase project (or `supabase start` locally) with
      `supabase db push` (or the SQL editor) applying
      `0001_init.sql` cleanly, no errors.
- [ ] Two organizations, A and B, each provisioned by calling
      `create_organization_with_owner(p_name, p_slug, p_owner_user_id)`
      **as service_role** (the Supabase SQL editor's default connection,
      or any call authenticated with the service-role key — not the
      anon/authenticated key) with a distinct signed-up auth user's id
      as `p_owner_user_id` for each.
- [ ] In org A: one ADMIN user, one CHECKIN_STAFF user (insert rows
      into `organization_users` directly, or through a future invite
      flow).
- [ ] One `PUBLISHED` event in org A ("Event A"), one in org B
      ("Event B").

## 1. RLS cross-tenant isolation

Using the Supabase client authenticated as org A's OWNER (anon key +
that user's JWT — *not* the service role key):

- [ ] `select * from events` returns Event A but **not** Event B.
- [ ] `select * from organizations` returns org A but **not** org B.
- [ ] `select * from organization_users` returns org A's membership
      rows but **not** org B's.
- [ ] After registering a test attendee for Event B directly (e.g. via
      the service-role client, simulating a real registration),
      `select * from attendees where event_id = '<event B id>'` as
      org A's OWNER returns **zero rows** (blocked by RLS via the
      `attendees_select` policy's join to `events`/`is_org_member`).
- [ ] Same check for `tickets` and `checkins` scoped to Event B.
- [ ] Attempting `insert into events (...)` for org B's
      `organization_id` while authenticated as org A's OWNER is
      rejected (no `events_insert` policy match — `is_org_admin(org B)`
      is false for an org A user).

## 2. Organization roles

Authenticated as org A's CHECKIN_STAFF user:

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

Authenticated as org A's ADMIN user:

- [ ] Can create/edit Event A, and export its attendee CSV.
- [ ] Cannot read or act on anything scoped to org B (same checks as
      §1, repeated for ADMIN, not just OWNER).

## 3. `register_attendee`

Call directly via the **service-role** client (matching how
`lib/server/registration.ts` calls it) against Event A:

- [ ] A fresh email → `already_registered: false`, non-null
      `public_token` (43 chars, base64url alphabet only), a new row in
      `attendees` and `tickets`.
- [ ] The **same** email again → `already_registered: true`, and
      **`public_token` is `null`** and **`ticket_id` is `null`**. This
      is the fix for the ticket-token-disclosure finding — confirm it
      concretely against a real response, not just the mocked unit
      test.
- [ ] Registering against a `DRAFT` event → raises `EVENT_NOT_FOUND`
      is wrong here, should be `EVENT_NOT_PUBLISHED` (confirm the
      actual exception message).
- [ ] Registering against an event with `registration_deadline` in the
      past → `REGISTRATION_CLOSED`.
- [ ] Registering against a random nonexistent `event_id` →
      `EVENT_NOT_FOUND`.
- [ ] Confirm `register_attendee` is **not** callable via
      `anon`/`authenticated` REST calls — `POST
      /rest/v1/rpc/register_attendee` with the anon key returns 401/403
      (grants are `service_role`-only).

## 4. Capacity race

- [ ] Set Event A's `capacity` to `1` with zero existing registrations.
- [ ] Fire two `register_attendee` calls **concurrently** (two parallel
      requests/connections, two different emails — e.g. two `psql`
      sessions each running `select register_attendee(...)` at the
      same time, or two parallel `curl`/script invocations hitting the
      registration endpoint).
- [ ] Exactly one succeeds (`already_registered: false`, a ticket
      created); the other raises `CAPACITY_REACHED`.
- [ ] `select count(*) from attendees where event_id = '<event A id>'`
      equals exactly `1` afterward — never `2`. This is what the `for
      update` lock on the event row inside `register_attendee` is
      supposed to guarantee; confirm it actually does under real
      concurrent connections, not just sequential calls.

## 5. `perform_checkin`

- [ ] First check-in for a valid, unrevoked ticket → `was_created:
      true`, a new `checkins` row, `checkins.event_id` equal to that
      ticket's `tickets.event_id`.
- [ ] Calling `perform_checkin` again for the same ticket → `was_created:
      false`, returns the **original** `checkin_id`/`checked_in_at`
      (not a new row).
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
      `anon`/`authenticated` REST calls, same as `register_attendee`.

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

## 9. Organization provisioning is locked to service_role

See `ARCHITECTURE.md` §7a — this closes what was previously documented
there as a residual gap; these are the checks that prove it's actually
closed, not just described as closed:

- [ ] **anon cannot create an organization.** `POST
      /rest/v1/organizations` with the anon key (no session) →
      rejected (no insert policy exists for `anon`, and RLS is enabled
      with no policy means deny).
- [ ] **An authenticated user cannot `INSERT` into `organizations`
      directly**, PostgREST or a Supabase client alike — `insert into
      organizations (...)` as a signed-in user with no matching policy
      → rejected. (There is deliberately no `organizations_insert`
      policy for any role at all, not even a narrowed one.)
- [ ] **An authenticated user cannot invoke
      `create_organization_with_owner`.** `POST
      /rest/v1/rpc/create_organization_with_owner` with a signed-in
      user's JWT (anon key + their session, not the service-role key)
      → rejected outright (`EXECUTE` is revoked from
      `anon`/`authenticated`; PostgREST returns a permission error
      before the function body ever runs).
- [ ] **An authenticated user cannot self-assign `OWNER`.** With no
      path to create an organization row at all, there is also no path
      to an `organization_users` row for one — confirm directly:
      `insert into organization_users (organization_id, user_id, role)
      values (<any org>, auth.uid(), 'OWNER')` as a signed-in
      non-admin user → rejected (`organization_users_insert` requires
      `is_org_admin`, which is false for a user with no existing
      membership in that org).
- [ ] **service_role can provision an organization and its initial
      OWNER.** Calling `create_organization_with_owner('Org Name',
      'org-slug', '<real auth.users id>')` as service_role → succeeds,
      returns the new `organizations` row, and creates exactly one
      `organization_users` row for that id with `role = 'OWNER'`.
- [ ] Calling it with a `p_owner_user_id` that doesn't exist in
      `auth.users` → raises `OWNER_USER_NOT_FOUND` (not a raw foreign-key
      constraint error, and no organization row left behind — confirm
      the `organizations` insert this function does earlier in its body
      doesn't leave an orphaned org: the whole call is one transaction,
      so it should roll back completely).
- [ ] **The new OWNER can subsequently access that organization** —
      sign in as the user named in `p_owner_user_id` above, confirm
      `/dashboard` shows the organization (not the invite-only
      onboarding page), and that they can read/manage events per the
      normal OWNER permissions (§2 above).
- [ ] **Cross-tenant isolation still works** after provisioning through
      this new path — repeat the relevant checks from §1 (RLS
      cross-tenant isolation) using an organization created via
      `create_organization_with_owner` rather than direct insert, to
      confirm the provisioning path doesn't produce rows that somehow
      bypass the same RLS policies every other organization is subject
      to.
- [ ] A signed-in user with no organization membership visits
      `/dashboard` (or any `/dashboard/*` route) → lands on
      `/dashboard/onboarding`, sees the localized invite-only message
      (in their platform locale), and is offered no form or other way
      to create an organization from the UI.

## 10. Internationalization (uk/en)

See `ARCHITECTURE.md` §12.

- [ ] Creating an event with `event_language='uk'` and no `name_en`
      succeeds; the same with no `name_uk` fails
      (`events_name_matches_language`).
- [ ] Same for `event_language='en'` (requires `name_en`, not `name_uk`).
- [ ] Creating a `event_language='bilingual'` event with only one of
      `name_uk`/`name_en` set fails; with both set, succeeds.
- [ ] `register_attendee` against a `uk` event with `p_language='en'`
      raises `INVALID_LANGUAGE`; against a `bilingual` event, both
      `'uk'` and `'en'` succeed.
- [ ] After a successful registration, `attendees.preferred_language`
      and `registration_consents.language` both equal the `p_language`
      passed in.
- [ ] Register the same email twice in different languages against a
      bilingual event (`p_language='uk'` then `'en'`) — confirm the
      second call reports `already_registered=true` (language doesn't
      bypass the one-registration-per-email-per-event rule) and, as
      always, returns no token.
