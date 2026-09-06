import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink } from "better-auth/plugins";
import { isSignupAllowed, SIGNUP_CLOSED_MESSAGE } from "@/lib/auth/signup-policy";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema/auth";
import { sendEmail } from "@/lib/email/send";
import { magicLinkEmail, otpEmail, resetPasswordEmail, welcomeEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs/queue";
import { QUEUES } from "@/lib/jobs/queues";
import { logger } from "@/lib/observability/logger";

/**
 * Server-side auth. Three ways in, all email-based (Mailpit catches them locally):
 *   1. email + password (with forgot/reset)
 *   2. 6-digit email code (OTP)
 *   3. magic link
 * Auth emails are sent inline (user is waiting). Non-urgent mail (welcome) goes via the job queue.
 */
export const auth = betterAuth({
  appName: "__APP_TITLE__",
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...resetPasswordEmail(url) });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  databaseHooks: {
    user: {
      create: {
        // Sign-up policy (SIGNUP_ALLOWLIST) — one check covers password, code and magic link.
        before: (newUser) => {
          if (!isSignupAllowed(newUser.email, env.SIGNUP_ALLOWLIST)) {
            logger.warn({ email: newUser.email }, "auth.signup.rejected");
            return Promise.reject(new APIError("FORBIDDEN", { message: SIGNUP_CLOSED_MESSAGE }));
          }
          return Promise.resolve({ data: newUser });
        },
        after: async (createdUser) => {
          // Non-blocking: welcome email through the worker.
          try {
            await enqueue(QUEUES.SEND_EMAIL, {
              to: createdUser.email,
              ...welcomeEmail(createdUser.name),
            });
          } catch (err) {
            logger.error({ err, userId: createdUser.id }, "auth.welcome-email.enqueue-failed");
          }
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 5,
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendEmail({
          to: email,
          ...otpEmail(otp, type === "change-email" ? "email-verification" : type),
        });
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({ to: email, ...magicLinkEmail(url) });
      },
    }),
    nextCookies(), // must stay last — lets server actions set auth cookies
  ],
});

export type Auth = typeof auth;
