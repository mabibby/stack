import { env } from "@/lib/env";

/**
 * Plain, dependable templates. Each returns subject + html + text.
 * Keep copy short; users skim. Add a template here for every new email.
 */

const layout = (title: string, bodyHtml: string) => `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f6;padding:24px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;color:#111">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    ${bodyHtml}
    <p style="color:#777;font-size:12px;margin-top:32px">Sent by ${appName()}</p>
  </div>
</body></html>`;

const appName = () => env.EMAIL_FROM.replace(/<.*>/, "").trim() || "the app";

export const otpEmail = (
  otp: string,
  purpose: "sign-in" | "email-verification" | "forget-password",
) => {
  const what = {
    "sign-in": "sign in",
    "email-verification": "verify your email",
    "forget-password": "reset your password",
  }[purpose];
  return {
    subject: `${otp} is your ${appName()} code`,
    text: `Use this code to ${what}: ${otp}\nIt expires in 5 minutes.`,
    html: layout(
      `Your code to ${what}`,
      `<p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:16px 0">${otp}</p><p>It expires in 5 minutes. If you didn't request this, ignore this email.</p>`,
    ),
  };
};

export const magicLinkEmail = (url: string) => ({
  subject: `Sign in to ${appName()}`,
  text: `Click to sign in: ${url}\nThis link expires shortly.`,
  html: layout(
    "Sign in",
    `<p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Sign in</a></p><p>Or paste this into your browser:<br>${url}</p>`,
  ),
});

export const resetPasswordEmail = (url: string) => ({
  subject: `Reset your ${appName()} password`,
  text: `Reset your password: ${url}`,
  html: layout(
    "Reset your password",
    `<p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Choose a new password</a></p><p>If you didn't ask for this, you can ignore it.</p>`,
  ),
});

export const welcomeEmail = (name: string) => ({
  subject: `Welcome to ${appName()}`,
  text: `Hi ${name || "there"}, welcome aboard.`,
  html: layout("Welcome!", `<p>Hi ${name || "there"}, thanks for signing up.</p>`),
});
