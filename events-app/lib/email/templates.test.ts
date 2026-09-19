import { describe, it, expect } from "vitest";
import { buildTicketEmail } from "./templates";
import { en, uk } from "@/lib/i18n/dictionaries";

const BASE_INPUT = {
  organizationName: "ProMedia",
  eventName: "Summer Camp",
  attendeeFirstName: "Andrii",
  attendeeLastName: "Ianitskyi",
  dateLabel: "June 15, 2026, 9:00 AM",
  venueName: "Main Hall",
  ticketUrl: "https://events.example.com/t/" + "A".repeat(43),
  qrDataUrl: "data:image/png;base64,xyz",
};

describe("buildTicketEmail — confirmation email language", () => {
  it("renders entirely in English when given the English dictionary", () => {
    const { subject, text, html } = buildTicketEmail(en, BASE_INPUT);
    expect(subject).toContain(en.ticket.subject);
    expect(text).toContain(en.ticket.emailThankYou);
    expect(text).toContain(en.ticket.emailViewTicket);
    expect(html).toContain(en.ticket.emailThankYou);
  });

  it("renders entirely in Ukrainian when given the Ukrainian dictionary", () => {
    const { subject, text, html } = buildTicketEmail(uk, BASE_INPUT);
    expect(subject).toContain(uk.ticket.subject);
    expect(text).toContain(uk.ticket.emailThankYou);
    expect(text).toContain(uk.ticket.emailViewTicket);
    expect(html).toContain(uk.ticket.emailThankYou);
  });

  it("never mixes languages in a single email (no combined uk+en send)", () => {
    const enResult = buildTicketEmail(en, BASE_INPUT);
    expect(enResult.text).not.toContain(uk.ticket.emailThankYou);
    expect(enResult.html).not.toContain(uk.ticket.emailThankYou);

    const ukResult = buildTicketEmail(uk, BASE_INPUT);
    expect(ukResult.text).not.toContain(en.ticket.emailThankYou);
    expect(ukResult.html).not.toContain(en.ticket.emailThankYou);
  });

  it("always includes the attendee-facing content (name, event, ticket URL) regardless of language", () => {
    for (const dict of [en, uk]) {
      const { text, html } = buildTicketEmail(dict, BASE_INPUT);
      expect(text).toContain("Andrii Ianitskyi");
      expect(text).toContain(BASE_INPUT.ticketUrl);
      expect(html).toContain(BASE_INPUT.ticketUrl);
    }
  });

  it("escapes HTML in attendee-supplied fields regardless of language", () => {
    const { html } = buildTicketEmail(en, {
      ...BASE_INPUT,
      attendeeFirstName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
