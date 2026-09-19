import { getPlatformLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/client";
import { setPlatformLocale } from "@/lib/i18n/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const locale = await getPlatformLocale();
  const dict = getDictionary(locale);

  return (
    <I18nProvider locale={locale} dict={dict}>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl italic">{dict.auth.resetPasswordTitle}</h1>
          <LanguageSwitcher locale={locale} setLocale={setPlatformLocale} />
        </div>
        <ResetPasswordForm />
      </main>
    </I18nProvider>
  );
}
