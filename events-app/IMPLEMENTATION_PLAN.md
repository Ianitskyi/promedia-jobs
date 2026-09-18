# Implementation Plan

Phases match `ARCHITECTURE.md`. Each phase ends with lint + typecheck
(and tests, once they exist) passing before moving on.

## Phase 1 — Setup, database, auth, organizations
- Scaffold Next.js app (done), install dependencies.
- `supabase/migrations/0001_init.sql`: all tables, enums, constraints,
  indexes, `updated_at` trigger, `perform_checkin` function, RLS
  policies.
- `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts`.
- `middleware.ts` for session refresh.
- `lib/authz.ts`: `getCurrentOrgMembership()`, `requireRole()`.
- Login page + logout action, `/dashboard` shell with nav + sign-out.
- Org bootstrap: first login with no membership shows a "create your
  organization" step (becomes OWNER).

## Phase 2 — Events + public registration
- `dashboard/events` list + `dashboard/events/new` + edit page.
- Slug generation (`lib/slug.ts`), uniqueness check.
- `/e/[slug]` public page: renders event info + registration form for
  `PUBLISHED` events; explicit states for not-found / closed / deadline
  passed / capacity reached.
- `registerAttendee` server action: validates input, normalizes email,
  checks deadline/capacity/duplicate, creates attendee + consent row in
  one transaction (via RPC to keep it atomic), then creates the ticket.

## Phase 3 — Tickets, QR, email
- `lib/tokens.ts` (random token gen), ticket creation folded into
  registration transaction.
- `/t/[token]` ticket page with server-rendered QR (`qrcode`).
- `lib/email/` abstraction + console/Resend providers; send
  confirmation after registration (best-effort, doesn't block success).

## Phase 4 — Scanner + atomic check-in
- `lib/server/checkin.ts`: `validateAndCheckIn(token, eventId, actor)`
  shared by scanner, manual check-in, kiosk.
- `POST /api/checkin` route handler wrapping it, role-gated
  (OWNER/ADMIN/CHECKIN_STAFF).
- `dashboard/events/[eventId]/scanner`: camera scanner using
  `html5-qrcode`, `ScannerResult` component with the 5 result states,
  auto-reset after ~2s, vibration on success where supported.

## Phase 5 — Dashboard, manual check-in, export
- `dashboard/events/[eventId]`: stats header + `AttendeeTable` with
  search + status filter.
- Manual check-in panel on the scanner screen (search → check in),
  reusing `/api/checkin`.
- `GET /api/events/[eventId]/export` CSV route, OWNER/ADMIN only.

## Phase 6 — Kiosk + polish
- `/kiosk/[eventId]`: branded, minimal, auto-resetting scan-only view.
- Sweep error states listed in the brief; confirm mobile layout for
  registration/ticket/scanner, desktop-first for dashboard.

## Phase 7 — Tests, docs, security pass
- Vitest unit tests: token entropy/shape, email normalization, slug
  generation, timezone helper, CSV builder, checkin state-machine logic
  against a mocked Supabase client (covers token validation states,
  duplicate/simultaneous check-in via the `ON CONFLICT` path, tenant
  mismatch, wrong-event, revoked).
- `README.md`: setup, env vars, Supabase project + migration steps,
  deploy to Vercel, how QR/scanner validation works, security notes,
  known limitations, roadmap.
- Final lint/typecheck/test run; quick self security review against
  §17/§18 of the brief.

## Known constraint for this environment

This sandbox has no live Supabase project and no outbound access to
provision one. Phases are implemented and typechecked against the
Supabase JS types generated from the migration SQL, and unit-tested with
a mocked client. End-to-end verification against a real Supabase
instance is left to the person running `supabase db push` from the
README steps — this is called out explicitly rather than claimed as
tested.
