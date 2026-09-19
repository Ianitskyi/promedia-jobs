# ProMedia Events

A multi-tenant event registration and check-in platform, built as the
first module on the reusable ProMedia Platform core: workspaces
(tenants) create events, people register on a public page, each
registration gets a unique QR ticket, and staff check people in at the
door with an ordinary smartphone camera.

This app lives at `events-app/` inside the `promedia-jobs` repository,
as a separate product from the static job-board site at the repo root.
It deploys as its own Vercel project.

See [`docs/ARCHITECTURE_V2.md`](./docs/ARCHITECTURE_V2.md) for the
current data model, authorization model, and multi-tenant/CRM-core
architecture (Platform → Workspace → CRM Core + Modules) — this is the
document to read to understand how the database is organized today.
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and
[`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) describe the
original, pre-refactor event-centric design and how it was built in
phases — kept for history, not current.

## Stack

Next.js 16 (App Router) · TypeScript · React 19 · Tailwind CSS 4 ·
Supabase (Postgres + Auth) · `qrcode` · `html5-qrcode` · `zod` · Vitest.

No Docker, queues, Redis, or other infrastructure — it's a normal
Next.js app.

## Design system

The organizer/admin interface (dashboard, login, onboarding) uses the
ProMedia visual system — light `#f7f7fb` backgrounds, white cards, navy
(`--ink`) primary actions, ProMedia orange used only for small
accents/badges, and Montserrat (weight 700/800 for headings, via the
`.heading-display` class in `app/globals.css`) as the primary UI font.
Tokens and typography are sourced from the authoritative design
reference, [`ianitskyi/promedia-communities`](https://github.com/Ianitskyi/promedia-communities)
(`css/style.css`) — see the comment block at the top of
`app/globals.css` for the exact token mapping. This is a **logo-light**
interface: the one ProMedia wordmark used (`public/brand/promedia-wordmark.svg`,
on the home page only) is copied byte-for-byte from that same reference
repository's `img/promedia-wordmark.svg`, never redrawn or
approximated — every other screen uses the plain text "ProMedia Events".

Public event registration pages are intentionally **not** restyled to
this system — they keep the lighter, per-event-brandable look (an
event's own logo/`primary_color` can override the accent color there;
see `docs/ARCHITECTURE_V2.md`'s Events section and **Known MVP
limitations** below), so an attendee always sees the event's own
branding, not ProMedia's.

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

The schema lives in two hand-written, sequential migrations — apply
both, in order, on a fresh project:

1. [`0001_init.sql`](./supabase/migrations/0001_init.sql) — the
   original event-centric schema (organizations/attendees).
2. [`0002_platform_refactor.sql`](./supabase/migrations/0002_platform_refactor.sql) —
   the platform refactor described in
   [`docs/ARCHITECTURE_V2.md`](./docs/ARCHITECTURE_V2.md): renames the
   tenant concept from `organizations` to `workspaces`, and replaces
   the old per-event `attendees` table with a persistent, workspace-scoped
   `people` (CRM contact) table plus event-specific `registrations`,
   alongside new `crm_organizations`, `person_organization_relationships`,
   and `activities` tables. **This is a rename-and-extend migration**,
   not a drop-and-recreate — it preserves every existing
   workspace/owner relationship and migrates any pre-existing
   `attendees` rows into deduplicated `people` + `registrations` rows
   (see the migration file's own comments for exactly how). Function
   names changed too: `register_attendee` → `register_for_event`,
   `create_organization_with_owner` → `create_workspace_with_owner`.
   Cross-workspace referential integrity for every new CRM-core
   relationship is enforced with composite foreign keys, not just RLS
   (see `docs/ARCHITECTURE_V2.md` §9), and the person find-or-create in
   `register_for_event` is now concurrency-safe under `INSERT ... ON
   CONFLICT` (see the CONCURRENCY comment in the migration and
   `supabase/INTEGRATION_TESTS.md` §3).

**`0002_platform_refactor.sql` runs as a single transaction** (it wraps
itself in `begin; ... commit;`) — if any statement in it fails partway
through, Postgres rolls back everything that ran before the failure, so
you never end up with a half-applied schema that merely *looks* like it
succeeded. This was verified in review by deliberately breaking a copy
of the file and confirming a full rollback (see
`supabase/INTEGRATION_TESTS.md` §12). Apply it with one of:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Or, applying by hand against an existing project:

```bash
psql "<your-connection-string>" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql "<your-connection-string>" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_platform_refactor.sql
```

`-v ON_ERROR_STOP=1` makes `psql` stop and report the error immediately
instead of printing a wall of "current transaction is aborted" noise
for every remaining line — but note the transaction wrapping inside
`0002_platform_refactor.sql` itself is what actually guarantees
atomicity; even without that flag, a mid-file error still leaves the
whole migration rolled back, it's just noisier to read. If you instead
paste the file into the Supabase dashboard's SQL editor, paste it as
one script (don't split it into separate runs) so the `begin`/`commit`
at its start/end stay together.

**If you already have a project running only `0001_init.sql`** (e.g. a
prior deployment of this app before the platform refactor): running
`0002_platform_refactor.sql` against it is exactly the safe path —
it's designed to run on top of that exact state. Back up first anyway
(`pg_dump`, or a Supabase project snapshot) since this does drop the
old `attendees` table once its data has been migrated. There is no real
production attendee data to worry about losing as of this refactor —
see the migration file's own header comment for the full reasoning —
but if this is ever run against a project that does hold real
registrants, verify the row counts in `people`/`registrations` match
the old `attendees` count before relying on it (the migration's own
transaction wrapping means you don't additionally need to wrap it
yourself, and a failure partway through cannot leave the old
`attendees` table dropped while the new tables are missing — it's
all-or-nothing).

After applying both migrations, run through
[`supabase/INTEGRATION_TESTS.md`](./supabase/INTEGRATION_TESTS.md)
against the live project — it is the authoritative list of what
actually needs verifying (RLS, constraints, triggers, concurrency) that
no amount of mocked unit testing can substitute for.

`lib/database.types.ts` is hand-written to match these migrations
(there's no live project to generate it from in this environment). Once
you have a linked project, regenerate and diff it:

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
by token) — see `docs/ARCHITECTURE_V2.md` §9 for why.

## How to create the first workspace/admin

Workspace creation is **not** self-service — there is no form, and the
database enforces this (`workspaces` has no insert policy for any
client role; the provisioning function is `service_role`-only) — see
`docs/ARCHITECTURE_V2.md` §9. There is no Platform Admin flow yet
either, so until one is built, creating a workspace is a manual,
one-time-per-workspace step run directly against the database:

1. Go to `/login`, switch to "Create an account", and sign up with the
   email of whoever should own the workspace. If your Supabase project
   requires email confirmation, confirm it, then sign in — at this
   point they'll land on `/dashboard/onboarding`, which just shows an
   invite-only message. That's expected.
2. In the Supabase dashboard's **SQL Editor** (a privileged connection,
   not the anon/authenticated API — this is what makes step 3 work),
   find that user's id:
   ```sql
   select id, email from auth.users where email = 'owner@example.com';
   ```
3. Provision the workspace with that id as the owner:
   ```sql
   select create_workspace_with_owner(
     'ProMedia',      -- workspace name
     'promedia',      -- slug
     '<the user id from step 2>'
   );
   ```
4. The user can now sign in and use `/dashboard` normally, as that
   workspace's `OWNER`. From there, create an event, and add teammates
   by inserting rows into `workspace_members` directly (there's no
   invite UI yet — see **Known MVP limitations**).

Repeat steps 1–3 for each additional workspace.

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

Registration finds-or-creates a `people` row, then creates a
`registrations` row and a `tickets` row, all in one atomic Postgres
function call (`register_for_event`) — see
`docs/ARCHITECTURE_V2.md` §2/§5. The ticket's `public_token` is 256
random bits (`pgcrypto`'s `gen_random_bytes(32)`, base64url-encoded) —
it is the **only** thing encoded in the QR code, as
`https://<app-url>/t/<token>`. It contains no personal data, database
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
  via its parent event) a `workspace_id`, enforced by Row Level
  Security as a baseline, plus explicit role checks in server code for
  actions RLS can't cleanly express (e.g. only OWNER/ADMIN may export).
  This now extends to the CRM core (`people`, `crm_organizations`,
  `person_organization_relationships`, `activities`, `consents`), not
  just the Events tables — see `docs/ARCHITECTURE_V2.md` §9.
- **Service role key**: read only in `lib/server/*` and Route Handlers;
  never imported by client-bundled code. The `server-only` package
  enforces this at build time for every file that touches it.
- **Ticket tokens**: 256-bit random, unguessable, carry no PII, validated
  by shape before ever reaching the database.
- **`register_for_event` / `perform_checkin`**: `SECURITY DEFINER`
  Postgres functions with `EXECUTE` revoked from `anon`/`authenticated`
  and granted only to `service_role` — they cannot be called directly
  through Supabase's public REST API, only from this app's server code.
  `create_workspace_with_owner` does **not** get this treatment (it
  needs the caller's own session) and is a known, documented exception
  — see `docs/ARCHITECTURE_V2.md` §9.
- **Duplicate registration never discloses the existing ticket token**
  — an email already registered for an event gets an
  `ALREADY_REGISTERED` result with no token, never the original
  person's ticket. See `docs/ARCHITECTURE_V2.md` §5.
- **Cross-workspace CRM isolation**: the same email in two different
  workspaces produces two independent `people` rows — the dedup unique
  constraint is `(workspace_id, normalized_email)`, never a bare email
  — so registering for events in two unrelated workspaces never merges
  or leaks one workspace's contact into another's. See
  `docs/ARCHITECTURE_V2.md` §2 and `supabase/INTEGRATION_TESTS.md` §1/§3.
- **Check-in event/ticket consistency is a database-enforced
  invariant**, not just an application check: `perform_checkin` derives
  `event_id` from the ticket itself, and a `before insert or update`
  trigger on `checkins` independently rejects any row whose `event_id`
  disagrees with its ticket's — see `docs/ARCHITECTURE_V2.md` §5.
- **Rate limiting**: `lib/rate-limit.ts` — development/single-instance
  protection only, explicitly not production-grade. See limitations
  below.
- **Input validation**: every public-facing mutation is validated with
  `zod` before touching the database.
- **Anti-spam**: the registration form has a hidden honeypot field;
  filling it is treated as a bot submission.
- **Errors**: attendees and scanner operators only ever see a small,
  known set of states; raw exceptions are logged server-side, never
  rendered.
- **Privacy**: only the fields needed for registration are collected;
  consent is recorded per-person as a purpose-scoped `consents` row
  (not a boolean), and the schema keeps a person's data cleanly
  deletable/cascadable per-row for a future anonymization/erasure flow
  (not built in this MVP) — see `docs/ARCHITECTURE_V2.md` §7 and §20.

## Known MVP limitations

- **No member invite UI** — adding a teammate to a workspace (and
  setting their role) is currently a manual `workspace_members` insert.
- **No self-service workspace creation, and no Platform Admin UI yet
  either** — see `docs/ARCHITECTURE_V2.md` §9. Provisioning is locked
  down at the database level (no insert policy on `workspaces`,
  `create_workspace_with_owner` is `service_role`-only and takes an
  explicit, validated owner id), which is the real fix, not a stopgap —
  but there's no UI in front of it yet, so creating a new workspace
  today means running that function by hand (see **How to create the
  first workspace/admin**) until a Platform Admin flow exists to do it
  through the product.
- **No CRM UI yet** — `people`, `crm_organizations`, and
  `person_organization_relationships` exist with working RLS (an admin
  can insert/update them directly against the database today) but there
  is no dashboard screen for browsing/editing contacts or organizations.
  The Events registration flow is the only thing that writes to `people`
  today. See `docs/ARCHITECTURE_V2.md` §2-§4.
- **Rate limiting is development/single-instance protection, not
  production-grade** — `lib/rate-limit.ts` says so explicitly and
  defines a `RateLimiter` interface for the purpose; the shipped
  `InMemoryRateLimiter` does not share state across serverless
  instances or survive a restart. A durable store (e.g. Upstash Redis)
  behind the same interface is the pre-launch upgrade.
- **The database security/integrity model has not been verified against
  the real Supabase project** — this environment has no authenticated
  access to it. It has, however, been verified against a disposable
  **local PostgreSQL 16 instance** created and destroyed inside this
  sandbox during review: `0001_init.sql` then
  `0002_platform_refactor.sql` both applied cleanly as one transaction;
  every cross-workspace composite foreign key (§9 of
  `docs/ARCHITECTURE_V2.md`) was confirmed to reject a real
  cross-workspace insert and accept a consistent one; the
  `checkins_event_matches_ticket` trigger was reconfirmed working; the
  `people` dedup unique constraint and the new `register_for_event`
  concurrency fix were stress-tested under real concurrent connections
  (see `supabase/INTEGRATION_TESTS.md` §3 and §12 for the exact
  results). `lib/database.types.ts` is still hand-written to match the
  SQL migrations rather than generated from a live project — that part
  is unchanged. Local-Postgres verification is real evidence that the
  SQL itself is correct, but it is **not** a substitute for running
  [`supabase/INTEGRATION_TESTS.md`](./supabase/INTEGRATION_TESTS.md)
  against your actual Supabase project (real RLS/auth wiring, your
  actual current data) before relying on this in production — most of
  that checklist is still genuinely unexecuted.
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
RLS policies including cross-workspace CRM isolation, the `people`
dedup unique constraint, the `register_for_event` row lock, the
capacity race, a truly simultaneous duplicate scan). Those are
integration-level properties of the schema in
`supabase/migrations/0001_init.sql` and
`supabase/migrations/0002_platform_refactor.sql` that only a real
database can verify, and **have not been run against one** — see
[`supabase/INTEGRATION_TESTS.md`](./supabase/INTEGRATION_TESTS.md) for
the concrete checklist to run before relying on this in production, and
**Known MVP limitations** below.

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
