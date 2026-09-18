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

### 5a. Duplicate registration never discloses the existing ticket

Registering again with an email already registered for the event is a
normal outcome (`unique(event_id, normalized_email)`), not an error —
but it must **never** hand back the existing ticket's `public_token`.
That token is a bearer credential: whoever has it can view the ticket
and, at the door, is indistinguishable from the real attendee. If
submitting a known email were enough to get the token back, knowing a
registered attendee's email would be enough to steal their ticket.

So `register_attendee` always returns `already_registered=true` with
`ticket_id`/`public_token` both `null`, `lib/server/registration.ts`
surfaces this as `{ ok: false, error: "ALREADY_REGISTERED" }` (a
sibling of the other registration errors, not a success variant that
happens to carry a token), and the registration form shows a neutral
"this email is already registered" message and does **not** redirect
anywhere — there is nothing to redirect to. A "resend my ticket by
email" flow is the correct way to help a legitimate attendee who lost
their ticket link, and the code is deliberately structured (a single
`registerAttendee()` entry point, a distinct error case) so that can be
added later as its own explicitly-invoked, always-emails-never-returns
function — not implemented in this pass, to avoid building a recovery
system nobody has asked for the shape of yet.

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

### 6a. A check-in's event_id can never disagree with its ticket's

`checkins.event_id` is denormalized (kept alongside `ticket_id`) purely
so per-event queries don't need a join. Denormalized data can drift, so
this is enforced twice, deliberately redundantly:

1. **`perform_checkin` derives `event_id` from the ticket row itself**
   (`select event_id from tickets where id = p_ticket_id`) rather than
   trusting the `p_event_id` argument for the value it stores — the
   ticket is the source of truth. `p_event_id` is still required and
   compared against it; a mismatch raises `EVENT_MISMATCH` rather than
   silently inserting a row with two different ideas of which event it
   belongs to.
2. **A `before insert or update on checkins` trigger**
   (`enforce_checkin_event_matches_ticket`) independently re-checks
   `new.event_id = tickets.event_id for new.ticket_id` and raises if
   they disagree. Postgres `CHECK` constraints can't reference another
   table, so a trigger is the mechanism for a genuine cross-table
   invariant here.

The trigger is the one that actually matters: it holds regardless of
which function or future code path writes to `checkins`, not just
`perform_checkin`. `lib/server/checkin.ts` also checks
`ticket.event_id === eventId` in TypeScript before ever calling
`perform_checkin`, and that's what produces the friendly `WRONG_EVENT`
scanner state — but that check alone was never the safety guarantee,
only the UX for the common case; the trigger is what makes it a
database-level invariant instead of something that depends on every
call site (this one, and any future one) getting the TypeScript right.

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

### 7a. Organization creation is currently a known, gated gap

`create_organization_with_owner` is `SECURITY DEFINER` and its
`EXECUTE` is granted to `authenticated` (see §3/§10) — **at the
database level, any signed-in user can currently call it directly and
bootstrap a new organization**, becoming its `OWNER`. It can't be
tightened the way `register_attendee`/`perform_checkin` are (grant
`EXECUTE` only to `service_role`), because the function reads
`auth.uid()` from the caller's own session to know who to make
`OWNER` — a `service_role` call carries no end-user session, so it
would have no `auth.uid()` to use. Properly closing this means
reworking the function to take an explicit target user id and be
invoked only by a trusted, authenticated-as-platform-admin server
path — that's the future platform-admin invitation model, and
deliberately not built in this pass.

For now, the only application path to this RPC —
`/dashboard/onboarding` and its `createOrganization` server action —
is gated behind `isSelfServiceOrgCreationEnabled()`
(`lib/config.ts`), reading `ALLOW_SELF_SERVICE_ORG_CREATION`, which
**defaults to off**. Both the onboarding page (which shows an
"invite-only" message instead of the form when off) and the action
itself (which refuses independently, since a server action is a
reachable endpoint regardless of what the page renders) check it.
This does not close the direct-RPC-call gap described above — it
only removes the ordinary way through this app to reach it, and
that residual gap is intentionally documented rather than hidden.

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

