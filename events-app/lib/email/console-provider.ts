import type { EmailMessage, EmailProvider } from "./types";

/** Default provider: logs the email instead of sending it. Safe for local dev. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[email:console] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
    );
  }
}
