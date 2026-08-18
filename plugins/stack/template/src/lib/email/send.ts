import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * The ONE way to send email. Picks the transport from env:
 *   - RESEND_API_KEY set  → Resend (production)
 *   - SMTP_URL set        → SMTP (Mailpit locally: http://localhost:8025)
 * Callers never care which. Long-running / bulk sends should go through the
 * `email.send` job (src/lib/jobs) rather than calling this inline.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const log = logger.child({ module: "email", to: message.to, subject: message.subject });

  if (env.RESEND_API_KEY) {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: env.EMAIL_FROM, ...message });
    if (error) {
      log.error({ err: error }, "email.send.failed");
      throw new Error(`Resend failed: ${error.message}`);
    }
    log.info("email.sent");
    return;
  }

  if (env.SMTP_URL) {
    const transport = nodemailer.createTransport(env.SMTP_URL);
    await transport.sendMail({ from: env.EMAIL_FROM, ...message });
    log.info("email.sent");
    return;
  }

  throw new Error("No email transport configured: set SMTP_URL (dev) or RESEND_API_KEY (prod)");
}
