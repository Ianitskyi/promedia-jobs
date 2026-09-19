import type { EmailMessage, EmailProvider } from "./types";

/**
 * Sends via Resend's HTTP API directly (no SDK dependency — keeps the
 * app's footprint small and the provider swappable for one more fetch
 * call to Postmark/SES/SMTP-over-HTTP later).
 */
export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend send failed (${response.status}): ${body}`);
    }
  }
}
