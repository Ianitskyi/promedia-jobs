import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * RegistrationForm is a "use client" component built on useActionState,
 * which this repo cannot render directly (no jsdom/testing-library —
 * see lib/testing/react-tree.ts's own comment). These are structural
 * regression guards on the source itself, verifying the specific
 * mechanisms that make preview mode unable to create a real
 * registration, rather than the component's rendered DOM output.
 * The *wiring* of preview mode (that the preview page passes
 * `preview` and no `action`) is covered separately in
 * app/dashboard/events/[eventId]/preview/page.test.ts, which can
 * inspect the un-rendered element tree without invoking hooks.
 */
const source = readFileSync(fileURLToPath(new URL("./RegistrationForm.tsx", import.meta.url)), "utf8");

describe("RegistrationForm — preview mode never creates a real registration", () => {
  it("never wires the real register() action to useActionState in preview mode", () => {
    expect(source).toMatch(/useActionState\(\s*\n?\s*props\.preview \? previewNoopAction : props\.action/);
  });

  it("defines previewNoopAction as a pure pass-through that never calls a server action", () => {
    expect(source).toMatch(/async function previewNoopAction\(prev: RegisterFormState\): Promise<RegisterFormState> \{\s*\n\s*return prev;\s*\n\s*\}/);
  });

  it("prevents the native form submission outright when preview is true", () => {
    expect(source).toMatch(/function handleSubmit[\s\S]*?if \(props\.preview\)[\s\S]*?event\.preventDefault\(\)/);
  });

  it("wires onSubmit={handleSubmit} on the form so the preventDefault guard actually runs", () => {
    expect(source).toMatch(/<form action=\{formAction\} onSubmit=\{handleSubmit\}/);
  });

  it("disables the submit button in preview mode, not just while pending", () => {
    expect(source).toMatch(/disabled=\{pending \|\| props\.preview\}/);
  });

  it("renders the localized preview notice only when preview is true", () => {
    expect(source).toMatch(/\{props\.preview && \([\s\S]*?dict\.registration\.previewNotice/);
  });

  it("the type signature makes `action` impossible to pass alongside `preview: true`", () => {
    expect(source).toMatch(/preview: true;\s*\n\s*action\?: undefined;/);
  });
});