### 9a. Event date/time display always uses the event's own timezone

`events.start_date`/`start_time` are the wall-clock time the organizer
entered for `events.timezone` (§4) — there's no UTC conversion to undo
for display, but rendering them still needs a real timezone-database
lookup (weekday names, DST-adjacent instants), which an earlier version
of this code got wrong: it built `new Date(\`${date}T${time}\`)` — parsed
as local time in whatever zone the *server process* happens to run in —
and then merely appended `event.timezone` as a trailing label. The
digits displayed only looked right because parsing and formatting both
implicitly used the same ambient zone; the display never actually
depended on `event.timezone`, and it broke outright for a date exactly
at that ambient zone's DST transition.

Fixed by `lib/format-event-time.ts`'s `formatEventDateTime()`: it
round-trips through `zonedTimeToUtc()` (`lib/timezone.ts`, already used
for `registration_deadline`) and formats with `Intl.DateTimeFormat`'s
own `timeZone` option — both steps take `event.timezone` explicitly, so
the result is independent of where the code executes and is actually
derived from the configured zone rather than coincidentally matching
it. Used by the ticket page, the public registration page, and the
confirmation email. Unit-tested across `Europe/Kyiv`, `Europe/Berlin`,
and `America/New_York`, including a DST-boundary date, in
`lib/format-event-time.test.ts`.

Two related fixes in the same pass: `EventCard`'s dashboard list used
`new Date("YYYY-MM-DD")` (parsed as **UTC midnight** per spec) formatted
in the ambient local zone — a classic off-by-one-day bug in any
negative-UTC-offset zone, fixed by `formatCalendarDate()` formatting
explicitly in UTC to match how the date-only string was parsed. And the
event-edit form's registration-deadline field was pre-filled using the
*browser's* local timezone (`Date`'s local getters) while the form
submits that same field interpreted as being in the *event's* timezone
— silently shifting the stored deadline on any save where the editor's
browser zone differed from the event's, even without touching that
field. Fixed via `utcToZonedDatetimeLocal()` (`lib/timezone.ts`), the
inverse of `zonedTimeToUtc()`.

## 10. Security decisions worth calling out

- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) is read only in
  server-only files (`lib/server/*`, route handlers, server actions) and
  is never imported by any file under `app/**/page.tsx`'s client
  boundary or shipped to the browser. Next.js's server/client module
  boundary plus the `server-only` package enforce this at build time.
- All public-facing mutations (registration, check-in) validate input
  with `zod` before touching the database.
- Rate limiting: `lib/rate-limit.ts` defines a `RateLimiter` interface
  and one implementation, `InMemoryRateLimiter` — a per-key fixed-window
  counter guarding public registration and check-in against basic
  abuse. It is explicitly documented (in the file itself, not just
  here) as **development/single-instance protection only, not
  production-grade rate limiting**: it's a plain in-memory `Map`, so it
  doesn't share counts across multiple serverless instances, doesn't
  survive a restart, and offers no real protection once more than one
  instance is running — the normal case once deployed. Every call site
  goes through the interface (`checkRateLimit()`/`getRateLimiter()`),
  so swapping in a durable-store implementation (Upstash Redis or
  similar) before public launch means changing one assignment in that
  file, not touching any call site. Intentionally not added now — no
  paid dependency this MVP doesn't yet need.
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
- `create_organization_with_owner` does **not** get the same
  service-role-only grant as the two functions above (it can't — see
  §7a for why) and remains callable by any `authenticated` user at the
  database level. This is a known, documented residual gap, mitigated
  today only by gating the application's one path to it behind
  `ALLOW_SELF_SERVICE_ORG_CREATION` (default off), not eliminated.
