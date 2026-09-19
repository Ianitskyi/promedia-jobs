"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/locale";

interface LanguageSwitcherProps {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  className?: string;
}

/**
 * Generic UA | EN toggle. What it changes depends entirely on which
 * server action is passed in as `setLocale` — the platform locale, the
 * public/attendee locale for a bilingual event, or a kiosk station's
 * locale all use this same component with a different action.
 */
export function LanguageSwitcher({ locale, setLocale, className = "" }: LanguageSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Language / Мова"
      className={`inline-flex items-center gap-1.5 text-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => choose("uk")}
        aria-pressed={locale === "uk"}
        disabled={pending}
        className={locale === "uk" ? "font-semibold text-foreground" : "text-muted hover:text-foreground"}
      >
        UA
      </button>
      <span aria-hidden="true" className="text-muted">
        |
      </span>
      <button
        type="button"
        onClick={() => choose("en")}
        aria-pressed={locale === "en"}
        disabled={pending}
        className={locale === "en" ? "font-semibold text-foreground" : "text-muted hover:text-foreground"}
      >
        EN
      </button>
    </div>
  );
}
