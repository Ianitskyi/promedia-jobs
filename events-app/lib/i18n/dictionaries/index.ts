import en from "./en";
import uk from "./uk";
import type { Locale } from "@/lib/i18n/locale";
import type { Dictionary } from "./types";

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { en, uk };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export { en, uk };
