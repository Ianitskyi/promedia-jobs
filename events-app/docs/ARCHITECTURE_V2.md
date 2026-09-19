# ProMedia Platform architecture v2

This document supersedes `ARCHITECTURE.md` as the description of the
data model and authorization model. `ARCHITECTURE.md` is kept for
historical reference (it describes the pre-refactor, event-centric
schema) but should not be used to reason about the current database —
follow this document instead. `README.md` still holds the practical
setup/run instructions.

**Every section below is marked `IMPLEMENTED NOW` or `FUTURE /
ARCHITECTURAL EXTENSION`.** Nothing marked FUTURE has a table, RPC, or
UI in this codebase yet — those sections exist so a later module can be
added without redesigning the tables that already exist, not because
the feature is partially built.

The product the end user sees is still **ProMedia Events** — this
refactor changes what's underneath it, not what it does. See §12 for
confirmation that every pre-existing Events feature still works.

---

## 1. Platform vs Workspace vs CRM Organization — `IMPLEMENTED NOW`

Three distinct concepts that must never be confused with each other,
because they are genuinely different things stored in different tables:

- **Platform** — the ProMedia Platform itself. Not a database row; it's
  this codebase plus whatever other modules/apps eventually share its
  database.
- **Workspace** (table: `workspaces`, was `organizations` before this
  refactor) — a *tenant*: an account on the platform. ProMedia itself
  can own a workspace; so could a partner running their own events.
  Every piece of tenant-owned data (events, people, CRM organizations,
  activities, ...) hangs off a `workspace_id`. A user's relationship to
  a workspace is a `workspace_members` row with a role (§8).
- **CRM Organization** (table: `crm_organizations`) — a record *inside*
  a workspace's CRM: a newsroom, NGO, donor, union branch, university,
  or partner that the workspace's people are connected to. **A CRM
  Organization is never a tenant and never a login boundary.** Renaming
  the old `organizations` table to `workspaces` (§19) was specifically
  to free up "Organization" to mean this instead, since the two ideas
  used to collide under one name.

```
Platform
  -> Workspace (tenant, "workspaces")
      -> CRM Core
          -> People              ("people")
          -> Organizations       ("crm_organizations")
          -> Relationships       ("person_organization_relationships")
      -> Modules
          -> Events (this app, NOW)
          -> Community / Programs / Payments / ... (FUTURE, §11-§18)
```

## 2. Person / contact model — `IMPLEMENTED NOW` (Events fields only)

Table: `people`. A **persistent, workspace-scoped** contact — the
central fix this refactor makes to the old model, where a fresh
`attendees` row was created every time someone registered for a new
event, with no way to recognize "this is the same person as last time."

- Reused across every event a person registers for **within the same
  workspace** (§12's `register_for_event` finds an existing person by
  `(workspace_id, normalized_email)` before creating a new one).
- **Never merged across workspaces.** The same email in two different
  workspaces produces two independent `people` rows with different
  ids — the unique constraint is `(workspace_id, normalized_email)`,
  not a bare email. Tenant boundaries are absolute (§9).
- A repeat registration never overwrites an existing person's stored
  name/language — see the comment on `register_for_event` in
  `supabase/migrations/0002_platform_refactor.sql`. A later
  registration might be filled in by someone else on the person's
  behalf, or with a nickname, and should not silently rewrite the CRM
  record of record. (Editing an existing person's own record is a
  FUTURE CRM UI concern, not something registration does as a side
  effect.)

Fields the Events module actually populates today: `first_name`,
`last_name`, `email`, `preferred_language`. Every other field the
brief asked the architecture to support — `display_name`, `phone`,
`city`, `date_of_birth`, `notes`, `tags` (jsonb), `custom_fields`
(jsonb), `communication_preferences` (jsonb) — exists on the table
today (so a future module never needs a migration to start using them)
but is left at its default and not exposed anywhere in this app's UI.
This is deliberate: the brief asks for the *architecture* to support
these, not for the Events registration form to start collecting them.

`activity history` for a person is a separate table, not a column —
see §5.

## 3. Person ↔ Organization relationships — `FUTURE / ARCHITECTURAL EXTENSION`

Table: `person_organization_relationships` exists, with RLS wired up
identically to every other CRM table, but has **zero rows** written by
this app — nothing in the Events module creates one. A person's
"company" at registration (§4) is intentionally *not* auto-linked to a
`crm_organizations` row; it's a free-text snapshot of what they typed
for that one event.

