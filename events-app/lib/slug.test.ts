import { describe, it, expect } from "vitest";
import { slugify, withRandomSuffix } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Summer Lab 2027")).toBe("summer-lab-2027");
  });

  it("strips punctuation", () => {
    expect(slugify("Summer Lab 2027!")).toBe("summer-lab-2027");
  });

  it("collapses accents to ascii", () => {
    expect(slugify("Café Résumé")).toBe("cafe-resume");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --Hello--  ")).toBe("hello");
  });
});

describe("withRandomSuffix", () => {
  it("appends a suffix after the base slug", () => {
    const result = withRandomSuffix("summer-lab");
    expect(result).toMatch(/^summer-lab-[a-z0-9]{4}$/);
  });

  it("produces different values across calls (collision resolution)", () => {
    const a = withRandomSuffix("event");
    const b = withRandomSuffix("event");
    // Astronomically unlikely to collide; if this ever flakes, the
    // random suffix generator itself is broken.
    expect(a).not.toBe(b);
  });
});
