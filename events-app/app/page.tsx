import Link from "next/link";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { setPlatformLocale } from "@/lib/i18n/actions";
import { I18nProvider } from "@/lib/i18n/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/Button";

/**
 * Public landing page for ProMedia Events. Both CTAs route into the
 * existing single auth flow at /login (see app/login/page.tsx +
 * components/LoginForm.tsx) — "Create account" opens it in its signup
 * state via `?mode=signup` rather than duplicating a second auth form.
 */
export default async function HomePage() {
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);

  const capabilities = [
    dict.landing.capabilityRegistration,
    dict.landing.capabilityQrTickets,
    dict.landing.capabilityCheckIn,
    dict.landing.capabilityExport,
  ];

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12 sm:py-16">
        <div className="flex items-center justify-between gap-3">
          <h1>
            {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no responsive sizing needed */}
            <img
              src="/brand/promedia-wordmark.svg"
              alt={dict.landing.title}
              className="h-9 w-auto"
            />
          </h1>
          <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
        </div>

        <p className="mt-10 max-w-xl text-lg text-foreground">{dict.landing.description}</p>
        <p className="mt-3 max-w-xl text-sm text-muted">{dict.landing.supportingText}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login?mode=signup">
            <Button>{dict.landing.primaryCta}</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">{dict.landing.secondaryCta}</Button>
          </Link>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {capabilities.map((capability) => (
            <div key={capability} className="card px-4 py-4 text-center text-sm font-medium">
              {capability}
            </div>
          ))}
        </div>
      </main>
    </I18nProvider>
  );
}
