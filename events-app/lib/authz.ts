import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/database.types";

export interface CurrentMembership {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

/**
 * Roles allowed to perform a given action. Adding a role later is a
 * one-line enum change (database.types.ts + the SQL enum) plus updating
 * the relevant row here — call sites never hardcode role names.
 */
const PERMISSIONS = {
  manageEvents: ["OWNER", "ADMIN"],
  exportAttendees: ["OWNER", "ADMIN"],
  checkIn: ["OWNER", "ADMIN", "CHECKIN_STAFF"],
  manageMembers: ["OWNER", "ADMIN"],
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Loads the signed-in user's membership for a specific workspace.
 * Returns null if the user isn't signed in or isn't a member — callers
 * decide whether that's a redirect or a 403.
 */
export async function getMembership(
  workspaceId: string,
): Promise<CurrentMembership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;
  return { userId: user.id, workspaceId, role: data.role };
}

/** First workspace membership for the signed-in user, if any. */
export async function getFirstMembership(): Promise<CurrentMembership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { userId: user.id, workspaceId: data.workspace_id, role: data.role };
}

export function can(role: WorkspaceRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly WorkspaceRole[] | undefined;
  return allowedRoles?.includes(role) ?? false;
}

/**
 * Server Component / Server Action guard: redirects to login if
 * unauthenticated, or to the dashboard home with an error if the user
 * lacks the permission. Use at the top of any route/action that
 * mutates or reads role-gated data.
 */
export async function requirePermission(
  workspaceId: string,
  permission: Permission,
): Promise<CurrentMembership> {
  const membership = await getMembership(workspaceId);
  if (!membership) {
    redirect("/login");
  }
  if (!can(membership.role, permission)) {
    redirect("/dashboard?error=forbidden");
  }
  return membership;
}