When a future module needs this (e.g. "this person represents
Newsroom X"), the table already has: `role_title`, `relationship_type`,
`start_date`/`end_date`, `is_primary`, and a `metadata` jsonb column
for anything not worth a dedicated column yet. A person may have
relationships with multiple organizations; an organization may have
relationships with multiple people.

## 4. Events model — `IMPLEMENTED NOW`

`events` is unchanged in shape from the pre-refactor schema except that
its tenant foreign key is now `workspace_id` (was `organization_id`).
Everything about event content, localization (`event_language`,
`name_uk`/`name_en`/etc.), status, capacity, and branding is exactly as
before — see `README.md`'s "How QR tickets work" and "Internationalization"
sections, which still apply unchanged.

## 5. Registration lifecycle & activity architecture — `IMPLEMENTED NOW` (Events activities only)

The old `attendees` table (one row per event registration, holding both
contact fields *and* event-specific fields together) is replaced by two
tables with a clear split:

- **`registrations`** — event-specific facts only: which `event_id`,
  which `person_id`, what they typed as `company_at_registration`/
  `position_at_registration` *for this event* (not promoted to a CRM
  organization relationship — see §3), the `consent_id` for this
  registration, and a `status` (`registered`/`cancelled` — cancellation
  isn't wired up in the UI yet, but the column exists so a future
  "cancel my registration" flow doesn't need a migration).
- **`people`** — everything that's actually about the person, not the
  event (§2).

`tickets.registration_id` (was `tickets.attendee_id`) ties a ticket to
one registration, unchanged 1:1 relationship.

**Activity timeline** (table: `activities`) is new: an append-only log
of things that happened to a person. `register_for_event` writes an
`event_registered` activity; `perform_checkin` writes an
`event_checked_in` activity (only on the first successful check-in of
a ticket, never on a repeat scan). `subject_type`/`subject_id` is a
loose reference (e.g. `("event", <id>)`) rather than a foreign key —
see the schema comment in `0002_platform_refactor.sql` for why: the set
of subject tables grows with every future module, and a hard FK would
need a migration per module, which is exactly what this table exists to
avoid. **No other activity types are implemented** — the brief's list
(email sent, survey completed, membership renewed, grant awarded, ...)
is the intended shape for future modules, not something built now.

The point of this split: adding a `cancelled_reason` column later
touches `registrations`, not `people`; adding "membership renewed"
later is a new `activity_type` value, not a new column anywhere.

## 6. FUTURE modules — `FUTURE / ARCHITECTURAL EXTENSION`

None of §§6a-6h below have a table, RPC, or UI in this codebase. They
describe how each would attach to the core in §1-§5 without changing
it, per the brief's explicit "do not build these now" instruction
(brief §21).

### 6a. Community / membership management

Would add a `memberships` table (`workspace_id`, `person_id`, `tier`,
`status`, `started_at`, `renewed_at`) and a `membership_dues` table
referencing it — reusing `people` as the member record and `activities`
for "joined community"/"membership renewed" events. No new identity
concept needed; a community member is just a `Person` with a
membership row.

### 6b. Programs / Grants / Jury

The shape the brief specifies:

```
Program -> Call -> Application -> Review -> Decision / Award
```

`applicant_id` on `Application` would be a polymorphic reference (like
`activities.subject_id`, §5) to either a `people.id` or a
`crm_organizations.id` — an applicant may be a person or an
organization (brief §7). Reviewers are `people` rows with a
`jury_assignments` row scoping them to one `Call`
(`person_id`, `call_id`, plus conflict-of-interest/scoring fields) —
this is exactly the "scoped/module assignment" pattern in §8, not a new
global role. An organization representative who needs to log in and
manage an application is a normal Supabase Auth user whose `people` row
(or a new `organization_representatives` join, if a person can
represent without being the workspace's own contact) grants them
`APPLICANT_REPRESENTATIVE` access scoped to that one application —
again a scoped assignment, not a `workspace_members` role.

### 6c. Payments

Would add a `payments` table (`workspace_id`, `payer_person_id`,
`purpose` — `event_fee`/`membership_dues`/`donation`/`grant_payment`/
`other`, `amount`, `currency`, `provider`, `provider_reference`,
`status`) behind a provider-adapter interface (mirroring how
`lib/rate-limit.ts`'s `RateLimiter` interface already isolates one
swappable implementation behind one seam in this codebase). **No card
data would ever be stored here** — `provider_reference` is an opaque id
from Stripe/WayForPay/LiqPay/etc., matching how `tickets.public_token`
is already an opaque, unguessable reference rather than embedded PII
(§10). Event registration fees would be the first concrete `purpose`,
added as a nullable `payment_id` on `registrations` — additive, no
change to the columns that exist today.

### 6d. Cases / humanitarian assistance / mutual aid

Would add a `cases` table (`workspace_id`, `person_id`, `case_type`,
`status`, `assigned_to` a workspace member) plus `activities` entries
for "assistance requested"/"assistance approved". Reuses `people` for
the requester; no new identity model.

### 6e. Assets / equipment distribution

Would add an `assets` table (serials, condition, current holder) and an
`asset_assignments` join to `people` — "equipment issued"/"equipment
returned" as `activities`.

### 6f. Journalist insurance

Would add an `insurance_policies` table referencing `people`, with
status transitions logged as `activities` ("insurance approved" etc.),
and likely a `payments` link (§6c) for premium payments.

### 6g. Press cards / credentials

Would add a `credentials` table (`workspace_id`, `person_id`,
`credential_type`, `issued_at`, `expires_at`, `revoked_at`) — the same
shape as `tickets` (an opaque, verifiable, revocable token tied to a
person), reused rather than reinvented.

### 6h. Communications / mailing

Would add `campaigns` and `message_sends` tables, keyed to
`people.communication_preferences` (already on the table, §2) for
opt-out enforcement, and reusing the localization architecture (§10) so
a campaign can be sent in a person's `preferred_language`. The existing
pluggable `lib/email/*` provider abstraction (console/Resend today) is
already the right shape for this to build on.

## 7. Consent / privacy model — `IMPLEMENTED NOW` (event_administration purpose only)

Table: `consents` (was `registration_consents`), generalized: it now
carries `workspace_id`, `person_id`, `purpose`, `channel`, `status`,
`source`, alongside the original `version`/`language`/`text_snapshot`/
`occurred_at`. Every consent `register_for_event` writes today uses
`purpose = 'event_administration'`, `channel = 'registration_form'`,
`status = 'granted'`, `source = 'public_registration_form'` — the only
purpose this app actually needs.

**No marketing consent is collected, and nothing is pre-checked.** The
brief's other example purposes (`email marketing`, `membership
communications`, `surveys`, `partner communications`) are not
implemented — a future module adds a new `purpose` value to a consent
row, not a new column or a new table.

## 8. Identity vs Workspace roles vs scoped assignments — `IMPLEMENTED NOW` (A+B); scoped assignments `FUTURE`

Three layers, kept deliberately separate (brief §8):

- **A. Identity** — Supabase Auth (`auth.users`). Who can log in at
  all. Unchanged by this refactor.
- **B. Workspace membership** (table: `workspace_members`, was
  `organization_users`) — what a user can do *within one workspace*:
  `OWNER` / `ADMIN` / `CHECKIN_STAFF` (enum `workspace_role`, was
  `org_role`). `lib/authz.ts`'s `PERMISSIONS` table maps each
  permission (`manageEvents`, `exportAttendees`, `checkIn`,
  `manageMembers`) to the roles allowed to do it — unchanged shape from
  before the refactor, just renamed.
- **C. Scoped/module assignments** — `FUTURE`. Not a global enum: a
  `JURY_MEMBER` or `PROGRAM_MANAGER` role would live on a
  module-specific join table scoped to one resource (e.g.
  `jury_assignments.call_id`), never as a value alongside
  `OWNER`/`ADMIN`/`CHECKIN_STAFF` in `workspace_role`. This is what
  lets one `Person` be, simultaneously: a normal CRM contact, an event
  participant, a representative of one CRM Organization, and a jury
  member for one specific Call — without duplicating their `people`
  row or bloating `workspace_role` with every role any module will ever
  need. See §6b for the concrete jury/reviewer shape.

## 9. Multi-tenancy and RLS — `IMPLEMENTED NOW`

Every tenant-owned table — `events`, `people`, `crm_organizations`,
`person_organization_relationships`, `activities`, `consents`,
`registrations`, and (via their parent event) `tickets`/`checkins` —
carries RLS scoped through `is_workspace_member(workspace_id)` /
`is_workspace_admin(workspace_id)` (renamed from
`is_org_member`/`is_org_admin`, same logic). This is the hard backstop
against cross-tenant reads regardless of application bugs; role-specific
write restrictions beyond that baseline are enforced in `lib/authz.ts`
for friendlier error handling than a bare RLS denial gives.

**Workspace provisioning stays exactly as locked down as before this
refactor** (brief §17: "Do not re-enable public Workspace creation."):
`workspaces` has no insert policy for any client role, and
`create_workspace_with_owner` (was `create_organization_with_owner`) is
still `service_role`-only, still takes an explicit, validated
`p_owner_user_id` rather than trusting `auth.uid()`. See
`supabase/INTEGRATION_TESTS.md` §9 for the concrete checks that prove
this.

The CRM core tables (`people`, `crm_organizations`,
`person_organization_relationships`) get ordinary admin-writable RLS
policies (`is_workspace_admin(workspace_id)` for insert/update) —
unlike workspace creation, these are plain tenant-scoped business
records, not a privileged provisioning operation, so a normal RLS
policy is the right and sufficient control (see the policy comments in
`0002_platform_refactor.sql`).

## 10. Localization — `IMPLEMENTED NOW`

Unchanged architecture (`lib/i18n/*`, cookie-based locale resolution,
no URL locale prefixes, `Dictionary` type enforcing key parity between
`en.ts`/`uk.ts`). `people.preferred_language` (was
`attendees.preferred_language`) is the same `ui_language` enum,
supporting exactly the same two values. Event content localization
(`event_language`: `uk`/`en`/`bilingual`) is untouched by this
refactor. See `README.md`'s "Internationalization" section, which still
applies.

FUTURE modules (campaigns, application forms, automated messages, §6h)
would resolve language the same way — reading a `Person`'s
`preferred_language` and using the existing dictionary architecture —
rather than inventing a second localization mechanism, per brief §13.

## 11. Future Community module — see §6a
## 12. Future Programs/Grants/Jury module — see §6b
## 13. Future Payments module — see §6c
## 14. Future Cases/Assistance module — see §6d
## 15. Future Assets/Equipment module — see §6e
## 16. Future Insurance module — see §6f
## 17. Future Credentials/Press Cards module — see §6g
## 18. Future Communications module — see §6h

## 19. Scaling strategy — `IMPLEMENTED NOW` (indexes) / `FUTURE` (infrastructure)

No microservices, no new infrastructure — PostgreSQL/Supabase remains
the single primary database, as instructed. What this refactor adds for
scale, all `IMPLEMENTED NOW`:

- `people_workspace_id_idx` and the composite
  `people_workspace_email_idx (workspace_id, normalized_email)` — every
  real lookup is "this email, in this workspace" (the `register_for_event`
  dedup check, and any future contact search), so a composite index
  serves that directly instead of Postgres combining two single-column
  indexes per query.
- `registrations_workspace_id_idx`, `registrations_event_id_idx`,
  `registrations_person_id_idx` — the three access patterns the
  dashboard and RPCs actually use (list by event, look up a person's
  registrations, tenant-scope by workspace).
- `activities_person_id_idx` is `(person_id, occurred_at desc)` — a
  future "show this person's timeline" view is a single index scan in
  the order it needs, not a sort at query time.
- `crm_organizations_workspace_id_idx`,
  `person_org_rel_workspace_id_idx`/`person_id_idx`/`organization_id_idx`,
  `consents_workspace_id_idx`/`person_id_idx` — the same tenant-scoping
  pattern applied consistently to every new table, not just the ones
  Events happens to touch today.

`FUTURE`: at genuinely large contact-database scale, `people` search
(name/email/tags) would eventually want a dedicated search index
(Postgres full-text or an external index) rather than `ILIKE` scans —
not needed at MVP scale and not built now. Pagination is already the
pattern for the attendee list (`lib/server/attendees.ts` loads one
event's registrations, never the whole table); a future workspace-wide
contact directory would need the same discipline. `perform_checkin`'s
row-lock-free `ON CONFLICT`-based concurrency (unchanged from before
this refactor) and `register_for_event`'s `for update` event-row lock
remain the atomic/race-safe primitives future high-traffic paths should
copy rather than inventing ad hoc locking.

## 20. Data deletion / export / privacy considerations — `IMPLEMENTED NOW` (schema shape) / `FUTURE` (UI/automation)

`IMPLEMENTED NOW`: every table this refactor adds is a plain row keyed
by `id` with `on delete cascade` from its workspace (and, for
`registrations`/`activities`/`consents`, from `people`) — so a person or
workspace can be deleted cleanly today via direct SQL, with no orphaned
rows, without a bespoke script per table. Consent records
(`consents.purpose`/`status`/`occurred_at`/`text_snapshot`) already
give an audit trail sufficient to answer "what did this person consent
to, when, and in what language" per row.

`FUTURE`: no self-service "export my data" or "delete my data" UI/API
exists yet; no automated retention/anonymization job exists. Building
one would iterate `activities`/`consents`/`registrations` for a given
`person_id` across every module that has since attached to it, which
`activities`' polymorphic-but-typed shape (`activity_type` +
`subject_type`) is specifically meant to make enumerable rather than
requiring a new query per module.
