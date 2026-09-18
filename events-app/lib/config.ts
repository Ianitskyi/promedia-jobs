/**
 * Whether any signed-in user can bootstrap a brand-new organization
 * through /dashboard/onboarding. Defaults to OFF.
 *
 * The product is moving to controlled organization provisioning
 * (platform-admin invitations) — self-service creation is a stopgap
 * for local development and initial setup, not the intended long-term
 * mechanism, so it stays opt-in rather than on by default. See the
 * SECURITY note on create_organization_with_owner in
 * supabase/migrations/0001_init.sql and ARCHITECTURE.md §7a for the
 * full picture, including why this app-level gate isn't (yet) a
 * database-level one.
 */
export function isSelfServiceOrgCreationEnabled(): boolean {
  return process.env.ALLOW_SELF_SERVICE_ORG_CREATION === "true";
}