- A duplicate registration never returns or exposes the existing
  ticket's `public_token` — see §5a. Returning it would let anyone who
  merely knows a registered attendee's email obtain their ticket.

## 12. Internationalization (Ukrainian / English)

Two independent things are localized, on purpose kept separate:

1. **Platform locale** — the organizer dashboard/auth interface
   language. Cookie `pm_locale`, default `uk`. Set explicitly via the
   `LanguageSwitcher` (UA | EN, visible on `/`, `/login`, and every
   `/dashboard/*` page), or, on a visitor's very first request (no
   cookie yet), inferred from the browser's `Accept-Language` header by
   `middleware.ts` → `lib/i18n/middleware.ts` → `lib/i18n/detect.ts` —
   English if the browser prefers English, Ukrainian otherwise. Once
   set (by the switcher or that first-visit default), the cookie is
   never overwritten, so an explicit choice always sticks.
2. **Public/event locale** — what language `/e/[slug]`, `/t/[token]`,
   and their emails render in. Driven by the event's own
   `event_language` (`uk` / `en` / `bilingual`), not the viewer's
   platform cookie — an organizer can run their dashboard in Ukrainian
   while publishing an English-only event. A single-language event
   *is* that language, full stop; a bilingual event additionally
   consults a `pm_public_locale` cookie (the attendee's remembered
   choice from the switcher), defaulting to `uk` if unset. The ticket
   page's default for a bilingual event is the *attendee's own
   registered language* (`attendees.preferred_language`), not the
   generic default — see `resolveTicketLocale` in `lib/i18n/server.ts`.

Neither cookie, nor any other signal used here, is ever derived from
nationality or other personal data — only an explicit choice or the
browser's own stated language preference.

### Why no `/uk/...` or `/en/...` URL prefix

Ticket and event URLs must stay stable regardless of language (§10 of
the brief: existing QR codes must keep working) — a locale-in-the-URL
scheme (`[lang]` route segments) is the conventional Next.js i18n
pattern but was rejected specifically because it would make the URL
itself carry the language, which these URLs can't do without breaking
that stability guarantee. Locale is cookie-only, for both the platform
and public sides, everywhere in this app.

### Architecture: dictionaries, not a translation library

`lib/i18n/`:

- `locale.ts` — the `Locale` (`uk`/`en`) and `EventLanguage`
  (`uk`/`en`/`bilingual`) types, cookie names, defaults.
- `dictionaries/{en,uk}.ts` — plain nested objects, one per domain
  (`common`, `auth`, `dashboard`, `events`, `registration`, `ticket`,
  `scanner`, `kiosk`, `errors`), each a straightforward object of
  strings. `en` is canonical; `dictionaries/types.ts` derives the
  `Dictionary` type from it (widening its literal strings to `string`),
  so `uk.ts` is checked against the same *keys* at compile time — a key
  added to one dictionary and forgotten in the other is a build
  failure, not a runtime gap.
- `translate.ts` — `t(dict, "a.b.c", vars?)`, a dot-path lookup with a
  runtime fallback chain (the given dict → English → the literal path
  string) for the handful of call sites with a genuinely dynamic key
  (e.g. `ScannerResult` mapping a `CheckinResultState` to a label).
  Everywhere else, code reads `dict.events.title` directly — plain,
  compile-checked property access, no runtime lookup needed.
- `server.ts` / `actions.ts` — server-only cookie reads
  (`getPlatformLocale`, `resolvePublicLocale`, `resolveTicketLocale`,
  `getKioskLocale`) and the three `"use server"` actions that set each
  cookie.
- `client.tsx` — `<I18nProvider locale dict>` + `useI18n()`, so Client
  Components (forms, the scanner, the language switcher itself) read
  the already-resolved dictionary without doing their own cookie/locale
  work. Every top-level entry point (`/`, `/login`, `/dashboard/*` via
  its layout, `/e/[slug]`, `/t/[token]`, `/kiosk/[eventId]`) resolves
  its own locale server-side and wraps its subtree once.
