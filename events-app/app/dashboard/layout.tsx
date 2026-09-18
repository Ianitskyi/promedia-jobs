import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFirstMembership } from "@/lib/authz";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/login/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const membership = await getFirstMembership();

  if (!membership) {
    redirect("/dashboard/onboarding");
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, primary_color")
    .eq("id", membership.organizationId)
    .single();

  if (!organization) {
    redirect("/dashboard/onboarding");
  }

  const accentStyle = organization.primary_color
    ? ({ "--accent": organization.primary_color } as React.CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-screen flex-col" style={accentStyle}>
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard/events" className="flex items-center gap-3">
            <Logo name={organization.name} logoUrl={organization.logo_url} />
            <span className="font-serif text-lg italic">{organization.name}</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard/events" className="hover:underline">
              Events
            </Link>
            <span className="text-muted" aria-hidden="true">
              {membership.role}
            </span>
            <form action={signOut}>
              <button type="submit" className="text-muted hover:text-foreground hover:underline">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
    </div>
  );
}
