# ProMedia Events — Architecture

## 1. What this is

ProMedia Events is a multi-tenant event registration and check-in platform.
Organizations create events, attendees register on a public page, each
registration gets a QR ticket, and staff check attendees in at the door
with a phone camera. Billing is out of scope for this MVP.

This app lives at `events-app/` inside the `promedia-jobs` repository. It
is a **separate product** from the static job-board site at the repo root
and is deployed as its own Vercel project (root directory `events-app/`).
Nothing here touches the job-board files.

## 2. Stack

- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind CSS 4
- Supabase (Postgres + Auth). `@supabase/ssr` for cookie-based sessions,
  `@supabase/supabase-js` for the service-role server client.
- `qrcode` for QR generation (server + client), `html5-qrcode` for
  camera-based scanning (browser only).
- `zod` for input validation at all trust boundaries.
- Vitest for unit tests.

No Docker, queues, Redis, or microservices. It deploys as a normal
Next.js app.

## 3. Tenancy model

```
Organization
  -> organization_users (membership + role)
  -> Events
      -> Attendees
      -> Tickets
      -> Check-ins
      -> Registration consents
```

Every tenant-owned table carries an `organization_id` (directly, or via
`event_id -> events.organization_id`). Tenant isolation is enforced at
**two layers**:

1. **Postgres Row Level Security** on every tenant table — the baseline,
   defense-in-depth layer. A user can only ever see rows for
   organizations they belong to, enforced by the database regardless of
   application bugs.
2. **Application-level authorization** in server actions / route
   handlers — checks the caller's role (`OWNER`/`ADMIN`/`CHECKIN_STAFF`)
   before allowing role-gated actions (editing events, exporting CSV).
   RLS alone can't cleanly express "read yes, but only ADMIN may export",
   so that distinction lives in code, backed by a server-side role
   lookup that itself goes through RLS.

Two request paths intentionally bypass RLS with the **service-role**
client, because they are unauthenticated by design and must not leak
tenant data through error messages or timing:

- Public registration (`/e/[slug]` submit) — anonymous, needs to insert
  an attendee/ticket without a logged-in session.
- Ticket validation & check-in (`/t/[token]`, scanner, kiosk) — the
  caller is identified by an unguessable token, not a session.

Every service-role code path lives in `lib/server/` and re-validates
tenant/event scoping explicitly in the query (never "trust the token,
skip the WHERE clause").

## 4. Database schema (summary)

See `supabase/migrations/0001_init.sql` for the full DDL. Tables:

- `organizations` — tenant root. `slug`, branding fields.
- `organization_users` — membership + `role` enum. `unique(organization_id, user_id)`.
- `events` — belongs to one organization. `slug` is globally unique (it's
  the public URL segment). `status` enum drives visibility.
- `attendees` — belongs to one event. `unique(event_id, normalized_email)`
  prevents duplicate registrations. `normalized_email` is a generated
  column (`lower(trim(email))`) so the uniqueness check is
  case/whitespace insensitive without relying on application code.
- `registration_consents` — one row per attendee, stores the consent
  text version and a snapshot of the exact text shown, for audit.
- `tickets` — one per attendee (`unique(attendee_id)`). `public_token` is
  the only externally-exposed identifier; it carries no attendee data.
- `checkins` — `unique(ticket_id)` is the concurrency control: at most
  one check-in per ticket can ever exist, enforced by Postgres, not by
  application logic.

All tables use UUID primary keys (`gen_random_uuid()`), `created_at`, and
`updated_at` (via a shared trigger) where mutation happens after insert.

## 5. Ticket tokens

`public_token` is generated inside the `register_attendee` Postgres
function using `pgcrypto`'s `gen_random_bytes(32)` (256 bits,
OS-CSPRNG-backed), base64url-encoded, in the same transaction that
creates the attendee — this is what makes registration+ticket creation
atomic without a round trip back to the app between the two inserts.
`lib/tokens.ts` holds the shared token-shape validation (used before
even querying the database on `/t/[token]`) and is unit-tested for
format/entropy expectations. The token is:

- Non-sequential and unguessable (256 bits of entropy).
- The **only** thing encoded in the QR code, as
  `https://<host>/t/<token>`.
- Never derived from or containing the attendee's email, ID, or any
  registration number.

Lookups by token use an exact-match indexed query
(`unique` index on `tickets.public_token`); there is no prefix search or
enumeration surface.

## 6. Check-in concurrency

Two phones can scan the same ticket within milliseconds. Correctness
must not depend on read-then-write application logic (check-then-insert
races). Instead:

