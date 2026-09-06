import { z } from "zod";

/**
 * Every environment variable the app reads, validated once at boot.
 * Missing/invalid config fails loudly here instead of as a mystery 500 later.
 * Add new variables HERE first, then to .env.example.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Public URL of the app — used for links in emails and as the auth base URL.
  APP_URL: z.url().default("http://localhost:3000"),

  // One Postgres for app data, auth tables and pg-boss queues.
  DATABASE_URL: z.url(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  // Email: SMTP_URL (Mailpit locally) or RESEND_API_KEY (production). One must be set.
  EMAIL_FROM: z.string().min(3),
  SMTP_URL: z.url().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Object storage (S3-compatible: MinIO locally, Railway bucket / R2 / S3 in prod).
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // Who may create an account. Empty = anyone. Otherwise comma-separated emails and/or
  // @domains, e.g. "matt@example.com,@semanti.com". Checked for every sign-up method.
  SIGNUP_ALLOWLIST: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

/**
 * SKIP_ENV_VALIDATION=1 is set ONLY while `next build` runs inside the Docker image (see Dockerfile),
 * where no real config exists yet. Placeholder values are fed through the same schema so defaults
 * still apply and modules can be evaluated. At runtime the flag is absent and real env is validated.
 */
const skipValidation = process.env.SKIP_ENV_VALIDATION === "1";
const buildPlaceholders: Record<string, string> = {
  DATABASE_URL: "postgres://build:build@localhost:5432/build",
  BETTER_AUTH_SECRET: "build-placeholder-secret-not-used-at-runtime-0000",
  EMAIL_FROM: "build <build@example.com>",
  S3_BUCKET: "build",
  S3_ACCESS_KEY_ID: "build",
  S3_SECRET_ACCESS_KEY: "build",
};

const parsed = envSchema.safeParse(
  skipValidation ? { ...buildPlaceholders, ...process.env } : process.env,
);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables — see .env.example");
}

export const env: Env = parsed.data;

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
