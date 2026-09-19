import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("LoginForm", () => {
  it("renders a localized 'forgot password' link to /auth/forgot-password", () => {
    const source = readFileSync(fileURLToPath(new URL("./LoginForm.tsx", import.meta.url)), "utf8");
    expect(source).toMatch(/href="\/auth\/forgot-password"/);
    expect(source).toContain("dict.auth.forgotPasswordLink");
  });
});
