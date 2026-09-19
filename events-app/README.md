# ProMedia Events

A multi-tenant event registration and check-in platform: organizations
create events, attendees register on a public page, each registration
gets a unique QR ticket, and staff check attendees in at the door with
an ordinary smartphone camera.

This app lives at `events-app/` inside the `promedia-jobs` repository,
as a separate product from the static job-board site at the repo root.
It deploys as its own Vercel project.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the design and security
rationale, and [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for
how it was built in phases.

## Stack

Next.js 16 (App Router) · TypeScript · React 19 · Tailwind CSS 4 ·
Supabase (Postgres + Auth) · `qrcode` · `html5-qrcode` · `zod` · Vitest.

No Docker, queues, Redis, or other infrastructure — it's a normal
Next.js app.

## Local setup

```bash
cd events-app
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Open http://localhost:3000.

## Required environment variables

See [`.env.example`](./.env.example) for the full list with comments.
Summary:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API. **Server-only, never exposed to the browser — never commit it.** |
| `NEXT_PUBLIC_APP_URL` | The app's public URL (used to build ticket URLs embedded in QR codes and emails) |
| `EMAIL_PROVIDER` | `console` (default, logs emails) or `resend` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Only needed if `EMAIL_PROVIDER=resend` |

Never commit `.env.local` or any file containing real keys — `.gitignore`
excludes `.env*` except the checked-in `.env.example` template.

## Supabase setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Copy the Project URL, anon key, and service role key into `.env.local`.
3. Apply the schema (see **Database migrations** below).
4. In **Authentication → Providers**, email/password sign-in is enabled
   by default — that's all this MVP uses. Decide whether to require
   email confirmation (Authentication → Settings); if enabled, a new
   organizer must confirm their email before their first sign-in.

## Database migrations

The schema lives in [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
as a single, hand-written migration: tables, constraints, indexes, Row
Level Security policies, and three Postgres functions
(`register_attendee`, `perform_checkin`, `create_organization_with_owner`).

Apply it with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste the file's contents into the Supabase dashboard's SQL editor
and run it once.

`lib/database.types.ts` is hand-written to match this migration (there's
no live project to generate it from in this environment). Once you have
a linked project, regenerate and diff it:

```bash
supabase gen types typescript --linked > lib/database.types.ts
```

## How authentication works

Supabase Auth issues sessions (email/password). `@supabase/ssr` stores
the session in cookies; `middleware.ts` refreshes it on every request
and redirects signed-out users away from `/dashboard` and `/kiosk`.
Server Components and Server Actions read the session via
`lib/supabase/server.ts`; Client Components use `lib/supabase/browser.ts`.
Both go through the anon key and are subject to Row Level Security.

A separate service-role client (`lib/supabase/admin.ts`) is used only in
`lib/server/*`, for the handful of flows that are intentionally
unauthenticated (public registration, ticket lookup by token, check-in
by token) — see `ARCHITECTURE.md` §3 for why.

## How to create the first organization/admin

Organization creation is **not** self-service — there is no form, and
the database enforces this (`organizations` has no insert policy for
any client role; the provisioning function is `service_role`-only) —
see `ARCHITECTURE.md` §7a. There is no Platform Admin flow yet either,
so until one is built, creating an organization is a manual,
one-time-per-organization step run directly against the database:

1. Go to `/login`, switch to "Create an account", and sign up with the
   email of whoever should own the organization. If your Supabase
   project requires email confirmation, confirm it, then sign in — at
   this point they'll land on `/dashboard/onboarding`, which just shows
   an invite-only message. That's expected.
2. In the Supabase dashboard's **SQL Editor** (a privileged connection,
   not the anon/authenticated API — this is what makes step 3 work),
   find that user's id:
   ```sql
   select id, email from auth.users where email = 'owner@example.com';
   ```
3. Provision the organization with that id as the owner:
   ```sql
   select create_organization_with_owner(
     'ProMedia',      -- organization name
     'promedia',      -- slug
     '<the user id from step 2>'
   );
   ```
4. The user can now sign in and use `/dashboard` normally, as that
   organization's `OWNER`. From there, create an event, and add
   teammates by inserting rows into `organization_users` directly
   (there's no invite UI yet — see **Known MVP limitations**).

Repeat steps 1–3 for each additional organization.

## Running the dev server / tests / checks

```bash
npm run dev         # start the dev server
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run build         # production build
```

## Deploying to Vercel

1. Import the repository into Vercel.
2. Set the project's **Root Directory** to `events-app`.
3. Add the environment variables from `.env.example` in the Vercel
   project settings (all of them, including `SUPABASE_SERVICE_ROLE_KEY`
   — Vercel keeps server-only env vars out of the client bundle the
   same way `next dev`/`next build` do).
4. Set `NEXT_PUBLIC_APP_URL` to the deployed domain.
5. Deploy. Apply the Supabase migration against your production project
   before (or right after) the first deploy.

## How QR tickets work

Registration creates an `attendees` row and a `tickets` row in one
atomic Postgres function call (`register_attendee`). The ticket's
`public_token` is 256 random bits (`pgcrypto`'s `gen_random_bytes(32)`,
base64url-encoded) — it is the **only** thing encoded in the QR code, as
`https://<app-url>/t/<token>`. It contains no attendee data, database
ID, or sequence number, so scanning or guessing it reveals nothing and
can't be enumerated. The ticket page (`/t/<token>`) and the confirmation
email both render the QR from this same URL.

## How scanner validation works

The camera (`html5-qrcode`) only decodes a string client-side — it never
makes a trust decision. The decoded text is sent to `POST /api/checkin`,
which is the single, server-only place that:

1. Re-derives and validates the token's shape.
2. Looks the ticket up in the database.
3. Confirms it belongs to the event the operator is scanning for
   (rejecting cross-event tokens as `WRONG_EVENT`).
4. Confirms it isn't revoked.
5. Calls `perform_checkin`, a Postgres function that does an
   `INSERT ... ON CONFLICT (ticket_id) DO NOTHING`. Because
   `checkins.ticket_id` is `UNIQUE`, at most one check-in per ticket can
   ever be created — this holds even if two phones scan the same QR
   code at the same instant, without any application-level locking.

Manual check-in (search by name/email) and kiosk mode call the exact
same route and function, just with a different `method` tag
(`QR` / `MANUAL` / `KIOSK`) and, for manual check-in, a ticket ID instead
of a scanned token.

## Internationalization (Ukrainian / English)

The organizer dashboard and every public attendee-facing page support
Ukrainian (default) and English. Full design in
[`ARCHITECTURE.md`](./ARCHITECTURE.md) §12; summary:

- **Platform locale** (dashboard/auth): cookie `pm_locale`, switched
  with the UA | EN toggle visible everywhere, defaults from the
  browser's `Accept-Language` on a visitor's first request only.
- **Public/event locale**: driven by the event's own `event_language`
  (`uk` / `en` / `bilingual`), independent of the organizer's platform
  locale. A bilingual event shows its own switcher and remembers the
  attendee's choice (cookie `pm_public_locale`); the ticket page
  defaults a bilingual event to the attendee's own registered language.
- **Kiosk locale**: its own cookie (`pm_kiosk_locale`) — a kiosk is a
  physical station, not tied to whoever's logged in.
- No URL locale prefix (`/uk/...`, `/en/...`) — event and ticket URLs,
  including QR codes, must stay stable regardless of language, so
  locale is cookie-only everywhere.
- Translations live in `lib/i18n/dictionaries/{en,uk}.ts`, organized by
  domain (`common`, `auth`, `dashboard`, `events`, `registration`,
  `ticket`, `scanner`, `kiosk`, `errors`); `en` is canonical and `uk`
  is checked against its exact keys at compile time.

**Known untranslated/imperfect spots**, called out rather than hidden:
- The exported CSV's column headers (`app/api/events/[eventId]/export/route.ts`)
  are English-only — treated as a data-interchange format, not UI.
- `app/layout.tsx`'s `<meta name="description">` (static Next.js
  `Metadata`) and the honeypot field's `<label>Website</label>`
  (`components/RegistrationForm.tsx`, `aria-hidden` and never seen by a
  real visitor) are English-only.
- Errors Supabase Auth itself generates (e.g. "User already
  registered" on sign-up) are shown as-is, in whatever language
  Supabase's own client returns them — not mapped through the
  dictionaries.
- The root `<html lang>` attribute follows the platform locale, which
  can differ from a public event page's actual content language for a
  non-default-language event — a per-page override isn't wired up.

## Security considerations

- **Tenant isolation**: every tenant-owned table carries (directly or
  via its parent event) an `organization_id`, enforced by Row Level
  Security as a baseline, plus explicit role checks in server code for
  actions RLS can't cleanly express (e.g. only OWNER/ADMIN may export).
- **Service role key**: read only in `lib/server/*` and Route Handlers;
  never imported by client-bundled code. The `server-only` package
  enforces this at build time for every file that touches it.
- **Ticket tokens**: 256-bit random, unguessable, carry no PII, validated
  by shape before ever reaching the database.
- **`register_attendee` / `perform_checkin`**: `SECURITY DEFINER`
  Postgres functions with `EXECUTE` revoked from `anon`/`authenticated`
  and granted only to `service_role` — they cannot be called directly
  through Supabase's public REST API, only from this app's server code.
  `create_organization_with_owner` does **not** get this treatment (it
  needs the caller's own session) and is a known, documented exception
  — see `ARCHITECTURE.md` §7a.
- **Duplicate registration never discloses the existing ticket token**
  — an email already registered for an event gets an
  `ALREADY_REGISTERED` result with no token, never the original
  attendee's ticket. See `ARCHITECTURE.md` §5a.
- **Check-in event/ticket consistency is a database-enforced
  invariant**, not just an application check: `perform_checkin` derives
  `event_id` from the ticket itself, and a `before insert or update`
  trigger on `checkins` independently rejects any row whose `event_id`
  disagrees with its ticket's — see `ARCHITECTURE.md` §6a.
- **Rate limiting**: `lib/rate-limit.ts` — development/single-instance
  protection only, explicitly not production-grade. See limitations
  below.
- **Input validation**: every public-facing mutation is validated with
  `zod` before touching the database.
- **Anti-spam**: the registration form has a hidden honeypot field;
  filling it is treated as a bot submission.
- **Errors**: attendees and scanner operators only ever see a small,
  known set of states (see `ARCHITECTURE.md` §10); raw exceptions are
  logged server-side, never rendered.
- **Privacy**: only the fields needed for registration are collected;
  consent text and its version are stored per-registration for audit;
  the schema keeps attendee data cleanly deletable per-row for a future
  anonymization/erasure flow (not built in this MVP).

## Known MVP limitations

- **No member invite UI** — adding a teammate to an organization (and
  setting their role) is currently a manual `organization_users` insert.
- **No self-service organization creation, and no Platform Admin UI
  yet either** — see `ARCHITECTURE.md` §7a. Provisioning is locked
  down at the database level (no insert policy on `organizations`,
  `create_organization_with_owner` is `service_role`-only and takes an
  explicit, validated owner id), which is the real fix, not a stopgap —
  but there's no UI in front of it yet, so creating a new organization
  today means running that function by hand (see **How to create the
  first organization/admin**) until a Platform Admin flow exists to do
  it through the product.
- **Rate limiting is development/single-instance protection, not
  production-grade** — `lib/rate-limit.ts` says so explicitly and
  defines a `RateLimiter` interface for the purpose; the shipped
  `InMemoryRateLimiter` does not share state across serverless
  instances or survive a restart. A durable store (e.g. Upstash Redis)
  behind the same interface is the pre-launch upgrade.
- **The database security/integrity model is designed and unit-tested
  against a mock, not verified against a real database.** This
  environment had no live Supabase project and no network access to
  provision one, so `lib/database.types.ts` is hand-written to match
  the SQL migration rather than generated from a live project, and
  nothing here has exercised the actual RLS policies, the
  `checkins.ticket_id` unique constraint, the
  `checkins_event_matches_ticket` trigger, or the `register_attendee`
  row lock against a running Postgres instance. Do not treat these as
  verified. Run [`supabase/INTEGRATION_TESTS.md`](./supabase/INTEGRATION_TESTS.md)
  against a real project before relying on this in production.
- **Timezone handling** is deliberately simple: event start/end are
  stored as the organizer's chosen local date/time/zone triple.
  Display always renders those values in the event's own configured
  timezone (`lib/format-event-time.ts`), and the registration deadline
  is converted to a UTC instant for comparison — both via a small
  Intl-based helper (`lib/timezone.ts`) rather than a timezone library.
  See `ARCHITECTURE.md` §9a.
- Everything listed in `ARCHITECTURE.md` §13 as out of scope (payments,
  custom fields, wallet passes, bulk import, analytics, webhooks/API,
  etc.) — deliberately not built.

## Testing

```bash
npm test
```

Unit tests cover the application-logic surface described in the brief:
ticket token format/entropy, slug generation, the timezone conversion
helper, CSV export formatting, the registration-form schema (including
the honeypot and required-consent checks), the `can()` permission
matrix, and — via a mocked Supabase client — the full check-in and
registration state machines: invalid token, wrong event, revoked
ticket, first successful check-in, "loses the race" → already checked
in (the concurrency case), manual check-in reusing the same path, and
registration error mapping (event not found/published, deadline passed,
capacity reached, duplicate registration reporting `ALREADY_REGISTERED`
without ever exposing the existing ticket token — including a test
that defends this even if a future/buggy RPC response carried one).

Also covered: the i18n layer (`lib/i18n/**/*.test.ts`) — Ukrainian
default, English platform selection via `Accept-Language`, language
persistence across requests, resolving `uk`/`en`/bilingual event
locales (including the ticket page's attendee-language default),
localized registration/event-form validation messages in both
languages, bilingual event content validation (a single-language event
needs only its own name, bilingual needs both), the confirmation
email's per-language rendering (and that it's never a combined
Ukrainian+English send), the QR ticket URL's independence from
language, timezone formatting correctness in both locales, and the
dictionary fallback chain when a translation key is missing.

What these tests do **not** cover: the actual Postgres-level guarantees
(the `checkins.ticket_id` unique constraint and its enforcing trigger,
RLS policies, the `register_attendee` row lock, the capacity race, a
truly simultaneous duplicate scan). Those are integration-level
properties of the schema in `supabase/migrations/0001_init.sql` that
only a real database can verify, and **have not been run against
one** — see [`supabase/INTEGRATION_TESTS.md`](./supabase/INTEGRATION_TESTS.md)
for the concrete checklist to run before relying on this in production,
and **Known MVP limitations** below.

## Roadmap

See `ARCHITECTURE.md` §13 and the brief's "future features" list:
custom registration fields, paid tickets (Stripe), multiple ticket
types, Apple/Google Wallet, custom domains, white-label portals,
self-check-in kiosks at scale, badge printing, invitations, bulk
import, waitlists, email campaigns, SMS, analytics, webhooks, a public
API, third-party integrations, offline scanner sync, multi-session
attendance, and billing. The schema (separate `tickets` table, a
pluggable email provider, a permission table keyed by role) was written
so most of these are additive rather than requiring a rewrite.
