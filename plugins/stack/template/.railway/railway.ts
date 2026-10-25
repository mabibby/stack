/**
 * The live app's Railway setup, as code: web + worker (one Dockerfile), Postgres and a file bucket,
 * with every setting and variable they need. `railway config plan` shows what would change;
 * `railway config apply` makes it so. Nothing on Railway should be clicked into place by hand —
 * change this file instead (/stack:deploy does it).
 *
 * Railway matches resources BY NAME. Renaming one here, or removing it, deletes the live one on the
 * next apply (database included). Never apply a plan that says "to destroy" without the user's
 * explicit yes.
 */
import {
  bucket,
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  ref,
  service,
} from "railway/iac";

// ---- Filled in by /stack:deploy ---------------------------------------------------------------
/** "owner/repo" on GitHub. Empty until the app is on GitHub (then nothing deploys by itself). */
const GITHUB_REPO = "";
/** The branch that goes live. Matt reviews into `main`; the builder's saves go live from `dev`. */
const LIVE_BRANCH = "dev";
/** A custom domain (needs DNS — Matt's side). Empty = Railway's own *.up.railway.app address. */
const CUSTOM_DOMAIN = "";
/** Sender for every email. The domain must be verified in Resend. */
const EMAIL_FROM = "__APP_TITLE__ <hello@example.com>";
/** Who may create an account: comma-separated emails and/or @domains. Empty = anyone. */
const SIGNUP_ALLOWLIST = "";

/**
 * Names and regions of the live resources. New apps keep these defaults. An app that was online
 * before this file existed takes them from `railway config pull` (see /stack:deploy → "Adopt").
 */
const NAMES = { web: "web", worker: "worker", db: "Postgres", bucket: "files" };
/** Fixed once created: Railway can't move a bucket or a database. */
const BUCKET_REGION = "iad";
const DB_REGION: string | undefined = undefined;
/** Variables already on the live services that this file doesn't define. Kept as they are. */
const KEEP_EXISTING: string[] = [];
// -----------------------------------------------------------------------------------------------

export default defineRailway(() => {
  const db = postgres(NAMES.db, DB_REGION ? { region: DB_REGION } : undefined);
  const files = bucket(NAMES.bucket, { region: BUCKET_REGION as "iad" });

  // checkSuites = Railway's "Wait for CI": a push deploys only after GitHub Actions passes.
  const source = GITHUB_REPO
    ? github(GITHUB_REPO, { branch: LIVE_BRANCH, checkSuites: true })
    : undefined;
  const build = { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" } as const;

  // A Railway reference, resolved by Railway (ref() can't carry the https:// prefix).
  const railwayDomain = `https://\${{${NAMES.web}.RAILWAY_PUBLIC_DOMAIN}}`;

  const env = {
    ...Object.fromEntries(KEEP_EXISTING.map((name) => [name, preserve()])),
    NODE_ENV: "production",
    APP_URL: CUSTOM_DOMAIN ? `https://${CUSTOM_DOMAIN}` : railwayDomain,
    DATABASE_URL: db.env.DATABASE_URL,
    // Secrets live only on Railway (set with `railway variables --set`), never in this file.
    BETTER_AUTH_SECRET: preserve(),
    RESEND_API_KEY: preserve(),
    EMAIL_FROM,
    SIGNUP_ALLOWLIST,
    S3_ENDPOINT: ref(files, "ENDPOINT"),
    S3_REGION: ref(files, "REGION"),
    S3_BUCKET: ref(files, "BUCKET"),
    S3_ACCESS_KEY_ID: ref(files, "ACCESS_KEY_ID"),
    S3_SECRET_ACCESS_KEY: ref(files, "SECRET_ACCESS_KEY"),
    S3_FORCE_PATH_STYLE: "false",
    LOG_LEVEL: "info",
  };

  const web = service(NAMES.web, {
    source,
    build,
    // Migrations run before the new version takes traffic; a failing one stops the deploy.
    preDeploy: "bun run db:migrate",
    start: "bun run start",
    healthcheck: "/api/health",
    healthcheckTimeout: 300,
    domains: CUSTOM_DOMAIN ? [CUSTOM_DOMAIN] : [],
    // Restart policy: Railway's default (on failure, 10 tries) — stating it makes every plan show a diff.
    env,
  });

  const worker = service(NAMES.worker, {
    source,
    build,
    start: "bun run worker",
    // ALWAYS, no retry cap: nothing else would notice a dead worker (no health check, no page).
    deploy: { restartPolicyType: "ALWAYS" },
    env,
  });

  return project("__APP_NAME__", { resources: [db, files, web, worker] });
});
