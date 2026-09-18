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
- [ ] Two organizations, A and B, each created via
      `create_organization_with_owner` (or direct insert) with a
      distinct signed-up auth user as OWNER of each.
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

## 9. Organization creation (residual gap from the review)

See `ARCHITECTURE.md` §7a. This isn't something to "pass" — it's
tracked here so it's re-verified as the mitigation evolves, not
forgotten:

- [ ] Confirm `create_organization_with_owner` **is** currently
      callable directly via `POST /rest/v1/rpc/create_organization_with_owner`
      with any authenticated user's JWT (not the service role key) —
      i.e. confirm the documented gap is real and matches the
      documentation, not narrower or wider than described.
- [ ] Confirm `ALLOW_SELF_SERVICE_ORG_CREATION=false` (the default)
      makes `/dashboard/onboarding` show the invite-only message and
      makes the `createOrganization` server action refuse, **without**
      changing the RPC-level exposure above (the app-level gate is not
      a database-level fix, by design — see §7a).
