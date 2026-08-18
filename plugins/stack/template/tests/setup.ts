/**
 * Preloaded before every `bun test` run (see bunfig.toml). Unit tests never
 * touch real services, but modules validate env at import time — so give them
 * harmless defaults. Real values from .env.local still win if present.
 */
const defaults: Record<string, string> = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-test-secret",
  EMAIL_FROM: "Test <test@example.com>",
  SMTP_URL: "smtp://localhost:1025",
  S3_BUCKET: "test",
  S3_ACCESS_KEY_ID: "test",
  S3_SECRET_ACCESS_KEY: "test",
  LOG_LEVEL: "silent",
};
for (const [k, v] of Object.entries(defaults)) process.env[k] ??= v;
