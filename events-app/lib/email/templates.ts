import type { Dictionary } from "@/lib/i18n/dictionaries";

export interface TicketEmailInput {
  organizationName: string;
  eventName: string;
  attendeeFirstName: string;
  attendeeLastName: string;
  dateLabel: string;
  venueName: string | null;
  ticketUrl: string;
  qrDataUrl: string;
}

/**
 * Renders the ticket confirmation email in a single language — the
 * attendee's own (`attendees.preferred_language`), never a combined
 * bilingual email. `dict` must already be resolved to that language by
 * the caller (lib/server/ticket-email.ts).
 */
export function buildTicketEmail(
  dict: Dictionary,
  input: TicketEmailInput,
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${dict.ticket.subject} — ${input.eventName}`;

  const text = [
    dict.ticket.emailThankYou,
    "",
    `${input.attendeeFirstName} ${input.attendeeLastName}`,
    input.eventName,
    input.dateLabel,
    input.venueName ?? "",
    "",
    `${dict.ticket.emailViewTicket}: ${input.ticketUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #14140f;">
      <p style="color:#6b6b63; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase;">${escapeHtml(input.organizationName)}</p>
      <h1 style="font-size: 20px; margin: 8px 0 16px;">${escapeHtml(dict.ticket.emailThankYou)}</h1>
      <p style="margin: 0 0 4px; font-weight: 600;">${escapeHtml(input.attendeeFirstName)} ${escapeHtml(input.attendeeLastName)}</p>
      <p style="margin: 0 0 4px;">${escapeHtml(input.eventName)}</p>
      <p style="margin: 0 0 4px; color:#6b6b63;">${escapeHtml(input.dateLabel)}</p>
      ${input.venueName ? `<p style="margin: 0 0 16px; color:#6b6b63;">${escapeHtml(input.venueName)}</p>` : ""}
      <img src="${input.qrDataUrl}" alt="${escapeHtml(dict.ticket.qrAlt)}" width="220" height="220" style="display:block; margin: 24px 0;" />
      <a href="${input.ticketUrl}" style="display:inline-block; background:#14140f; color:#ffffff; padding: 12px 20px; text-decoration:none; font-size: 14px;">${escapeHtml(dict.ticket.emailViewTicket)}</a>
      <p style="margin-top: 24px; font-size: 12px; color:#6b6b63;">${escapeHtml(dict.ticket.emailFallbackLinkPrefix)} ${input.ticketUrl}</p>
    </div>
  `.trim();

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
