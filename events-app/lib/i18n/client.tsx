"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dictionary } from "./dictionaries";
import { t as translate } from "./translate";
import type { Locale } from "./locale";

interface I18nContextValue {
  locale: Locale;
  dict: Dictionary;
  /** Dynamic-key lookup with the same locale-then-English-then-path fallback as the server-side `t()`. */
  t: (path: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Makes the resolved locale + dictionary available to Client
 * Components. Always rendered by a Server Component parent that
 * already resolved `locale`/`dict` from the right cookie (platform,
 * public, or kiosk) — this provider does no locale resolution of its
 * own, it only distributes what the server already decided.
 */
export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dict,
      t: (path, vars) => translate(dict, path, vars),
    }),
    [locale, dict],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n() must be used within an <I18nProvider>.");
  }
  return ctx;
}
