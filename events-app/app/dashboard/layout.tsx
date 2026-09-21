import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFirstMembership } from "@/lib/authz";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/client";
import { setPlatformLocale } from "@/lib/i18n/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { signOut } from "@/app/login/actions";

/**
 * Persistent product identity — ProMedia Events is the product; the
 * workspace (rendered separately, secondary, by the caller) is the
 * tenant using it. The two must never be conflated (brief: "Auth User
 * ≠ Person ≠ CRM Organization ≠ Workspace"; the product itself is a
 * further, distinct concept again). The product name is real visible
 * text here, not only the wordmark's alt text.
 */
export function ProMediaBrand({ dict }: { dict: Dictionary }) {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no responsive sizing needed */}
      <img src="/brand/promedia-wordmark.svg" alt="" aria-hidden="true" className="h-5 w-auto" />
      <span className="heading-display text-base leading-none">{dict.common.appName}</span>
    </span>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);
  const membership = await getFirstMembership();

  // No workspace yet (e.g. a brand-new user on /dashboard/onboarding):
  // render a minimal chrome instead of redirecting. Pages that require
  // a workspace (the events area) already redirect to
  // /dashboard/onboarding themselves — redirecting here too, for a
  // request that might *be* /dashboard/onboarding, would loop forever.
  // The product identity is still shown — there's just no workspace
  // line under it yet.
  if (!membership) {
    return (
      <I18nProvider locale={locale} dict={dict}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[var(--border)]">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/dashboard/events">
                <ProMediaBrand dict={dict} />
              </Link>
              <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
            </div>
          </header>
          <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
        </div>
      </I18nProvider>
    );
  }

  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug, logo_url, primary_color")
    .eq("id", membership.workspaceId)
    .single();

  if (!workspace) {
    return (
      <I18nProvider locale={locale} dict={dict}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[var(--border)]">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/dashboard/events">
                <ProMediaBrand dict={dict} />
              </Link>
              <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
            </div>
          </header>
          <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
        </div>
      </I18nProvider>
    );
  }

  const accentStyle = workspace.primary_color
    ? ({ "--accent": workspace.primary_color } as React.CSSProperties)
    : undefined;

  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="flex min-h-screen flex-col" style={accentStyle}>
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            {/* Product identity first and primary; workspace identity
                directly under it, visibly secondary (smaller, muted) —
                "I am using ProMedia Events" / "I am working in the
                {workspace} workspace" must both read at a glance. */}
            <Link href="/dashboard/events" className="flex flex-col gap-0.5">
              <ProMediaBrand dict={dict} />
              <span className="text-xs text-muted leading-none">
                {dict.dashboard.workspaceLabel}: {workspace.name}
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard/events" className="hover:underline">
                {dict.dashboard.navEvents}
              </Link>
              <span className="text-muted" aria-hidden="true">
                {membership.role}
              </span>
              <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
              <form action={signOut}>
                <button type="submit" className="text-muted hover:text-foreground hover:underline">
                  {dict.common.signOut}
                </button>
              </form>
            </nav>
          </div>
        </header>
        <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
      </div>
    </I18nProvider>
  );
}
