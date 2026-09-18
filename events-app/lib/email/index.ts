import "server-only";
import type { EmailProvider } from "./types";
import { ConsoleEmailProvider } from "./console-provider";
import { ResendEmailProvider } from "./resend-provider";

export type { EmailMessage, EmailProvider } from "./types";

/**
 * Picks the configured provider at call time (not module load time) so
 * tests and different environments can rely on env vars alone.
 */
export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error(
        "EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM",
      );
    }
    return new ResendEmailProvider(apiKey, from);
  }

  return new ConsoleEmailProvider();
}