- `checkins.ticket_id` has a `UNIQUE` constraint.
- Check-in is performed by a single `INSERT ... ON CONFLICT (ticket_id)
  DO NOTHING RETURNING *`, wrapped in a Postgres function
  (`perform_checkin`, `SECURITY DEFINER`) so the same guarantee holds
  whether the call comes from the scanner, manual check-in, or kiosk.
- If the insert returns a row, this call performed the first check-in.
  If it returns nothing, another concurrent request already won — the
  caller re-selects the existing check-in and reports "already checked
  in" with its original timestamp.

This makes the "only one first check-in" guarantee a database invariant,
not a convention every call site has to remember to honor.

## 7. Authentication & roles

Supabase Auth (email/password) issues the session; `@supabase/ssr`
stores it in cookies and a `middleware.ts` refreshes it on every request.
`organization_users.role` is one of `OWNER`, `ADMIN`, `CHECKIN_STAFF`,
checked via `requireRole()` in `lib/authz.ts`, which is a thin,
single-purpose helper so adding a role later is a one-line enum change
plus updating the permission table in that file — not a rewrite.

Permission summary:

| Action | OWNER | ADMIN | CHECKIN_STAFF |
|---|---|---|---|
| Create/edit events | ✅ | ✅ | ❌ |
| View attendees | ✅ | ✅ | ✅ (search only, via scanner UI) |
| Export CSV | ✅ | ✅ | ❌ |
| Scanner / manual check-in | ✅ | ✅ | ✅ |

## 8. Email

`lib/email/` defines an `EmailProvider` interface
(`send({ to, subject, html, text })`). Two implementations ship:

- `ConsoleEmailProvider` (default) — logs the email server-side. Safe
  default for local/dev without any provider account.
- `ResendEmailProvider` — calls Resend's HTTP API directly via `fetch`
  (no SDK dependency) when `RESEND_API_KEY` is set.

`getEmailProvider()` picks one based on env at call time, so swapping to
Postmark/SES/SMTP later means adding one more file that implements the
same interface — nothing else in the app changes.

## 9. QR ticket & scanner data flow

1. Registration → attendee + ticket + `public_token` created
   server-side.
2. Ticket page (`/t/[token]`) renders a QR of
   `https://<host>/t/<token>` using `qrcode`.
3. Scanner (browser camera, `html5-qrcode`) decodes the QR client-side
   into a string, extracts `<token>`, and does nothing else client-side.
4. The token is POSTed to `/api/checkin`, which is the **only** place
   that trusts it: looks up the ticket, verifies `event_id` matches the
   event the operator is scanning for, checks `revoked_at`, then calls
   `perform_checkin`.

The client never receives or infers anything about the ticket other than
the final status shown to the operator.

## 10. Security decisions worth calling out

- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) is read only in
  server-only files (`lib/server/*`, route handlers, server actions) and
  is never imported by any file under `app/**/page.tsx`'s client
  boundary or shipped to the browser. Next.js's server/client module
  boundary plus the `server-only` package enforce this at build time.
- All public-facing mutations (registration, check-in) validate input
  with `zod` before touching the database.
- Rate limiting: a minimal in-memory token-bucket per-IP limiter
  (`lib/rate-limit.ts`) guards the public registration and check-in
  endpoints against basic abuse. This is process-local (fine for a
  single Vercel/Node instance MVP) and documented as a known limitation
  for horizontal scaling — a durable store (Upstash Redis, etc.) is the
  natural upgrade and is intentionally not added now.
- Errors shown to attendees/operators are always mapped to a small set
  of known states (see §22 of the brief); raw exceptions/stack traces
  are logged server-side only.
- `register_attendee` and `perform_checkin` are `SECURITY DEFINER`
  Postgres functions; execution is revoked from `anon`/`authenticated`
  and granted only to `service_role`, so they cannot be invoked directly
  through PostgREST's `/rpc/` endpoint with a public API key — only
  server code holding the service-role key can call them, which is what
  keeps app-level rate limiting and validation in the loop.
- ID enumeration: organization and event **numeric** ordering isn't
  exposed anywhere; slugs are used in URLs, tokens are random. Listing
  endpoints are always scoped to the caller's organization.

## 11. What's deliberately not built yet

Per the brief: custom fields, paid tickets/Stripe, multiple ticket
types, wallet passes, custom domains, white-label portals, badge
printing, bulk import, waitlists, campaigns, analytics, webhooks/API,
integrations, offline sync, multi check-in sessions, billing. The schema
avoids decisions that would make these harder later (e.g., `tickets` is
already its own table separate from `attendees`, so multiple ticket
types per attendee is an additive change, not a rewrite).