- `event-content.ts` — `eventName`/`eventDescription`/`eventVenueName`,
  resolving an event's localized columns for a given display locale
  with graceful fallback to whichever language the event actually has
  content in (so a `uk`-only event still shows *something* to an
  organizer whose own dashboard locale is English).

No translation library was added — `avoid a large dependency unless it
provides a clear advantage` (the brief), and two static, mutually
type-checked dictionaries plus one lookup function don't need one.

### Validation messages are locale-aware too

`lib/validation/event.ts` and `lib/validation/registration.ts` export
`createEventFormSchema(dict)` / `createRegistrationFormSchema(dict)` —
factories, not static schemas — because the Zod messages inside them
must follow the caller's resolved locale (platform locale for the
organizer's event form, the resolved public locale for the attendee's
registration form). Every server action that validates one calls the
factory with its own `getDictionary(locale)` first.

### Localized event content: data model

`events` carries `event_language` (`uk`/`en`/`bilingual`, default
`uk`) plus `name_uk`/`name_en`, `description_uk`/`description_en`,
`venue_name_uk`/`venue_name_en`. A `CHECK` constraint
(`events_name_matches_language`) enforces exactly the brief's rule: a
single-language event only needs its own language's name; a bilingual
event needs both. Everything language-neutral by nature — dates,
times, timezone, address, capacity, deadline, the QR token — is not
duplicated per language (§5).

`attendees.preferred_language` and `registration_consents.language`
(both `ui_language`, i.e. exactly `uk`/`en` — `bilingual` is only ever
an event setting, never a person's own language) record, respectively,
"what language to use for this attendee going forward" and "what
language this specific consent was shown and accepted in" — two
different facts that happen to start out equal at registration time
but are kept as separate columns because they could diverge later
(e.g. a future language-change without re-consenting). `register_attendee`
takes a new `p_language` parameter, validates it against the event's
`event_language` (raising `INVALID_LANGUAGE` on a mismatch — the same
"don't trust the client, recheck at the real trust boundary" pattern
as everything else in that function), and stores it on both columns.

### Ticket & email language

The ticket page and confirmation email render in
`attendees.preferred_language` (for a bilingual event's ticket page,
overridable per-viewing via the switcher, same as the public event
page — see `resolveTicketLocale`). The QR code and `public_token`
remain exactly what they always were: derived from the token alone,
with no language parameter anywhere in `ticketUrl()` or the scanner's
validation path — a ticket's identity cannot depend on which language
someone happens to view it in, and a language switch never mints a new
ticket or a new token. `lib/email/templates.ts`'s `buildTicketEmail`
takes a resolved `Dictionary` and renders a single-language email —
never a combined Ukrainian+English send, matching §7 of the brief.

### Scanner and kiosk

The staff scanner (`/dashboard/events/[eventId]/scanner`) follows the
logged-in organizer's platform locale — it's inside the `/dashboard`
layout's `I18nProvider`, so it needs no locale logic of its own. Kiosk
mode is different on purpose: it's a physical station at the door, so
its language is a property of *that device*, not of whoever happens to
be logged in — a dedicated `pm_kiosk_locale` cookie (set via its own
switcher in the kiosk view's corner) falls back to the platform locale
only the first time a kiosk is opened.

## 13. What's deliberately not built yet

Per the brief: custom fields, paid tickets/Stripe, multiple ticket
types, wallet passes, custom domains, white-label portals, badge
printing, bulk import, waitlists, campaigns, analytics, webhooks/API,
integrations, offline sync, multi check-in sessions, billing. The schema
avoids decisions that would make these harder later (e.g., `tickets` is
already its own table separate from `attendees`, so multiple ticket
types per attendee is an additive change, not a rewrite).
