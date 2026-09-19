import Link from "next/link";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { setPlatformLocale } from "@/lib/i18n/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/Button";

export default async function HomePage() {
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <div className="flex items-start justify-between">
        <h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no responsive sizing needed */}
          <img src="/brand/promedia-wordmark.svg" alt={dict.common.appName} className="h-9 w-auto" />
        </h1>
        <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
      </div>
      <p className="mt-4 max-w-md text-muted">{dict.common.tagline}</p>
      <div className="mt-8 flex gap-3">
        <Link href="/login">
          <Button>{dict.common.organizerSignIn}</Button>
        </Link>
      </div>
    </main>
  );
}
