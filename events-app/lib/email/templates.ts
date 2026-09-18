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

export function buildTicketEmail(input: TicketEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your ticket — ${input.eventName}`;

  const text = [
    "Thank you for registering.",
    "",
    `${input.attendeeFirstName} ${input.attendeeLastName}`,
    input.eventName,
    input.dateLabel,
    input.venueName ?? "",
    "",
    `View your ticket: ${input.ticketUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #14140f;">
      <p style="color:#6b6b63; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase;">${escapeHtml(input.organizationName)}</p>
      <h1 style="font-size: 20px; margin: 8px 0 16px;">Thank you for registering</h1>
      <p style="margin: 0 0 4px; font-weight: 600;">${escapeHtml(input.attendeeFirstName)} ${escapeHtml(input.attendeeLastName)}</p>
      <p style="margin: 0 0 4px;">${escapeHtml(input.eventName)}</p>
      <p style="margin: 0 0 4px; color:#6b6b63;">${escapeHtml(input.dateLabel)}</p>
      ${input.venueName ? `<p style="margin: 0 0 16px; color:#6b6b63;">${escapeHtml(input.venueName)}</p>` : ""}
      <img src="${input.qrDataUrl}" alt="Your ticket QR code" width="220" height="220" style="display:block; margin: 24px 0;" />
      <a href="${input.ticketUrl}" style="display:inline-block; background:#14140f; color:#ffffff; padding: 12px 20px; text-decoration:none; font-size: 14px;">View your ticket</a>
      <p style="margin-top: 24px; font-size: 12px; color:#6b6b63;">If the button doesn't work, use this link: ${input.ticketUrl}</p>
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
