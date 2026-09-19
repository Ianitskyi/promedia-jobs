import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/client";
import { setPlatformLocale } from "@/lib/i18n/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);
  const { mode } = await searchParams;
  const initialMode = mode === "signup" ? "signup" : "signin";

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <div className="flex items-center justify-between">
          <h1>
            {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no responsive sizing needed */}
            <img
              src="/brand/promedia-wordmark.svg"
              alt={dict.auth.signInTitle}
              className="h-9 w-auto"
            />
          </h1>
          <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
        </div>
        <LoginForm initialMode={initialMode} />
      </main>
    </I18nProvider>
  );
}
