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

1. Go to `/login`, switch to "Create an account", and sign up.
2. If your Supabase project requires email confirmation, confirm the
   email, then sign in.
3. You'll land on `/dashboard/onboarding` — create an organization. You
   become its `OWNER`.
4. From there, create an event, invite teammates by adding rows to
   `organization_users` (there's no invite UI yet — see **Known MVP
   limitations**), and go.

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
- **Rate limiting**: a minimal in-memory limiter
  (`lib/rate-limit.ts`) guards public registration and check-in. It's
  process-local — see limitations below.
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
- **Rate limiting is per-instance**, not shared across serverless
  instances. Fine for a single-region MVP; a durable store (e.g. Upstash
  Redis) is the natural upgrade behind the same `checkRateLimit()` call
  site.
- **No live Supabase project in the environment this was built in** —
  `lib/database.types.ts` is hand-written to match the SQL migration
  rather than generated from a live project, and the test suite (see
  below) exercises application logic against a mocked Supabase client
  rather than a real database. Both should be revisited (regenerate
  types, add integration tests) once linked to a real project.
- **Timezone handling** is deliberately simple: event start/end are
  stored and displayed as the organizer's chosen local date/time/zone
  triple (no UTC conversion needed for display); only the registration
  deadline is converted to a UTC instant for comparison, via a small
  Intl-based helper (`lib/timezone.ts`) rather than a timezone library.
- Everything listed in `ARCHITECTURE.md` §11 as out of scope (payments,
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
capacity reached, duplicate registration returning the existing
ticket).

What these tests do **not** cover: the actual Postgres-level guarantees
(the `checkins.ticket_id` unique constraint, RLS policies, the
`register_attendee` row lock). Those are integration-level properties
of the schema in `supabase/migrations/0001_init.sql` and should be
verified against a real (or local, via `supabase start`) Postgres
instance before relying on this in production — see **Known MVP
limitations**.

## Roadmap

See `ARCHITECTURE.md` §11 and the brief's "future features" list:
custom registration fields, paid tickets (Stripe), multiple ticket
types, Apple/Google Wallet, custom domains, white-label portals,
self-check-in kiosks at scale, badge printing, invitations, bulk
import, waitlists, email campaigns, SMS, analytics, webhooks, a public
API, third-party integrations, offline scanner sync, multi-session
attendance, and billing. The schema (separate `tickets` table, a
pluggable email provider, a permission table keyed by role) was written
so most of these are additive rather than requiring a rewrite.
