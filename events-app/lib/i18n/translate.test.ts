import { describe, it, expect } from "vitest";
import { t, interpolate } from "./translate";
import { en, uk } from "./dictionaries";
import type { Dictionary } from "./dictionaries";

describe("t (dot-path translation lookup)", () => {
  it("resolves an existing key from the given dictionary", () => {
    expect(t(uk, "common.save")).toBe(uk.common.save);
    expect(t(en, "common.save")).toBe(en.common.save);
    expect(t(uk, "common.save")).not.toBe(t(en, "common.save"));
  });

  it("interpolates {vars} into the resolved string", () => {
    expect(t(en, "kiosk.welcome", { name: "Andrii" })).toBe("✓ Welcome, Andrii!");
    expect(t(uk, "kiosk.welcome", { name: "Андрій" })).toBe("✓ Ласкаво просимо, Андрій!");
  });

  it("falls back to English when the key is missing from the given dictionary", () => {
    // Simulates a dictionary that hasn't caught up with a new key yet —
    // a real, not just theoretical, situation for a two-locale app
    // maintained by hand.
    const incomplete = structuredClone(uk) as Omit<typeof uk, "common"> & {
      common: Partial<typeof uk.common>;
    };
    delete incomplete.common.save;
    expect(t(incomplete as unknown as Dictionary, "common.save")).toBe(en.common.save);
  });

  it("falls back to the literal path when the key is missing from every dictionary", () => {
    expect(t(en, "does.not.exist")).toBe("does.not.exist");
    expect(t(uk, "does.not.exist")).toBe("does.not.exist");
  });

  it("never throws for a malformed or empty path", () => {
    expect(() => t(en, "")).not.toThrow();
    expect(() => t(en, "common")).not.toThrow(); // resolves to an object, not a string
    expect(t(en, "common")).toBe("common"); // falls back to the path itself, not the object
  });
});

describe("interpolate", () => {
  it("replaces every occurrence of a placeholder", () => {
    expect(interpolate("{a}-{a}-{b}", { a: "x", b: "y" })).toBe("x-x-y");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(interpolate("{unknown}", {})).toBe("{unknown}");
  });
});
