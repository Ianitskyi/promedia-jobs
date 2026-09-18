import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFirstMembership } from "@/lib/authz";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/client";
import { setPlatformLocale } from "@/lib/i18n/actions";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { signOut } from "@/app/login/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);
  const membership = await getFirstMembership();

  // No org yet (e.g. a brand-new user on /dashboard/onboarding): render
  // a minimal, unbranded chrome instead of redirecting. Pages that
  // require an organization (the events area) already redirect to
  // /dashboard/onboarding themselves — redirecting here too, for a
  // request that might *be* /dashboard/onboarding, would loop forever.
  if (!membership) {
    return (
      <I18nProvider locale={locale} dict={dict}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[var(--border)]">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <span className="font-serif text-lg italic">{dict.common.appName}</span>
              <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
            </div>
          </header>
          <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
        </div>
      </I18nProvider>
    );
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url, primary_color")
    .eq("id", membership.organizationId)
    .single();

  if (!organization) {
    return (
      <I18nProvider locale={locale} dict={dict}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[var(--border)]">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <span className="font-serif text-lg italic">{dict.common.appName}</span>
              <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
            </div>
          </header>
          <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
        </div>
      </I18nProvider>
    );
  }

  const accentStyle = organization.primary_color
    ? ({ "--accent": organization.primary_color } as React.CSSProperties)
    : undefined;

  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="flex min-h-screen flex-col" style={accentStyle}>
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/dashboard/events" className="flex items-center gap-3">
              <Logo name={organization.name} logoUrl={organization.logo_url} />
              <span className="font-serif text-lg italic">{organization.name}</span>
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
