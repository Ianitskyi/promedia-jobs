import { describe, it, expect } from "vitest";
import { ticketUrl } from "./url";

describe("ticketUrl — QR token identity is language-independent", () => {
  it("is a pure function of the token alone — no locale parameter exists to pass", () => {
    // Documents the invariant from ARCHITECTURE.md/§10 of the i18n
    // brief: the QR/ticket URL can never encode or depend on a
    // language, because ticketUrl() has nowhere to put one. Same
    // ticket, same URL, regardless of which language the ticket page
    // is later viewed in.
    expect(ticketUrl.length).toBe(1);
  });

  it("produces an identical URL for the same token on repeated calls", () => {
    const token = "A".repeat(43);
    expect(ticketUrl(token)).toBe(ticketUrl(token));
  });

  it("the URL contains only the token, not any language marker", () => {
    const token = "B".repeat(43);
    const url = ticketUrl(token);
    expect(url.endsWith(`/t/${token}`)).toBe(true);
    expect(url).not.toMatch(/\/(uk|en)\//);
  });

  it("different tokens never collide", () => {
    const a = ticketUrl("A".repeat(43));
    const b = ticketUrl("B".repeat(43));
    expect(a).not.toBe(b);
  });
});
