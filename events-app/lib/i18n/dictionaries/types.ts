import type en from "./en";

type DeepString<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

/**
 * The dictionary shape, derived from the English file (the canonical
 * source and fallback language — see translate.ts). `en`'s own literal
 * (`as const`) string types are widened to `string` here so every other
 * locale's dictionary just needs matching *keys*, not identical text.
 * A key present in code but missing from a non-English dictionary is
 * still a compile error, not a silent runtime gap — the *runtime*
 * fallback in translate.ts exists for the dynamic (string-path)
 * lookups that bypass this static check.
 */
export type Dictionary = DeepString<typeof en>;
