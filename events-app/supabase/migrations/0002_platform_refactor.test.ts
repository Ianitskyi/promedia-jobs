import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * These are structural regression guards on the migration's SQL
 * source text, not proof of database behavior — Vitest cannot run
 * real PostgreSQL. The actual constraint/concurrency/atomicity
 * behavior these guard against regressing was verified for real,
 * against a local Postgres 16 instance, during the review that added
 * them; see supabase/INTEGRATION_TESTS.md §3 and §12 for exactly what
 * was run and what it proved. The point of these tests is narrower:
 * catch a future edit that silently deletes or weakens one of these
 * fixes (e.g. someone "simplifying" register_for_event back to a
 * plain SELECT-then-INSERT) before it ships, by failing fast on the
 * text of the fix itself.
 */
const source = readFileSync(
  fileURLToPath(new URL("./0002_platform_refactor.sql", import.meta.url)),
  "utf8",
);

describe("0002_platform_refactor.sql — person find-or-create concurrency", () => {
  it("uses INSERT ... ON CONFLICT DO NOTHING for the people find-or-create, not a plain SELECT-then-INSERT", () => {
    expect(source).toMatch(
      /insert into people[\s\S]*?on conflict \(workspace_id, normalized_email\) do nothing/,
    );
  });

  it("falls back to a SELECT only when the INSERT found an existing row (v_person_id is null)", () => {
    expect(source).toMatch(/if v_person_id is null then\s*\n\s*select id into v_person_id/);
  });
});

describe("0002_platform_refactor.sql — cross-workspace referential integrity", () => {
  const compositeForeignKeys = [
    "foreign key (event_id, workspace_id) references events(id, workspace_id)",
    "foreign key (person_id, workspace_id) references people(id, workspace_id)",
    "foreign key (organization_id, workspace_id) references crm_organizations(id, workspace_id)",
    "foreign key (registration_id, event_id) references registrations(id, event_id)",
  ];

  it.each(compositeForeignKeys)("declares the composite foreign key: %s", (fk) => {
    expect(source).toContain(fk);
  });

  it("gives every composite-FK target table a matching composite unique constraint", () => {
    expect(source).toContain("unique (id, workspace_id)"); // people, crm_organizations, events
    expect(source).toContain("unique (id, event_id)"); // registrations
  });

  it("drops consents' plain single-column person_id foreign key before replacing it with the composite one", () => {
    expect(source).toContain("alter table consents drop constraint consents_person_id_fkey");
    expect(source).toContain("consents_person_workspace_fkey");
  });
});

describe("0002_platform_refactor.sql — migration atomicity", () => {
  it("wraps the entire migration in an explicit transaction", () => {
    const trimmed = source.trim();
    expect(trimmed.startsWith("-- ProMedia Platform refactor")).toBe(true);
    expect(source).toMatch(/^\s*begin;\s*$/m);
    expect(trimmed.endsWith("commit;")).toBe(true);
  });
});
