import { en } from "./dictionaries";
import type { Dictionary } from "./dictionaries";

function getPath(dict: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
      dict,
    );
}

/**
 * Dot-path translation lookup for the handful of call sites that need
 * a dynamic key (e.g. a scanner result state used as `scanner.state${State}`).
 * Static call sites should prefer direct property access on a typed
 * `Dictionary` (`dict.events.title`) — it's compile-checked and needs
 * no runtime lookup at all. This function exists for the dynamic case,
 * and its fallback chain (locale -> English -> the literal path string)
 * is what keeps a key that's missing from one dictionary from ever
 * rendering blank or throwing.
 */
export function t(dict: Dictionary, path: string, vars?: Record<string, string>): string {
  const fromDict = getPath(dict, path);
  const resolved =
    typeof fromDict === "string" ? fromDict : typeof getPath(en, path) === "string" ? (getPath(en, path) as string) : path;

  if (!vars) return resolved;
  return Object.entries(vars).reduce(
    (str, [key, value]) => str.replaceAll(`{${key}}`, value),
    resolved,
  );
}

/** Interpolates `{var}` placeholders into an already-resolved string. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((str, [key, value]) => str.replaceAll(`{${key}}`, value), template);
}
